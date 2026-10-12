import * as React from "react";
import { useEffect, useState } from "react";
import Drawer from "../drawer/Drawer";
import { capture } from "../../../lib/telemetry/Telemetry";
import type FigmaUtil from "../../../shared/FigmaUtil";
import { CLOUD_INTEREST_FORM_URL } from "../../views/cloud/cloudContent";

const OPEN_EVENT = "parrot:machine-translation-contact";

/** Opens the "Access to machine translations" dialog (mounted once in the app). */
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
					text: "More info",
					key: "enter",
					callback: () => {
						capture("cloud:interest_button_click", { topic: "machine_translation" });
						figmaRemote.openExternal(CLOUD_INTEREST_FORM_URL);
						setShown(false);
					},
				},
			]}
		>
			<div className="drawer-header">Access to machine translations</div>
			<div className="drawer-body">
				<p>Get access to cloud resources like machine translations.</p>
			</div>
		</Drawer>
	);
}
