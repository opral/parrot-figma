import type { Message } from "../LegacyMessage";
import type { BundleNested, BundlePatternElement, BundleSelector } from "./FigmaBundleStore";
import { validateBundleNested } from "./FigmaBundleStore";

type LegacyPatternElement = Message["variants"][number]["pattern"][number];

export function legacyMessageToBundle(message: Message): BundleNested {
	const selectorNames = message.selectors.map((selector) => selector.name);
	const variableNames = new Set(selectorNames);
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

export function bundleToLegacyMessage(bundle: BundleNested): Message {
	validateBundleNested(bundle);
	const selectorNames = bundle.messages[0]?.selectors.map((selector) => selector.name) ?? [];

	const variants = bundle.messages.flatMap((message) => {
		if (
			message.selectors.length !== selectorNames.length ||
			message.selectors.some((selector, index) => selector.name !== selectorNames[index])
		) {
			throw new Error(`Bundle "${bundle.id}" has inconsistent locale selectors`);
		}

		return message.variants.map((variant) => {
			const matches = new Map(variant.matches.map((match) => [match.key, match]));
			return {
				languageTag: message.locale,
				match: selectorNames.map((selectorName) => {
					const match = matches.get(selectorName)!;
					return match.type === "catchall-match" ? "*" : match.value;
				}),
				pattern: variant.pattern.map(bundlePatternElementToLegacy),
			};
		});
	});

	return {
		id: bundle.id,
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
	throw new Error(`Unsupported Inlang pattern element in the legacy Parrot UI`);
}
