import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { reportError } from "../../utils/errorReporting";
import FigmaUtil from "../../../shared/FigmaUtil";
import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import { UILocalizedLabel } from "../../../lib/localizedlabels/UILocalizedLabel";

const OFFER_VISIBLE_MS = 12000;
const RESULT_VISIBLE_MS = 3000;

type Offer =
	| { type: "offer"; messageName: string; text: string; labels: UILocalizedLabel[] }
	| { type: "linking"; messageName: string; count: number }
	| { type: "done"; messageName: string; count: number };

function shorten(text: string) {
	const firstLine = text.split(/\r?\n|\u2028/).find((line) => line.trim() !== "") ?? "";
	return firstLine.length > 32 ? `${firstLine.slice(0, 31).trimEnd()}…` : firstLine;
}

type LinkIdenticalTextsToastProps = {
	figmaRemote: FigmaUtil;
	localizedLabelManager: LocalizedLabelManagerUI;
};

/** After a layer was linked: offers to link the other layers on the page with exactly the same text. */
export default function LinkIdenticalTextsToast({
	figmaRemote,
	localizedLabelManager,
}: LinkIdenticalTextsToastProps) {
	const [offer, setOffer] = useState<Offer | undefined>();
	const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const lookup = useRef(0);

	function hideAfter(ms: number) {
		clearTimeout(hideTimer.current);
		hideTimer.current = setTimeout(() => setOffer(undefined), ms);
	}

	useEffect(() => {
		const onLabelLinked = async (event: Event) => {
			const { nodeId, messageName } = (event as CustomEvent).detail as {
				nodeId: string;
				messageName: string;
			};
			const revision = ++lookup.current;
			try {
				const labels = await localizedLabelManager.findUnlinkedLabelsWithSameText(nodeId);
				if (revision !== lookup.current || labels.length === 0) return;
				setOffer({ type: "offer", messageName, text: shorten(labels[0].characters), labels });
				hideAfter(OFFER_VISIBLE_MS);
			} catch (e: any) {
				reportError(e);
			}
		};

		localizedLabelManager.addEventListener("labelLinked", onLabelLinked);
		return () => {
			localizedLabelManager.removeEventListener("labelLinked", onLabelLinked);
			clearTimeout(hideTimer.current);
		};
	}, []);

	async function linkAll() {
		if (offer?.type !== "offer") return;
		const { labels, messageName } = offer;
		clearTimeout(hideTimer.current);
		setOffer({ type: "linking", messageName, count: labels.length });
		try {
			// layers changed or linked since the offer are skipped
			const { linked } = await localizedLabelManager.linkLabelsToMessage(labels, messageName);
			setOffer({ type: "done", messageName, count: linked });
			hideAfter(RESULT_VISIBLE_MS);
		} catch (e: any) {
			setOffer(undefined);
			figmaRemote.notifyError(`Could not link the layers - ${e.message}`, 8000);
			reportError(e);
		}
	}

	if (!offer) return null;

	const layers = (count: number) => (count === 1 ? "1 layer" : `${count} layers`);

	return (
		<div
			className="link-identical-toast"
			role="status"
			onMouseEnter={() => offer.type === "offer" && clearTimeout(hideTimer.current)}
			onMouseLeave={() => offer.type === "offer" && hideAfter(OFFER_VISIBLE_MS / 2)}
		>
			<span className="link-identical-toast-text">
				{offer.type === "offer" && (
					<>
						{offer.labels.length === 1 ? "1 other layer" : `${offer.labels.length} other layers`} on
						this page {offer.labels.length === 1 ? "says" : "say"} “{offer.text}”
					</>
				)}
				{offer.type === "linking" && `Linking ${layers(offer.count)}…`}
				{offer.type === "done" && (
					<>
						Linked {layers(offer.count)} to{" "}
						<span className="link-identical-toast-key">{offer.messageName}</span>
					</>
				)}
			</span>
			{offer.type === "offer" && (
				<button type="button" className="link-identical-toast-action" onClick={linkAll}>
					Link all
				</button>
			)}
			{offer.type !== "linking" && (
				<button
					type="button"
					className="link-identical-toast-close"
					aria-label="Dismiss"
					onClick={() => {
						clearTimeout(hideTimer.current);
						setOffer(undefined);
					}}
				>
					<span className="svg-container cross-svg" />
				</button>
			)}
		</div>
	);
}
