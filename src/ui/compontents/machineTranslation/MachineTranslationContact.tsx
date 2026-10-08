import * as React from "react";
import { useEffect, useState } from "react";
import Drawer from "../drawer/Drawer";
import type FigmaUtil from "../../../shared/FigmaUtil";
import { MACHINE_TRANSLATION_CONTACT } from "../../../lib/translationprovider/MachineTranslationContact";

const OPEN_EVENT = "parrot:machine-translation-contact";

/** Opens the "Machine translation is available on request" dialog (mounted once in the app). */
export function showMachineTranslationContact() {
	window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export default function MachineTranslationContact({ figmaRemote }: { figmaRemote: FigmaUtil }) {
	const [shown, setShown] = useState(false);

	useEffect(() => {
		const open = () => setShown(true);
		window.addEventListener(OPEN_EVENT, open);
		return () => window.removeEventListener(OPEN_EVENT, open);
	}, []);

	return (
		<Drawer
			position="top"
			shown={shown}
			buttons={[
				{ type: "secondary", text: "Close", key: "escape", callback: () => setShown(false) },
				{
					type: "primary",
					text: "Send email",
					key: "enter",
					callback: () => {
						figmaRemote.openExternal(
							`mailto:${MACHINE_TRANSLATION_CONTACT}?subject=${encodeURIComponent("Machine translation for Parrot")}`,
						);
						setShown(false);
					},
				},
			]}
		>
			<div className="drawer-header">Machine translation</div>
			<div className="drawer-body">
				<p>
					Parrot can fill in missing translations with machine translation. It is available on
					request - send an email to{" "}
					<span className="machine-translation-contact">{MACHINE_TRANSLATION_CONTACT}</span> and we
					set it up for your team.
				</p>
				<p>
					Until then, texts without a translation keep their current text when you switch a frame.
				</p>
			</div>
		</Drawer>
	);
}
