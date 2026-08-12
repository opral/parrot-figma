import * as React from "react";
import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import { Locale } from "../../../lib/message/variants/Locale";
import LanguageSetup from "../../compontents/languageSetup/LanguageSetup";

type SetupViewProps = {
	labelManager: LocalizedLabelManagerUI;
};

export default function SetupView({ labelManager }: SetupViewProps) {
	return (
		<>
			<LanguageSetup
				labelManager={labelManager}
				baseLanguage={labelManager.messageStore.getRefLanugage()}
				activeLanguages={labelManager.messageStore.getLanugages()!}
				onChange={async (baselanguage: Locale, activeLanguages: Locale[]) => {
					await labelManager.messageStore.setRefLanguage(baselanguage);
					await labelManager.messageStore.setLanguages(activeLanguages);
				}}
			/>
		</>
	);
}
