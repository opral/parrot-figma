import { checkBundle, type CheckDiagnostic } from "@inlang/sdk/browser";
import type { BundleNested } from "../store/FigmaBundleStore";
import { htmlBundleForChecks } from "../editor/HtmlText";

export type CheckSettings = {
	/** the languages every message needs (the reference language is always included) */
	locales: readonly string[];
	/** the language translations are compared with */
	referenceLocale: string;
};

/** A message without text in a language: no translation or only empty forms. */
export function isMissing(diagnostic: CheckDiagnostic) {
	return diagnostic.checkId === "missing-translation" || diagnostic.checkId === "empty-translation";
}

/**
 * The Inlang translation checks (`checkBundle`) of every message, kept up to date one bundle at a
 * time: an edit re-checks only its bundle, and the filters of the Messages tab read prepared sets
 * instead of checking thousands of messages per keystroke or dropdown.
 *
 * - missing: a language has no text (`missing-translation`, `empty-translation`)
 * - problems: everything else - variables, markup and forms that do not match the reference
 *   (`missing-variable`, `unknown-variable`, `missing-markup`, `missing-variant`) and empty forms
 *   next to filled ones (`empty-variant`)
 */
export class TranslationChecks {
	private settings: CheckSettings;

	private readonly diagnostics = new Map<string, readonly CheckDiagnostic[]>();

	/** locale -> ids of the bundles without text in it */
	private readonly missingByLocale = new Map<string, Set<string>>();

	/** ids of the bundles without text in any language */
	private readonly missingAny = new Set<string>();

	/** locale -> ids of the bundles with problems in it */
	private readonly problemsByLocale = new Map<string, Set<string>>();

	/** ids of the bundles with problems in any language */
	private readonly problemsAny = new Set<string>();

	constructor(settings: CheckSettings, bundles: Iterable<BundleNested> = []) {
		this.settings = settings;
		for (const bundle of bundles) this.update(bundle);
	}

	/** New languages or another reference language: every bundle is checked again. */
	setSettings(settings: CheckSettings, bundles: Iterable<BundleNested>) {
		this.settings = settings;
		this.diagnostics.clear();
		this.missingByLocale.clear();
		this.missingAny.clear();
		this.problemsByLocale.clear();
		this.problemsAny.clear();
		for (const bundle of bundles) this.update(bundle);
	}

	update(bundle: BundleNested) {
		this.remove(bundle.id);
		const diagnostics = checkBundle({
			// Parrot stores formatting as HTML text: as markup, a translation without the reference's
			// bold is reported, and `&nbsp;` alone counts as no text
			bundle: htmlBundleForChecks(bundle),
			locales: this.settings.locales,
			referenceLocale: this.settings.referenceLocale,
		});
		if (diagnostics.length === 0) return;
		this.diagnostics.set(bundle.id, diagnostics);
		for (const diagnostic of diagnostics) {
			const locale = diagnostic.locale!;
			const [byLocale, any] = isMissing(diagnostic)
				? [this.missingByLocale, this.missingAny]
				: [this.problemsByLocale, this.problemsAny];
			let ids = byLocale.get(locale);
			if (!ids) byLocale.set(locale, (ids = new Set()));
			ids.add(bundle.id);
			any.add(bundle.id);
		}
	}

	remove(bundleId: string) {
		const previous = this.diagnostics.get(bundleId);
		if (!previous) return;
		this.diagnostics.delete(bundleId);
		for (const diagnostic of previous) {
			const byLocale = isMissing(diagnostic) ? this.missingByLocale : this.problemsByLocale;
			byLocale.get(diagnostic.locale!)?.delete(bundleId);
		}
		this.missingAny.delete(bundleId);
		this.problemsAny.delete(bundleId);
	}

	/** The diagnostics of a message, in the order of the languages (reference first). */
	get(bundleId: string): readonly CheckDiagnostic[] {
		return this.diagnostics.get(bundleId) ?? [];
	}

	/** Messages without text in the language, or in any language. Do not mutate. */
	missing(locale?: string): ReadonlySet<string> {
		return locale === undefined ? this.missingAny : (this.missingByLocale.get(locale) ?? EMPTY);
	}

	/** Messages whose text in the language (or any language) does not match the reference. Do not mutate. */
	problems(locale?: string): ReadonlySet<string> {
		return locale === undefined ? this.problemsAny : (this.problemsByLocale.get(locale) ?? EMPTY);
	}
}

const EMPTY: ReadonlySet<string> = new Set();
