import { useMemo } from "react";
import {
	checkBundle,
	selectorGroups,
	type CheckDiagnostic,
	type Declaration,
	type Match,
	type VariableReference,
} from "@inlang/sdk/browser";
import type { BundleNested } from "../../../lib/message/store/FigmaBundleStore";
import "./TranslationProblems.css";

/** The problems a translation can have that its field cannot show by itself. */
type Problem = Extract<
	CheckDiagnostic,
	{
		checkId:
			| "missing-variable"
			| "unknown-variable"
			| "missing-markup"
			| "empty-variant"
			| "missing-selector";
	}
>;

const PROBLEM_CHECKS = [
	"missing-variable",
	"unknown-variable",
	"missing-markup",
	"empty-variant",
	"missing-selector",
] as const;

function isProblem(diagnostic: CheckDiagnostic): diagnostic is Problem {
	return (PROBLEM_CHECKS as readonly string[]).includes(diagnostic.checkId);
}

/**
 * The translation checks of a message per language. A missing or empty translation is the empty
 * field itself, and a missing plural form a "missing" form of the forms strip: only the problems
 * inside a text, and an empty form next to filled ones (`empty-variant`, e.g. an exported `=0 {}`),
 * are listed below it.
 */
export function useTranslationProblems(
	stored: BundleNested,
	locales: string[],
	baseLocale: string,
): Map<string, Problem[]> {
	const localesKey = locales.join("|");
	return useMemo(() => {
		const byLocale = new Map<string, Problem[]>();
		for (const diagnostic of checkBundle({
			bundle: stored,
			locales,
			referenceLocale: baseLocale,
			checks: [...PROBLEM_CHECKS],
		})) {
			if (!isProblem(diagnostic) || !diagnostic.locale) continue;
			byLocale.set(diagnostic.locale, [...(byLocale.get(diagnostic.locale) ?? []), diagnostic]);
		}
		return byLocale;
	}, [stored, localesKey, baseLocale]);
}

type FormsMessage = { locale: string; selectors: readonly VariableReference[] };

/**
 * "one", "other", "female, one", "0": the label of a form as the forms strip shows it - one key per
 * choice (an ICU exact number and its plural are one), "other" for a plural's catch-all and "any
 * other" for a select's.
 */
export function formLabel(
	variant: { matches: readonly Match[] },
	message: FormsMessage,
	declarations: readonly Declaration[],
) {
	return selectorGroups(message, declarations, { variants: [variant] })
		.map((group) => {
			const key = group.keyOf(variant);
			return key !== "*" ? key : group.isPlural ? "other" : "any other";
		})
		.join(", ");
}

/** The reference's exact numbers (=0) a translation has no form for: a plural alone can't match them. */
export function missingExactNumbers(problem: Problem): readonly string[] | undefined {
	return problem.checkId === "missing-selector" &&
		problem.values.length > 0 &&
		problem.values.every((value) => /^-?\d+(\.\d+)?$/.test(value))
		? problem.values
		: undefined;
}

function problemText(problem: Problem) {
	if (problem.checkId === "empty-variant") return "Empty";
	// the reference chooses by an input this language has no selector for
	if (problem.checkId === "missing-selector") {
		const numbers = missingExactNumbers(problem);
		return numbers
			? `No form for ${numbers.map((value) => `=${value}`).join(", ")} – add it in Plural & select`
			: `Not split by {${problem.name}} – add it in Plural & select`;
	}
	if (problem.checkId === "missing-variable") return `Missing {${problem.name}}`;
	if (problem.checkId === "missing-markup") return `Missing <${problem.name}>`;
	const suggestion = "suggestion" in problem ? problem.suggestion : undefined;
	return suggestion
		? `Unknown {${problem.name}} – did you mean {${suggestion}}?`
		: `Unknown {${problem.name}}`;
}

/**
 * One quiet line below a translation: "Missing {total}", "Unknown {totl} – did you mean {total}?".
 * Problems of another form of the message name that form and select it when clicked.
 */
export function TranslationProblems({
	problems,
	message,
	declarations,
	variants,
	selectedVariantId,
	onSelect,
	onAddExactNumbers,
}: {
	problems: Problem[] | undefined;
	/** the message of the language (its selectors), to label the forms like the forms strip */
	message: FormsMessage;
	declarations: readonly Declaration[];
	variants: readonly { id: string; matches: readonly Match[] }[];
	selectedVariantId: string | undefined;
	onSelect: (variantId: string) => void;
	/** "No form for =0": gives the translation the reference's exact numbers, as missing forms */
	onAddExactNumbers?: (input: string, values: readonly string[]) => void;
}) {
	if (!problems?.length) return null;
	const multipleForms = variants.length > 1;
	// the selected form first: that is the text the field shows
	const sorted = [...problems].sort(
		(a, b) =>
			Number("variantId" in b && b.variantId === selectedVariantId) -
			Number("variantId" in a && a.variantId === selectedVariantId),
	);
	return (
		<div className="translation-problems" role="status">
			{sorted.map((problem, index) => {
				const text = problemText(problem);
				const variantId = "variantId" in problem ? problem.variantId : undefined;
				const variant = variants.find((v) => v.id === variantId);
				// a plural and its exact numbers are reported apart for the same input: the selector tells them apart
				const key = `${problem.checkId}:${variantId}:${"name" in problem ? problem.name : ""}:${"selector" in problem ? problem.selector : ""}`;
				const numbers = missingExactNumbers(problem);
				if (numbers && onAddExactNumbers && problem.checkId === "missing-selector") {
					const name = problem.name;
					return (
						<span key={key} className="translation-problem" title={problem.message}>
							{index > 0 && <span className="translation-problem-separator" />}
							{`No form for ${numbers.map((value) => `=${value}`).join(", ")} – `}
							<button
								type="button"
								className="translation-problem-form"
								title={`Add the ${numbers.map((value) => `=${value}`).join(", ")} forms of the reference to this language`}
								onClick={() => onAddExactNumbers(name, numbers)}
							>
								{numbers.length === 1 ? "Add it" : "Add them"}
							</button>
						</span>
					);
				}
				if (!multipleForms || !variant || variant.id === selectedVariantId) {
					return (
						<span key={key} className="translation-problem" title={problem.message}>
							{index > 0 && <span className="translation-problem-separator" />}
							{problem.checkId === "empty-variant" ? "This form is empty" : text}
						</span>
					);
				}
				const form = (
					<button
						type="button"
						className="translation-problem-form"
						title={`Show the “${formLabel(variant, message, declarations)}” form`}
						onClick={() => onSelect(variant.id)}
					>
						{formLabel(variant, message, declarations)}
					</button>
				);
				// "Empty: 0" - the form names the problem
				if (problem.checkId === "empty-variant") {
					return (
						<span key={key} className="translation-problem" title={problem.message}>
							{index > 0 && <span className="translation-problem-separator" />}
							{"Empty: "}
							{form}
						</span>
					);
				}
				return (
					<span key={key} className="translation-problem">
						{index > 0 && <span className="translation-problem-separator" />}
						{form}
						{`: ${text}`}
					</span>
				);
			})}
		</div>
	);
}
