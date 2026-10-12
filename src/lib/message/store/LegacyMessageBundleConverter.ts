import type { Message } from "../LegacyMessage";
import type { BundleNested, BundlePatternElement, BundleSelector } from "./FigmaBundleStore";
import { validateBundleNested } from "./FigmaBundleStore";

type LegacyPatternElement = Message["variants"][number]["pattern"][number];

export function legacyMessageToBundle(message: Message): BundleNested {
	// Declarations of a plain native bundle that survive when the legacy view is edited.
	const keptDeclarationNames: string[] = [];
	if (message.nativeBundle) {
		const projected = bundleToLegacyMessage(message.nativeBundle);
		if (
			JSON.stringify(projected.selectors) !== JSON.stringify(message.selectors) ||
			JSON.stringify(projected.variants) !== JSON.stringify(message.variants) ||
			message.id !== message.nativeBundle.id
		) {
			// The legacy view was edited (machine translation, Layers tab, ...). Only a bundle with real
			// Inlang metadata (annotations, local declarations, ...) cannot be rebuilt from it. A plain
			// bundle is fully described by the legacy view - without this, every message that was
			// imported or edited in the Messages tab could not be translated or edited again until the
			// plugin was reopened.
			if (needsNativeBundle(message.nativeBundle)) {
				// a text edit (canvas, Layers tab) keeps the forms, declarations and formats
				const patched = patchNativePatterns(message, message.nativeBundle);
				if (patched) return patched;
				throw new Error("Edit this message in the Messages tab to preserve its Inlang metadata.");
			}
			keptDeclarationNames.push(...message.nativeBundle.declarations.map((d) => d.name));
		} else {
			return cloneBundle(message.nativeBundle);
		}
	}
	if (message.alias && Object.keys(message.alias).length > 0) {
		throw new Error(
			`Message "${message.id}" has aliases that cannot be represented by an Inlang bundle`,
		);
	}
	const selectorNames = message.selectors.map((selector) => selector.name);
	if (selectorNames.length > 0 && message.variants.length === 0) {
		throw new Error(
			`Message "${message.id}" has selectors but no variants; the Inlang bundle model cannot preserve them without a locale message`,
		);
	}
	const variableNames = new Set([...selectorNames, ...keptDeclarationNames]);
	const selectors: BundleSelector[] = selectorNames.map((name) => ({
		type: "variable-reference",
		name,
	}));
	const locales = [...new Set(message.variants.map((variant) => variant.languageTag))];

	for (const variant of message.variants) {
		for (const element of variant.pattern) {
			if (element.type === "VariableReference") variableNames.add(element.name);
		}
	}

	const bundle: BundleNested = {
		id: message.id,
		declarations: [...variableNames].map((name) => ({
			type: "input-variable",
			name,
		})),
		messages: locales.map((locale) => {
			const messageId = `${message.id}_${locale}`;
			return {
				id: messageId,
				bundleId: message.id,
				locale,
				selectors: [...selectors],
				variants: message.variants
					.filter((variant) => variant.languageTag === locale)
					.map((variant, index) => {
						if (variant.match.length !== selectorNames.length) {
							throw new Error(
								`Message "${message.id}" has ${variant.match.length} matches for ${selectorNames.length} selectors`,
							);
						}
						return {
							id: `${messageId}_${index + 1}`,
							messageId,
							matches: variant.match.map((value, matchIndex) =>
								value === "*"
									? {
											type: "catchall-match" as const,
											key: selectorNames[matchIndex]!,
										}
									: {
											type: "literal-match" as const,
											key: selectorNames[matchIndex]!,
											value,
										},
							),
							pattern: variant.pattern.map(legacyPatternElementToBundle),
						};
					}),
			};
		}),
	};

	validateBundleNested(bundle);
	return bundle;
}

/**
 * A native bundle whose legacy view changed only in its texts: the changed texts are copied into it,
 * everything else (forms, declarations, formats of variables) is kept. `undefined` when the forms or
 * languages changed, or a changed text has elements the legacy view cannot represent.
 */
function patchNativePatterns(message: Message, native: BundleNested): BundleNested | undefined {
	const projected = bundleToLegacyMessage(native);
	if (
		message.id !== native.id ||
		JSON.stringify(projected.selectors) !== JSON.stringify(message.selectors) ||
		projected.variants.length !== message.variants.length
	)
		return undefined;
	const bundle = cloneBundle(native);
	// bundleToLegacyMessage lists the variants in the order of the bundle's messages and variants
	const nativeVariants = bundle.messages.flatMap((m) => m.variants);
	const declared = new Set(bundle.declarations.map((d) => d.name));
	for (const [index, after] of message.variants.entries()) {
		const before = projected.variants[index]!;
		if (
			before.languageTag !== after.languageTag ||
			JSON.stringify(before.match) !== JSON.stringify(after.match)
		)
			return undefined;
		if (JSON.stringify(before.pattern) === JSON.stringify(after.pattern)) continue;
		const target = nativeVariants[index]!;
		const annotations = new Map<string, string>();
		for (const element of target.pattern) {
			if (element.type === "text") continue;
			if (element.type !== "expression" || element.arg.type !== "variable-reference") return undefined;
			const annotation = JSON.stringify(element.annotation ?? null);
			if ((annotations.get(element.arg.name) ?? annotation) !== annotation) return undefined;
			annotations.set(element.arg.name, annotation);
		}
		target.pattern = after.pattern.map((element) => {
			const converted = legacyPatternElementToBundle(element);
			if (converted.type !== "expression" || converted.arg.type !== "variable-reference")
				return converted;
			const name = converted.arg.name;
			if (!declared.has(name)) {
				declared.add(name);
				bundle.declarations.push({ type: "input-variable", name });
			}
			const annotation = JSON.parse(annotations.get(name) ?? "null");
			return annotation ? { ...converted, annotation } : converted;
		});
	}
	validateBundleNested(bundle);
	return bundle;
}

export function bundleToLegacyMessage(bundle: BundleNested, preserveNative = false): Message {
	validateBundleNested(bundle);
	// Languages can choose by different selectors (an ICU translation without the `=0` of the
	// reference has no exact-number selector): the legacy view has every selector, a language
	// without one matches it with "*". Taking the first message's selectors only turned the
	// reference's `=0` form into its catch-all form - the canvas showed "No messages".
	const selectorNames = [
		...new Set(bundle.messages.flatMap((message) => message.selectors.map((s) => s.name))),
	];

	const variants = bundle.messages.flatMap((message) => {
		return message.variants.map((variant) => {
			const matches = new Map(variant.matches.map((match) => [match.key, match]));
			return {
				languageTag: message.locale,
				match: selectorNames.map((selectorName) => {
					const match = matches.get(selectorName);
					return !match || match.type === "catchall-match" ? "*" : match.value;
				}),
				pattern: variant.pattern.map(bundlePatternElementToLegacy),
			};
		});
	});

	return {
		id: bundle.id,
		...(preserveNative || needsNativeBundle(bundle) ? { nativeBundle: cloneBundle(bundle) } : {}),
		alias: {},
		selectors: selectorNames.map((name) => ({ type: "VariableReference", name })),
		variants,
	};
}

function legacyPatternElementToBundle(element: LegacyPatternElement): BundlePatternElement {
	if (element.type === "Text") return { type: "text", value: element.value };
	if (element.type === "VariableReference") {
		return {
			type: "expression",
			arg: { type: "variable-reference", name: element.name },
		};
	}
	throw new Error(`Unsupported legacy pattern element`);
}

function bundlePatternElementToLegacy(element: BundlePatternElement): LegacyPatternElement {
	if (element.type === "text") return { type: "Text", value: element.value };
	if (element.type === "expression" && element.arg.type === "variable-reference") {
		return { type: "VariableReference", name: element.arg.name };
	}
	// Parrot texts are HTML: formats whose plugin parses "<b>bold</b>" into markup nodes (i18next, ...)
	// keep the tags as text here - dropping them lost the markup of the imported text.
	if (element.type === "markup-start") return { type: "Text", value: `<${element.name}>` };
	if (element.type === "markup-end") return { type: "Text", value: `</${element.name}>` };
	if (element.type === "markup-standalone") return { type: "Text", value: `<${element.name}/>` };
	return {
		type: "Text",
		value: element.type === "expression" && element.arg.type === "literal" ? element.arg.value : "",
	};
}

function needsNativeBundle(bundle: BundleNested): boolean {
	return (
		bundle.declarations.some((d) => d.type !== "input-variable" || d.annotation) ||
		bundle.messages.some(
			(m) =>
				JSON.stringify(m.selectors) !== JSON.stringify(bundle.messages[0]?.selectors) ||
				m.variants.some((v) =>
					v.pattern.some(
						(e) =>
							e.type !== "text" &&
							!e.type.startsWith("markup-") &&
							(e.type !== "expression" || e.arg.type !== "variable-reference" || e.annotation),
					),
				),
		)
	);
}

/** Replace only the selected locale and merge compatible declarations. */
export function mergeImportedMessage(
	existing: Message | undefined,
	incoming: Message,
	locale: string,
): Message {
	if (!existing) return incoming;
	const current = legacyMessageToBundle(existing);
	const imported = legacyMessageToBundle(incoming);
	const declarations = new Map(current.declarations.map((d) => [d.name, d]));
	const usedByOtherLocales = new Set<string>();
	function collectReferences(value: unknown): void {
		if (Array.isArray(value)) {
			value.forEach(collectReferences);
			return;
		}
		if (!value || typeof value !== "object") return;
		const node = value as Record<string, unknown>;
		if (
			node.type === "variable-reference" &&
			typeof node.name === "string" &&
			!usedByOtherLocales.has(node.name)
		) {
			usedByOtherLocales.add(node.name);
			collectReferences(declarations.get(node.name));
		}
		Object.values(node).forEach(collectReferences);
	}
	collectReferences(current.messages.filter((m) => m.locale !== locale));
	for (const declaration of imported.declarations) {
		const previous = declarations.get(declaration.name);
		if (
			previous &&
			usedByOtherLocales.has(declaration.name) &&
			stableStringify(previous) !== stableStringify(declaration)
		) {
			throw new Error(
				`Key "${incoming.id}" has conflicting variable "${declaration.name}". Use a different key to preserve other languages.`,
			);
		}
		declarations.set(declaration.name, declaration);
	}
	return bundleToLegacyMessage(
		{
			...current,
			declarations: [...declarations.values()],
			messages: [
				...current.messages.filter((m) => m.locale !== locale),
				...imported.messages.filter((m) => m.locale === locale),
			],
		},
		true,
	);
}

/**
 * JSON with object keys in sorted order: the same declaration rebuilt by Parrot (`{type, name}`) and
 * read from a plugin or the database (`{name, type}`) compare equal.
 */
export function stableStringify(value: unknown): string {
	return JSON.stringify(value, (_key, v: unknown) =>
		v && typeof v === "object" && !Array.isArray(v)
			? Object.fromEntries(
					Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
				)
			: v,
	);
}

/** Declarations compared by content: neither their order nor the order of their keys matters. */
export function sameDeclarations(a: BundleNested["declarations"], b: BundleNested["declarations"]) {
	const sorted = (d: BundleNested["declarations"]) =>
		[...d].sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
	return stableStringify(sorted(a)) === stableStringify(sorted(b));
}

// Figma's plugin sandbox has no structuredClone; bundles contain JSON data only.
function cloneBundle(bundle: BundleNested): BundleNested {
	return JSON.parse(JSON.stringify(bundle)) as BundleNested;
}
