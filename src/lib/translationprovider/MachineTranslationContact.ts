/**
 * Machine translation needs a paid, hosted translation service. Until Parrot Cloud exists, translations
 * that would be machine translated keep the reference text and the user is pointed to the Cloud tab.
 */
export class MachineTranslationUnavailableError extends Error {
	constructor() {
		super("Machine translations are part of Parrot Cloud (Cloud tab)");
		this.name = "MachineTranslationUnavailableError";
	}
}

/** The note after a language switch for the texts that kept their current text. */
export function untranslatedNotice(count: number, languageName: string) {
	const texts = count === 1 ? "1 text has" : `${count} texts have`;
	return `${texts} no ${languageName} translation yet and ${count === 1 ? "keeps its" : "keep their"} current text. Machine translations are part of Parrot Cloud (Cloud tab).`;
}

/** Also recognizes the error after it crossed from the Figma sandbox (the class is lost there). */
export function isMachineTranslationUnavailable(error: unknown) {
	return (
		error instanceof MachineTranslationUnavailableError ||
		(error as Error | undefined)?.name === "MachineTranslationUnavailableError" ||
		String((error as Error | undefined)?.message ?? "").startsWith(
			"Machine translation is available on request",
		)
	);
}
