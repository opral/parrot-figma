/**
 * Parrot's pre-v3 UI message shape.
 *
 * Keep this compatibility model local while the UI is migrated incrementally to
 * Inlang's nested bundle model. It is deliberately not part of the Inlang SDK.
 */
export type LegacyText = { type: "Text"; value: string };

export type LegacyVariableReference = {
	type: "VariableReference";
	name: string;
};

export type Pattern = Array<LegacyText | LegacyVariableReference>;

export type Variant = {
	languageTag: string;
	match: string[];
	pattern: Pattern;
};

export type Message = {
	id: string;
	nativeBundle?: import("./store/FigmaBundleStore").BundleNested;
	alias?: Record<string, string>;
	selectors: LegacyVariableReference[];
	variants: Variant[];
};

type Result<T> = { data: T; error?: never } | { data?: never; error: Error };

export function getVariant(
	message: Message,
	args: { where: { languageTag: string; match?: string[] } },
): Variant | undefined {
	const candidates = message.variants.filter(
		(variant) => variant.languageTag === args.where.languageTag,
	);
	const requestedMatch = args.where.match;

	if (message.selectors.length === 0) {
		return clone(candidates.find((variant) => variant.match.length === 0));
	}
	if (!requestedMatch || requestedMatch.length !== message.selectors.length) {
		return clone(
			candidates.find(
				(variant) =>
					variant.match.length === message.selectors.length &&
					variant.match.every((value) => value === "*"),
			),
		);
	}

	const matching = candidates.filter(
		(variant) =>
			variant.match.length === requestedMatch.length &&
			variant.match.every((value, index) => value === "*" || value === requestedMatch[index]),
	);
	matching.sort(
		(left, right) =>
			right.match.filter((value) => value !== "*").length -
			left.match.filter((value) => value !== "*").length,
	);
	return clone(matching[0]);
}

export function createVariant(message: Message, args: { data: Variant }): Result<Message> {
	const exact = message.variants.some(
		(variant) =>
			variant.languageTag === args.data.languageTag &&
			JSON.stringify(variant.match) === JSON.stringify(args.data.match),
	);
	if (exact) return { error: new Error(`Variant already exists for "${message.id}"`) };
	const copy = clone(message)!;
	copy.variants.push(clone(args.data)!);
	return { data: copy };
}

export function updateVariantPattern(
	message: Message,
	args: {
		where: { languageTag: string; match: string[] };
		data: Pattern;
	},
): Result<Message> {
	const copy = clone(message)!;
	const variant = copy.variants.find(
		(candidate) =>
			candidate.languageTag === args.where.languageTag &&
			JSON.stringify(candidate.match) === JSON.stringify(args.where.match),
	);
	if (!variant) return { error: new Error(`Variant does not exist for "${message.id}"`) };
	variant.pattern = clone(args.data)!;
	return { data: copy };
}

function clone<T>(value: T | undefined): T | undefined {
	return value === undefined ? undefined : structuredClone(value);
}
