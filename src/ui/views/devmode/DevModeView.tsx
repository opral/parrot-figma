import * as React from "react";
import { useEffect, useRef, useState } from "react";
import FigmaUtil from "../../../shared/FigmaUtil";
import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import { UILocalizedLabel } from "../../../lib/localizedlabels/UILocalizedLabel";
import { MessageLinkState } from "../../../lib/localizedlabels/LocalizedLabel";
import type { Message, Pattern } from "../../../lib/message/LegacyMessage";
import { htmlToPlainText } from "../../../lib/message/editor/HtmlText";
import { languageDisplayName } from "../../../lib/message/variants/Locale";
import { LatestRequest } from "../../utils/LatestRequest";
import { copyToClipboard } from "../../utils/clipboard";
import "./DevModeView.css";

function patternText(pattern: Pattern) {
	return pattern
		.map((part) =>
			part.type === "Text"
				? htmlToPlainText(
						part.value.replace(/<br\s*\/?>|<\/(p|li|div)>/gi, "\n").replace(/<[^>]*>/g, ""),
					)
				: `{${part.name}}`,
		)
		.join("")
		.trim();
}

function Translations({
	message,
	languages,
	refLanguage,
}: {
	message: Message;
	languages: string[];
	refLanguage: string | undefined;
}) {
	return (
		<dl className="dev-translations">
			{languages.map((language) => {
				const variants = message.variants.filter((variant) => variant.languageTag === language);
				return (
					<React.Fragment key={language}>
						<dt title={languageDisplayName(language)}>
							{language}
							{language === refLanguage && <span className="dev-tag">ref</span>}
						</dt>
						<dd>
							{variants.length === 0 || variants.every((v) => patternText(v.pattern) === "") ? (
								<span className="dev-missing">Missing</span>
							) : (
								variants.map((variant, i) => (
									<div className="dev-variant" key={i}>
										{variant.match.length > 0 && (
											<span className="dev-match">{variant.match.join(", ")}</span>
										)}
										<span className="dev-text">{patternText(variant.pattern)}</span>
									</div>
								))
							)}
						</dd>
					</React.Fragment>
				);
			})}
		</dl>
	);
}

type DevModeViewProps = {
	figmaRemote: FigmaUtil;
	localizedLabelManager: LocalizedLabelManagerUI;
};

/** Read-only panel for Dev Mode: the message keys and translations of the selected texts. */
export default function DevModeView({ figmaRemote, localizedLabelManager }: DevModeViewProps) {
	const [labels, setLabels] = useState<UILocalizedLabel[]>([]);
	const [hasSelection, setHasSelection] = useState(false);
	const selectionRefresh = useRef(new LatestRequest());
	const { messageStore } = localizedLabelManager;

	async function refresh() {
		const revision = selectionRefresh.current.begin();
		const selection = await localizedLabelManager.getSelection();
		const selectedNodes = Object.values(selection);
		const frameIds = [
			...new Set(selectedNodes.map((node) => node.rootFrameId).filter(Boolean)),
		] as string[];
		const frameLabels = [] as UILocalizedLabel[];
		for (const frameId of frameIds) {
			frameLabels.push(...(await localizedLabelManager.getLocalizedLabelsByFrame(frameId)));
		}
		// frame by frame, top to bottom inside a frame
		const frameOrder = new Map(frameIds.map((frameId, i) => [frameId, i]));
		frameLabels.sort(
			(a, b) =>
				frameOrder.get(a.rootFrameId)! - frameOrder.get(b.rootFrameId)! || a.y - b.y || a.x - b.x,
		);
		if (!selectionRefresh.current.isCurrent(revision)) return;

		// selected texts only - or every text of the selected frames
		const directTexts = new Set(
			selectedNodes
				.filter((node) => node.isLabel && node.directSelection)
				.map((node) => node.selectedNodeId),
		);
		const shown =
			directTexts.size > 0
				? frameLabels.filter((label) => directTexts.has(label.nodeId))
				: frameLabels;
		setHasSelection(selectedNodes.length > 0);
		setLabels(shown);
	}

	useEffect(() => {
		refresh();
		const onMessage = (event: MessageEvent) => {
			if (
				event.data.pluginMessage?.type === "event" &&
				event.data.pluginMessage.name === "selectionchange"
			) {
				refresh();
			}
		};
		window.addEventListener("message", onMessage);
		localizedLabelManager.addEventListener("updated", refresh);
		messageStore.addEventListener("updated", refresh);
		return () => {
			window.removeEventListener("message", onMessage);
			localizedLabelManager.removeEventListener("updated", refresh);
			messageStore.removeEventListener("updated", refresh);
		};
	}, []);

	const languages = messageStore.getOrderedLanguages();
	const refLanguage = messageStore.getRefLanugage();

	function copyKey(key: string) {
		if (copyToClipboard(key)) {
			figmaRemote.notify(`Copied “${key}”`);
		} else {
			figmaRemote.notifyError("Could not copy the key");
		}
	}

	if (labels.length === 0) {
		return (
			<div className="dev-mode">
				<div className="dev-empty">
					<div className="dev-empty-title">
						{hasSelection ? "No texts in the selection" : "Select a text"}
					</div>
					<p>
						{hasSelection
							? "Parrot shows texts inside frames, groups, components and instances."
							: "Select a text layer or a frame to see its message keys and translations."}
					</p>
				</div>
			</div>
		);
	}

	const frameNames = [...new Set(labels.map((label) => label.rootFrameName))];
	const single = labels.length === 1;

	return (
		<div className="dev-mode">
			<div className="dev-summary">
				{single
					? labels[0].rootFrameName
					: `${labels.length} texts${frameNames.length === 1 ? ` in ${frameNames[0]}` : ""}`}
				{frameNames.length === 1 && labels[0].rootFrameLanguage && (
					<span className="dev-summary-language">
						{languageDisplayName(labels[0].rootFrameLanguage) ?? labels[0].rootFrameLanguage}
					</span>
				)}
			</div>
			<ul className="dev-list">
				{labels.map((label) => {
					const linked = label.messageLinkState === MessageLinkState.Linked;
					const message = linked ? messageStore.getMessage(label.messageId!) : undefined;
					const key = message?.id;
					return (
						<li className="dev-item" key={label.nodeId}>
							<details open={single}>
								<summary>
									<span className="dev-chevron" aria-hidden="true" />
									<span className="dev-main">
										{key ? (
											<span className="dev-key" title={key}>
												{key}
											</span>
										) : (
											<span className="dev-missing">
												{label.messageLinkState === MessageLinkState.Unmanaged
													? "Not translated"
													: "No message"}
											</span>
										)}
										<span className="dev-layer" title={label.name}>
											{frameNames.length > 1
												? `${label.rootFrameName} / ${label.name}`
												: label.name}
										</span>
									</span>
									{key && (
										<button
											type="button"
											className="dev-copy"
											aria-label={`Copy ${key}`}
											data-tooltip-content="Copy key"
											onClick={(e) => {
												e.preventDefault();
												copyKey(key);
											}}
										>
											Copy
										</button>
									)}
								</summary>
								{message ? (
									<Translations message={message} languages={languages} refLanguage={refLanguage} />
								) : (
									<p className="dev-plain">{label.characters}</p>
								)}
							</details>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
