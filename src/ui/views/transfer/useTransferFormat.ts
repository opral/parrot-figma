import { useEffect, useState } from "react";
import { translationFormats } from "../../../lib/transfer/TranslationFormats";
import type FigmaUtil from "../../../shared/FigmaUtil";

const configKey = "transferFormat";
const defaultFormat = translationFormats[0].value;

/**
 * The import/export format of this file, remembered per file (and user): a project that uses i18next JSON
 * should not have to pick it again - and be corrupted by "inlang JSON" - on every visit.
 * `loaded` is false until the stored value was read, so the picker does not flash the default.
 */
export function useTransferFormat(
	figmaRemote?: FigmaUtil,
): [string, (format: string) => void, boolean] {
	const [format, setFormat] = useState(defaultFormat);
	const [loaded, setLoaded] = useState(figmaRemote === undefined);

	useEffect(() => {
		if (!figmaRemote) return;
		let cancelled = false;
		figmaRemote
			.getLocalFileConfig(configKey)
			.then((stored) => {
				if (!cancelled && translationFormats.some((option) => option.value === stored)) {
					setFormat(stored);
				}
			})
			.catch(() => undefined)
			.finally(() => !cancelled && setLoaded(true));
		return () => {
			cancelled = true;
		};
	}, [figmaRemote]);

	return [
		format,
		(next: string) => {
			setFormat(next);
			void figmaRemote?.setLocalFileConfig(configKey, next);
		},
		loaded,
	];
}
