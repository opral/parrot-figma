import * as React from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en.json";

import LocalizedLabelsListView from "./views/localizedlabelslist/LocalizedLabelsListView";
import DevModeView from "./views/devmode/DevModeView";
import CloudView from "./views/cloud/CloudView";
import { capture, identifyTelemetry } from "../lib/telemetry/Telemetry";
import MachineTranslationContact from "./compontents/machineTranslation/MachineTranslationContact";
import FigmaUtil from "../shared/FigmaUtil";
import { AsyncFunctionProxy } from "../lib/rpc/AsyncFunctionProxy";
import "./ui.css";
import "overlayscrollbars/overlayscrollbars.css";
import WindowManagerUi from "../lib/windowManager/WindowManagerUI";
import { WindowMode } from "../lib/windowManager/WindowManagerSandbox";
import MessageListView from "./views/messages/MessageListView";
import MessageStoreMemory from "../lib/message/store/MessageStoreMemory";

import LocalizedLabelManager from "../lib/localizedlabels/LocalizedLabelManager";
import LocalizedLabelManagerUI from "../lib/localizedlabels/LocalizedLabelManagerUI";

import "./tabbar.css";
import "./assets/icons.css";
import SegmentedControl from "./compontents/segmentedControl/SegmentedControl";
import Onboarding from "./views/onboarding/Onboarding";
import Tooltip from "./compontents/tooltip/Tooltip";

import Export from "./views/export/Export";
import ImportView from "./views/import/ImportView";
import FEATURES_FLAGS from "./featuretoggle";
import SetupView from "./views/setup/SetupView";
import * as pjs from "../../package.json";
import UserManager, { PluginUser, UserFileRole } from "../lib/usage/UsageManager";
import UserManagerUI from "../lib/usage/UsageManagerUI";
import UserManagement from "./views/usermanagement/Usermanagement";

import { InlangMessageStore } from "../lib/message/store/InlangMessageStoreFigmaRoot";
import { OverlayScrollbarsComponent } from "./compontents/overlayscrollbar";

import TranslatorMachine from "../lib/translationprovider/TranslatorMachine";
import FeatureFlags from "../lib/featureflags/FeatureFlags";

console.log(`Starting Figma UI - Version ${pjs.version}`);

TimeAgo.addDefaultLocale(en);

const monkeyPatchCommandExec = document.execCommand;

document.execCommand = function () {
	// eslint-disable-next-line prefer-rest-params
	if (arguments[0] === "undo" || arguments[0] === "redo") {
		return false;
	}

	// eslint-disable-next-line prefer-rest-params
	if (arguments[0] === "undoForce") {
		return monkeyPatchCommandExec.call(document, "undo");
	}

	// eslint-disable-next-line prefer-rest-params
	if (arguments[0] === "redoForce") {
		return monkeyPatchCommandExec.call(document, "redo");
	}
	// eslint-disable-next-line prefer-rest-params
	return monkeyPatchCommandExec.apply(document, arguments as any);
};

const undoHandledByTextField = new WeakSet<Event>();

document.addEventListener(
	"keydown",
	(e) => {
		// Handle Select All, Undo and Redo in the desktop app
		if (
			e.keyCode === 65 &&
			/* A */ e.metaKey &&
			!(e.target! as any).classList.contains("cm-content")
		) {
			document.execCommand("selectAll");
		} else if (e.keyCode === 90 /* Z */ && e.metaKey) {
			// In a text field Cmd+Z is the undo of that field and nothing else: if Figma undid the
			// document as well (see the listener below) the layers, the message and the field would no
			// longer match. Outside of a text field it is Figma's undo only - the document-wide text undo
			// (execCommand) would silently revert the last typed text of a field that has no focus.
			const target = e.composedPath()[0] as HTMLElement | undefined;
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target?.isContentEditable
			) {
				undoHandledByTextField.add(e);
				if (e.shiftKey) {
					document.execCommand("redoForce");
				} else {
					document.execCommand("undoForce");
				}
			}
		}
	},
	true,
);

window.addEventListener("keydown", (e) => {
	if (
		e.key === "z" &&
		!undoHandledByTextField.has(e) &&
		!e.shiftKey &&
		!e.altKey &&
		!(e.target! as any).classList.contains("cm-content")
	) {
		// Undo the action in Figma
		const isMac = navigator.userAgent.indexOf("Macintosh") >= 0;
		const isCmd = isMac && e.metaKey && !e.ctrlKey;
		const isCtrl = !isMac && !e.metaKey && e.ctrlKey;
		if (isCmd || isCtrl) {
			window.parent.postMessage({ pluginMessage: { type: "undo" }, pluginId: "*" }, "*");
		}
	}
});

function renderCssVariables(vars: any) {
	return (
		Object.entries(vars)
			.map((entry: any) => entry.join(": "))
			.join("; ") + ";"
	);
}

window.addEventListener(
	"message",
	(event) => {
		if (
			event.source === window.parent.parent.parent &&
			event.data &&
			typeof event.data === "object" &&
			"figmaMessage" in event.data
		) {
			event.stopImmediatePropagation();

			const { figmaMessage } = event.data;

			if (figmaMessage.type === "THEME") {
				const figmaStyle = document.getElementById("figma-style")!;
				figmaStyle.textContent = `:root { ${renderCssVariables(figmaMessage.payload.variables)} }`;
			}
		}
	},
	true,
);

const resizeHandle = document.getElementById("resize-handle")!;
const resizeHeightHandle = document.getElementById("height-resize-handle")!;

WindowManagerUi.init(
	document.getElementById("sizing-wrapper")!,
	document.getElementById("react-page")!,
	resizeHandle,
	resizeHeightHandle,
	"toolbar-resize-handle",
);

const asyncFunctionProxy = new AsyncFunctionProxy(
	"UIAsyncFunctionProxy",
	(data: any) => {
		parent.postMessage(
			{
				pluginMessage: data,
				pluginId: "*",
			},
			"*",
		);
	},
	window,
);


const figmaRemote = new FigmaUtil();
asyncFunctionProxy.proxyAsyncMethods(figmaRemote);

figmaRemote.getFeatureFlags().then((featureFlags) => {
	FeatureFlags.setFeatureflags(featureFlags);
});

const translationMachine = new TranslatorMachine();
asyncFunctionProxy.proxyAsyncMethods(translationMachine);

const checkVersion = async () => {
	const minVersionRequest = await fetch("https://parrot-global.github.io/parrot/min-version.json", {
		cache: "no-cache",
	});
	const { minVersion } = await minVersionRequest.json();
	const figVersion = Number.parseInt(pjs.version.split(".")[2], 10);
	console.log(`Current Version: ${figVersion} Minimum version ${minVersion}`);
	if (minVersion > figVersion) {
		if (document.getElementById("version-outdated")) {
			document.getElementById("version-outdated")!.classList.remove("gone");
			document.getElementById("version-outdated")!.classList.add("visible");
		}
	}
};

const versionCheckInterval = 1000 * 40;
// we use any here since NodeJS.Timout - the suggested type by the ide is not correct
// checkVersion().catch(console.log);
// setInterval(() => {
//   checkVersion().catch(console.log);
// }, versionCheckInterval);

const userStateManagerSandbox = new UserManager(true);
asyncFunctionProxy.proxyAsyncMethods(userStateManagerSandbox);
const userStateManagerUi = new UserManagerUI(userStateManagerSandbox);
const figmaFileTranslationKeyStore = new InlangMessageStore(true);

asyncFunctionProxy.proxyAsyncMethods(figmaFileTranslationKeyStore);
const memoryTranslationKeyStore = new MessageStoreMemory(figmaFileTranslationKeyStore, figmaRemote);

const remoteLocalizedLabelManager = new LocalizedLabelManager();
asyncFunctionProxy.proxyAsyncMethods(remoteLocalizedLabelManager);
const localizedLabelManager = new LocalizedLabelManagerUI(
	remoteLocalizedLabelManager,
	memoryTranslationKeyStore,
	figmaRemote,
);

enum LicenseState {
	unvalidated,
	validating,
	valid,
	activatedAlready,
	used,
	invalid,
}

function App() {
	// initial app screen is startup until we initialy loaded the data
	const [appScreen, setAppScreen] = useState(undefined as string | undefined);
	const [startupError, setStartupError] = useState<string>();

	const [user, setUser] = useState(undefined as PluginUser | undefined);

	const [windowMode, setWindowMode] = useState(WindowManagerUi.instance!.windowMode);
	const [keyQuery, setKeyQuery] = useState(MessageStoreMemory.toQueryObject(""));

	useEffect(() => {
		// asynchronous fetch the state from figma helper
		(async () => {
			await userStateManagerUi.loadUserState();

			if (windowMode === WindowMode.DevPanel) {
				const updatedUser = await userStateManagerUi.requestUserRole(UserFileRole.developer);
				setUser(updatedUser);
			} else {
				const updatedUser = await userStateManagerUi.requestUserRole(UserFileRole.designer);
				setUser(updatedUser);
			}
		})().catch((error) => setStartupError(error instanceof Error ? error.message : String(error)));

		const onUsersUpdated = (event: any) => {
			console.log("onUsersUpdated");
		};

		const onCurrentUserUpdated = (event: any) => {
			setUser(userStateManagerUi.getCurrentUser());
		};

		userStateManagerUi.addEventListener("usersUpdated", onUsersUpdated);
		userStateManagerUi.addEventListener("currentUserUpdated", onCurrentUserUpdated);
		return () => {
			userStateManagerUi.removeEventListener("usersUpdated", onUsersUpdated);
			userStateManagerUi.removeEventListener("currentUserUpdated", onCurrentUserUpdated);
		};
	}, []);

	useEffect(() => {
		// asynchronous fetch the state from figma helper
		(async () => {
			console.log("load - keys");

			const fileSetupCompleted = await figmaRemote.getRootPluginData("fileSetupCompleted");

			await localizedLabelManager.prepare();
			await memoryTranslationKeyStore.load();

			// project size, once every layer of the file has been looked at
			localizedLabelManager.addEventListener(
				"linksLoaded",
				async () => {
					const [users, linkedLayers, frames] = await Promise.all([
						userStateManagerUi.getUsers(),
						figmaRemote.getRootPluginData("numberOfLinkedTextNodes"),
						figmaRemote.getRootPluginData("numberOfFrames"),
					]);
					capture("project:project_view", {
						message_count: memoryTranslationKeyStore.getAllMessages()?.length ?? 0,
						language_count: memoryTranslationKeyStore.getOrderedLanguages().length,
						collaborator_count: users.length,
						linked_layer_count: Number(linkedLayers) || 0,
						frame_count: Number(frames) || 0,
					});
				},
				{ once: true },
			);
			localizedLabelManager.startFillupCache();

			const [userId, fileId] = await Promise.all([
				figmaRemote.getUserId(),
				figmaRemote.getInlangFileId(),
			]);
			identifyTelemetry({ userId, fileId, version: pjs.version });
			capture("app:session_start");

			let initialScreen = (await figmaRemote.getLocalFileConfig("lastView")) ?? "design";
			if (fileSetupCompleted === undefined || fileSetupCompleted === "") {
				initialScreen = "onboarding";
			}
			setAppScreen(initialScreen);
		})().catch((error) => setStartupError(error instanceof Error ? error.message : String(error)));
	}, []);

	useEffect(() => {
		if (appScreen) {
			figmaRemote.setLocalFileConfig("lastView", appScreen);
		}
	}, [appScreen]);

	useEffect(() => {
		function windowModeUpdated() {
			setWindowMode(WindowManagerUi.instance!.windowMode);
		}

		WindowManagerUi.instance!.addEventListener("changed", windowModeUpdated);

		return () => {
			WindowManagerUi.instance!.removeEventListener("changed", windowModeUpdated);
		};
	}, []);

	if (startupError) {
		return (
			<div role="alert" className="startup-message">
				<div className="startup-message-title">Parrot could not open this file</div>
				<p>{startupError}</p>
				<button
					type="button"
					className="button button-primary"
					style={{ marginLeft: 0 }}
					onClick={() => window.location.reload()}
				>
					Retry
				</button>
			</div>
		);
	}

	if (!appScreen || !user) {
		return (
			<div className="startup-message" role="status">
				Loading Parrot…
			</div>
		);
	}
	let view;

	if (windowMode === WindowMode.DevPanel) {
		return (
			<>
				<Tooltip contentAttribute="data-tooltip-content" />
				<OverlayScrollbarsComponent
					className="view dev-panel"
					options={{ showNativeOverlaidScrollbars: true }}
					defer
				>
					<DevModeView figmaRemote={figmaRemote} localizedLabelManager={localizedLabelManager} />
				</OverlayScrollbarsComponent>
			</>
		);
	}

	if (user.userRole !== UserFileRole.designer && user.userRole !== UserFileRole.owner) {
		return (
			<>
				Not the permission to view{" "}
				{user.openUserRoleRequest !== undefined ? `${user.openUserRoleRequest} requested` : " -"}
			</>
		);
	}

	if (windowMode === WindowMode.Minimized) {
		return (
			<>
				<Tooltip contentAttribute="data-tooltip-content" />
				<div className="toolbar">
					<select>
						<option>test</option>
						<option>test</option>
						<option>test</option>
						<option>test</option>
						<option>test</option>
						<option>test</option>
						<option>test</option>
						<option>test</option>
						<option>test</option>
						<option>test</option>
						<option>test</option>
					</select>

					<div className="window-control">
						<SegmentedControl
							segments={[
								{
									iconName: "window-mode-window-svg",
									value: WindowMode.Window,
									tooltip: "Window Mode",
								},
							]}
							selectedSegment={windowMode}
							onChoose={(choosenWindowMode: WindowMode) => {
								WindowManagerUi.instance?.requestWindowMode(choosenWindowMode, false);
							}}
						/>
					</div>
				</div>
			</>
		);
	}

	const openTab = (screen: string) => {
		if (screen === "messages") setKeyQuery(MessageStoreMemory.toQueryObject(""));
		setAppScreen(screen);
	};

	switch (appScreen) {
		case "onboarding":
			return (
				<>
					<Tooltip contentAttribute="data-tooltip-content" />
					<Onboarding
						labelManager={localizedLabelManager}
						onFinishSetup={async () => {
							await figmaRemote.setRootPluginData("fileSetupCompleted", "true");
							WindowManagerUi.instance?.requestWindowMode(WindowMode.Window, false);
							await memoryTranslationKeyStore.load();
							setAppScreen("design");
						}}
					/>
				</>
			);
		case "messages":
			view = (
				<>
					<MessageListView
						showSearchBar
						initialSearchQuery={keyQuery}
						messageStore={memoryTranslationKeyStore}
						localizedLabelManager={localizedLabelManager}
						figmaRemote={figmaRemote}
						highlightSelectedNodes
					/>
				</>
			);
			break;
		case "settings":
			view = (
				<>
					<SetupView labelManager={localizedLabelManager} />
				</>
			);
			break;

		case "import":
			view = <ImportView labelManager={localizedLabelManager} figmaRemote={figmaRemote} />;
			break;
		case "export":
			view = <Export labelManager={localizedLabelManager} figmaRemote={figmaRemote} />;
			break;
		case "design":
			view = (
				<>
					<LocalizedLabelsListView
						showMessage={(messageName: string) => {
							setKeyQuery(MessageStoreMemory.toQueryObject(`name:${messageName}`));
							setAppScreen("messages");
						}}
						localizedLabelManager={localizedLabelManager}
						figmaRemote={figmaRemote}
					/>
				</>
			);
			break;
		case "cloud":
			view = <CloudView figmaRemote={figmaRemote} />;
			break;
		case "users":
			view = <UserManagement userManager={userStateManagerUi} />;
			break;
		default:
			break;
	}

	return (
		<>
			<Tooltip contentAttribute="data-tooltip-content" />
			<MachineTranslationContact figmaRemote={figmaRemote} />
			<div className="toolbar">
				<div className="tabHeader" role="tablist">
					{[
						["design", "Layers"],
						["messages", "Messages"],
						["import", "Import"],
						...(FEATURES_FLAGS.export
							? [["export", FEATURES_FLAGS.versioning ? "Versions & Export" : "Export"]]
							: []),
						["settings", "Setup"],
						["cloud", "Cloud"],
					].map(([screen, label]) => (
						<div
							key={screen}
							role="tab"
							tabIndex={0}
							aria-selected={appScreen === screen}
							className={`tab ${appScreen === screen ? "active" : ""}`}
							onClick={() => openTab(screen)}
							// the tab bar scrolls in narrow windows: keep the focused tab fully visible
							onFocus={(e) =>
								e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })
							}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									openTab(screen);
								}
							}}
						>
							{label}
						</div>
					))}
					{/* <div className={`tab ${appScreen === 'users' ? 'active' : ''}`} onClick={() => setAppScreen('users')}>Users</div> */}
				</div>

				<div
					id="toolbar-resize-handle"
					className="toolbar-resize-handle"
					style={{
						pointerEvents: "none",
						flexGrow: 1,
						display: "none",
					}}
				>
					<div className="svg-container resize-height" />
				</div>

				<div className="window-control">
					<SegmentedControl
						segments={[
							/* {
              iconName: 'window-mode-minimized-svg',
              value: WindowMode.Minimized,
              tooltip: 'Minimize',
            }, */ /* {
                iconName: 'window-mode-bottom-attached-svg',
                value: WindowMode.BottomSheet,
                tooltip: 'Dock to bottom',
              }, */
							{
								iconName: "window-mode-window-svg",
								value: WindowMode.Window,
								tooltip: "Window",
							},
							{
								iconName: "window-mode-fullscreen-svg",
								value: WindowMode.Fullscreen,
								tooltip: "Fullscreen",
							},
						]}
						selectedSegment={windowMode}
						onChoose={(choosenWindowMode: WindowMode) => {
							WindowManagerUi.instance?.requestWindowMode(choosenWindowMode, false);
						}}
					/>
				</div>
			</div>
			<OverlayScrollbarsComponent
				className="view"
				options={{
					showNativeOverlaidScrollbars: true,
					scrollbars: {
						clickScroll: true,
					},
				}}
				defer
			>
				{view}
			</OverlayScrollbarsComponent>
			<a id="focusHelper" href="" />
		</>
	);
}

const rootElement = document.getElementById("react-page");
if (!rootElement) throw new Error("Missing #react-page mount element");
createRoot(rootElement).render(<App />);
