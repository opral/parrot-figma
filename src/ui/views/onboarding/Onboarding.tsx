import * as React from "react";
import { useEffect, useRef, useState } from "react";
import "../../localization/i18n";
import LanguageSetup from "../../compontents/languageSetup/LanguageSetup";

import "./Onboarding.css";
import { Locale } from "../../../lib/message/variants/Locale";
import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import WindowManagerUi from "../../../lib/windowManager/WindowManagerUI";

type OnboardingProps = {
	labelManager: LocalizedLabelManagerUI;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	onFinishSetup: Function;
};

export default function Onboarding({ labelManager, onFinishSetup }: OnboardingProps) {
	const [selectedLanguages, setSelectedLanguages] = useState<Locale[]>(
		labelManager.messageStore.getLanugages() ?? [],
	);
	const [selectedBaseLanguage, setSelectedBaseLanguage] = useState<Locale | undefined>(
		labelManager.messageStore.getRefLanugage(),
	);
	const scrollContainerRef = useRef<HTMLDivElement | null>(null);

	const scrollHeightCheckInterval = useRef<any | undefined>(undefined);

	const lastPropagatedScrollheight = useRef<number | undefined>(undefined);

	const finishSetupClick = () => {
		onFinishSetup();
	};

	useEffect(() => {
		const scrollContainer = scrollContainerRef.current;

		scrollHeightCheckInterval.current = setInterval(() => {
			if (
				scrollContainerRef.current &&
				scrollContainerRef.current.scrollHeight !== lastPropagatedScrollheight.current
			) {
				lastPropagatedScrollheight.current = scrollContainerRef.current.scrollHeight;
				console.log(`propagateScrollHeight${lastPropagatedScrollheight.current}`);
				WindowManagerUi.instance!.requestResize({
					height: lastPropagatedScrollheight.current + 16,
				});
			}
		}, 30) as any;

		return () => {
			if (scrollHeightCheckInterval.current) {
				clearInterval(scrollHeightCheckInterval.current);
			}
		};
	}, []);

	return (
		<div className="view-wrapper">
			<div className="view filesetup" ref={scrollContainerRef}>
				<div className="setup-header">
					<div className="setup-header-title onboarding-title">Welcome to Parrot</div>
				</div>
				<div className="setup-text">
					Parrot switches the text of your frames between languages. Start by choosing the language
					this file is written in and the languages you want to translate to. You can change this
					later in the Setup tab.
				</div>
				<LanguageSetup
					labelManager={labelManager}
					baseLanguage={selectedBaseLanguage}
					activeLanguages={selectedLanguages}
					onChange={async (baselanguage: Locale, activeLanguages: Locale[]) => {
						setSelectedBaseLanguage(baselanguage);
						setSelectedLanguages(activeLanguages);

						await labelManager.messageStore.setRefLanguage(baselanguage);
						await labelManager.messageStore.setLanguages(activeLanguages);
					}}
				/>
				<div className="onboarding-buttonbar">
					<button
						className="button button--buttonPrimary"
						disabled={selectedBaseLanguage === undefined || selectedLanguages.length === 0}
						type="button"
						onClick={finishSetupClick}
					>
						<span data-tooltip-type="text">Finish setup</span>
					</button>
				</div>
			</div>
			<div className="space-filler" />
		</div>
	);
}
