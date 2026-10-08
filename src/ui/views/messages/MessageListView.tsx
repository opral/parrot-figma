import * as React from "react";
import { useEffect, useRef, useState } from "react";
import "../../localization/i18n";
import { useTranslation } from "react-i18next";

import { Locale, languageDisplayName } from "../../../lib/message/variants/Locale";
import Select, { SelectOption } from "../../compontents/select/select";

import MessageStoreMemory, { SearchQuery } from "../../../lib/message/store/MessageStoreMemory";
import FigmaUtil from "../../../shared/FigmaUtil";
import TranslationKeyListItem from "./MessageListItem";
import LazyMessageRow, { RowVisibilityRegistry } from "./LazyMessageRow";
import { Plural } from "../../../lib/message/variants/Plural";

import "./MessageView.css";
import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import { NodeSelection } from "../../../lib/localizedlabels/LocalizedLabelManager";
import { LatestRequest } from "../../utils/LatestRequest";

// rows are cheap placeholders until they get close to the viewport (see LazyMessageRow)
const renderChunkSize = 100;
const initiallyVisibleRows = 12;

/** rootMargin only grows the root, so observers must use the scroll container as root to look ahead */
function findScrollParent(element: HTMLElement | null): HTMLElement | null {
	for (let parent = element?.parentElement; parent; parent = parent.parentElement) {
		// OverlayScrollbars (deferred) turns this element into the scrolling viewport only after the first
		// render; its host (the next "scroll" ancestor) merely clips it, and a root that is not the
		// scroller itself ignores the margin.
		if (parent.hasAttribute("data-overlayscrollbars-contents")) return parent;
		const { overflowY } = getComputedStyle(parent);
		if (overflowY === "auto" || overflowY === "scroll") return parent;
	}
	return null;
}

type MessageListViewProps = {
	initialSearchQuery: SearchQuery;
	showSearchBar: boolean;
	messageStore: MessageStoreMemory;
	localizedLabelManager: LocalizedLabelManagerUI;
	figmaRemote: FigmaUtil;
	select?: (key: string, language: Locale, plural: Plural) => void;
	selectedMessageId?: string;
	highlightSelectedNodes: boolean;
};

export default function MessageListView({
	initialSearchQuery,
	showSearchBar,
	messageStore,
	localizedLabelManager,
	figmaRemote,
	select,
	selectedMessageId,
	highlightSelectedNodes,
}: MessageListViewProps) {
	const { t } = useTranslation();
	const [, setTrigger] = useState(0);
	const [renderEntries, setRenderEntries] = useState(renderChunkSize);
	const [selectedNodes, setSelectedNodes] = useState({} as NodeSelection);
	const [highlightSelection, setHighlightSelection] = useState(false);
	const selectionRefresh = useRef(new LatestRequest());

	// const [keys, setKeys] = useState: UITranslationKeys,
	const [searchQuery, setSearchQuery] = useState<SearchQuery>(initialSearchQuery);
	// "" = all messages, "*" = missing in any language, otherwise the language that is missing
	const [missingFilter, setMissingFilter] = useState("");

	const effectiveQuery: SearchQuery =
		missingFilter === ""
			? searchQuery
			: {
					...searchQuery,
					missingTranslation: true,
					missingTranslationLanguage: missingFilter === "*" ? undefined : (missingFilter as Locale),
				};
	// A message that is being edited stays in a "missing translation" list: it would vanish with the
	// first typed character (the translation is no longer missing) and take the focus - and the rest of
	// the typed text - with it.
	const [editedMessageId, setEditedMessageId] = useState<string | undefined>(undefined);
	const foundKeys = messageStore.findMessages(effectiveQuery, selectedNodes);
	const filteredKeys =
		missingFilter !== "" &&
		editedMessageId !== undefined &&
		!foundKeys.matchingNames.has(editedMessageId) &&
		messageStore.getMessage(editedMessageId) !== undefined
			? {
					...foundKeys,
					matchingNames: new Set(
						(messageStore.getAllMessages() ?? [])
							.map((message) => message.id)
							.filter((id) => id === editedMessageId || foundKeys.matchingNames.has(id)),
					),
				}
			: foundKeys;
	const tableRef = useRef<HTMLDivElement>(null);
	const loadMoreRef = useRef<HTMLDivElement>(null);

	// one observer for all rows; rows register their element before the observer exists
	const rowCallbacks = useRef(new Map<Element, (visible: boolean) => void>());
	const rowObserver = useRef<IntersectionObserver>(undefined);
	const registerRow = useRef<RowVisibilityRegistry>((element, onVisibilityChange) => {
		rowCallbacks.current.set(element, onVisibilityChange);
		rowObserver.current?.observe(element);
		return () => {
			rowCallbacks.current.delete(element);
			rowObserver.current?.unobserve(element);
		};
	}).current;
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					rowCallbacks.current.get(entry.target)?.(entry.isIntersecting);
				}
			},
			{ root: findScrollParent(tableRef.current), rootMargin: "1200px 0px" },
		);
		rowObserver.current = observer;
		for (const element of rowCallbacks.current.keys()) observer.observe(element);
		return () => {
			observer.disconnect();
			rowObserver.current = undefined;
		};
	}, []);

	async function refreshSelection(triggerHighlight: boolean) {
		if (highlightSelectedNodes) {
			const requestRevision = selectionRefresh.current.begin();
			const freshSelectedNodes = await localizedLabelManager.getSelection();
			if (!selectionRefresh.current.isCurrent(requestRevision)) return;

			setSelectedNodes(freshSelectedNodes);
			setHighlightSelection(triggerHighlight);
		}
	}

	useEffect(() => {
		const messageHandler = (event: any) => {
			if (
				event.data.pluginMessage.type === "event" &&
				event.data.pluginMessage.name === "selectionchange"
			) {
				refreshSelection(true);
			}
		};

		// asynchronous fetch the state from figma helper
		(async () => {
			await refreshSelection(false);
		})();

		const onUpdated = () => {
			setTrigger((v) => v + 1);
		};

		localizedLabelManager.addEventListener("updated", onUpdated);
		messageStore.addEventListener("updated", onUpdated);
		window.addEventListener("message", messageHandler);

		return () => {
			localizedLabelManager.removeEventListener("updated", onUpdated);
			messageStore.removeEventListener("updated", onUpdated);
			window.removeEventListener("message", messageHandler);
		};
	}, []);

	// Every row is a full editor; rendering thousands at once freezes the panel. Rows are rendered in
	// chunks: whenever the end of the list scrolls into view, the next chunk is added.
	const matchingCount = filteredKeys.matchingNames.size;
	const hasMoreEntries = matchingCount > renderEntries;
	useEffect(() => {
		const sentinel = loadMoreRef.current;
		if (!hasMoreEntries || !sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setRenderEntries((value) => value + renderChunkSize);
				}
			},
			{ root: findScrollParent(tableRef.current), rootMargin: "1200px 0px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [hasMoreEntries, renderEntries]);

	useEffect(() => {
		if (!tableRef.current || !highlightSelection) return;
		const selectedIds = new Set(Object.values(selectedNodes).map((node) => node.messageId));
		const firstSelectedId = [...filteredKeys.matchingNames].find((id) => selectedIds.has(id));
		if (firstSelectedId === undefined) {
			setHighlightSelection(false);
			return;
		}
		// the selected message might not be rendered yet (rows are added in chunks) - render up to it
		const index = [...filteredKeys.matchingNames].indexOf(firstSelectedId);
		if (index >= renderEntries) {
			setRenderEntries(index + renderChunkSize);
			return;
		}
		setHighlightSelection(false);
		const row = [...tableRef.current.querySelectorAll("[data-message-id]")].find(
			(element) => element.getAttribute("data-message-id") === firstSelectedId,
		);
		(row as any)?.scrollIntoViewIfNeeded?.({ block: "center" });
	}, [highlightSelection, renderEntries]);

	const allMessages = messageStore.getAllMessages() ?? [];

	const fileHasMessages = allMessages.length > 0;
	if (!fileHasMessages) {
		return (
			<div className="emptyState">
				<div className="emptyStateTitle">No messages yet</div>
				<div className="emptyStateSubtitle">
					A message holds the text of your design in every language. Create one by linking a text
					layer in the Layers tab, or add existing translations in the Import tab.
				</div>
			</div>
		);
	}

	const updateQuery = (newQuery: SearchQuery) => {
		setSearchQuery(newQuery);
	};

	const onSearchChange = (searchString: string) => {
		setSearchQuery(MessageStoreMemory.toQueryObject(searchString));
	};

	const missingLabel = (filter: string) =>
		filter === "*"
			? "Missing in any language"
			: `Missing in ${languageDisplayName(filter) ?? filter}`;

	const missingFilterOptions = (): SelectOption[] => {
		const countMissing = (language?: Locale) =>
			messageStore.findMessages({
				...MessageStoreMemory.toQueryObject(""),
				missingTranslation: true,
				missingTranslationLanguage: language,
			}).matchingNames.size;
		return [
			{ value: "", label: "All messages", tag: `${allMessages.length}` },
			{ divider: true, value: "divider", label: "" },
			{ value: "*", label: missingLabel("*"), tag: `${countMissing()}` },
			...messageStore.getOrderedLanguages().map((language) => ({
				value: language,
				label: missingLabel(language),
				tag: `${countMissing(language)}`,
			})),
		];
	};

	const longestKey = allMessages
		.map((message) => message.id)
		.reduce((acc, id) => (id.length > acc.length ? id : acc), "");

	const selectedMessageIds = new Set(Object.values(selectedNodes).map((node) => node.messageId));

	let rendered = 0;

	return (
		<div className={`message-view${showSearchBar ? " message-view-searchable" : ""}`}>
			{showSearchBar && (
				<div className="message-filter">
					<div className="message-filter-search">
						<span className="svg-container search-svg" />
						<input
							type="text"
							placeholder="Search messages…"
							aria-label="Search messages"
							className="message-filter-search-input"
							spellCheck="false"
							dir="auto"
							value={MessageStoreMemory.toSearchString(searchQuery)}
							onChange={(e) => {
								onSearchChange(e.target.value);
								setRenderEntries(100);
							}}
						/>
					</div>
					<Select
						className={`message-filter-missing${missingFilter !== "" ? " message-filter-missing--active" : ""}`}
						tooltip="Show messages without a translation"
						placeholder="All messages"
						checkmark
						defaultValue={{
							value: missingFilter,
							label: missingFilter === "" ? "All messages" : missingLabel(missingFilter),
						}}
						getOptions={missingFilterOptions}
						onChange={(option) => {
							setMissingFilter(String(option.value));
							setRenderEntries(100);
						}}
					/>
				</div>
			)}

			<div
				className="message-list"
				ref={tableRef}
				onFocusCapture={(event) => {
					if (missingFilter === "") return;
					const row = (event.target as Element).closest("[data-message-id]");
					setEditedMessageId(row?.getAttribute("data-message-id") ?? undefined);
				}}
				onBlurCapture={() => {
					if (missingFilter === "") return;
					// focus moving to another row sets the new id first - only a focus that left the list clears it
					setTimeout(() => {
						if (!tableRef.current?.contains(document.activeElement)) setEditedMessageId(undefined);
					}, 0);
				}}
			>
				{/* helper row for css to set the width when partially rendered */}

				<TranslationKeyListItem
					key="max-width-helper-row"
					rowClassNames="hidden-helper-row"
					messageStore={messageStore}
					localizedLabelManager={localizedLabelManager}
					searchMatch={undefined}
					messageId={longestKey}
					figmaRemote={figmaRemote}
					select={select}
					messageSelected={false}
				/>
				{[...filteredKeys.matchingNames].length === 0 &&
					(missingFilter !== "" && !searchQuery.text && !searchQuery.name ? (
						<div className="emptyState">
							<div className="emptyStateTitle">Nothing is missing</div>
							<div className="emptyStateSubtitle">
								{missingFilter === "*"
									? "Every message has a text in every language."
									: `Every message has a ${languageDisplayName(missingFilter) ?? missingFilter} translation.`}
							</div>
						</div>
					) : (
						<div className="emptyState">
							<div className="emptyStateTitle">No messages match your search</div>
							<div className="emptyStateSubtitle">
								{missingFilter !== ""
									? `Try a different key or text, or show all messages instead of “${missingLabel(missingFilter)}”.`
									: "Try a different key or part of the text."}
							</div>
						</div>
					))}
				{[...filteredKeys.matchingNames].map((messageId) => {
					if (rendered >= renderEntries) {
						return;
					}

					rendered += 1;

					return (
						<LazyMessageRow
							key={messageId}
							messageId={messageId}
							initiallyVisible={rendered <= initiallyVisibleRows}
							register={registerRow}
						>
							<TranslationKeyListItem
								messageStore={messageStore}
								localizedLabelManager={localizedLabelManager}
								searchMatch={filteredKeys.matches[messageId]}
								messageId={messageId}
								figmaRemote={figmaRemote}
								select={select}
								messageSelected={
									selectedMessageIds.has(messageId) || selectedMessageId === messageId
								}
							/>
						</LazyMessageRow>
					);
				})}
				{hasMoreEntries && <div ref={loadMoreRef} className="message-list-load-more" />}
			</div>
		</div>
	);
}
