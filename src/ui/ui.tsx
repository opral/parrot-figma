import * as React from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import TimeAgo from "javascript-time-ago";
import en from "javascript-time-ago/locale/en.json";
import * as mixpanel from "mixpanel-figma";

import { track, identify, identifyProject } from "./utils/analytics";

import LocalizedLabelsListView from "./views/localizedlabelslist/LocalizedLabelsListView";
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
import FEATURES_FLAGS from "./featuretoggle";
import SetupView from "./views/setup/SetupView";
import * as pjs from "../../package.json";
import UserManager, { PluginUser, UserFileRole } from "../lib/usage/UsageManager";
import UserManagerUI from "../lib/usage/UsageManagerUI";
import UserManagement from "./views/usermanagement/Usermanagement";

import { InlangMessageStore } from "../lib/message/store/InlangMessageStoreFigmaRoot";
import { OverlayScrollbarsComponent } from "./compontents/overlayscrollbar";

import TranslatorMachine from "../lib/translationprovider/TranslatorMachine";
import Monitoring from "../lib/monitoring/MonitoringProxy";
import FeatureFlags from "../lib/featureflags/FeatureFlags";
import type { RealFigmaPerformanceSample } from "../lib/performance/RealFigmaPerformanceHarness";

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
			if (e.shiftKey) {
				document.execCommand("redoForce");
			} else {
				document.execCommand("undoForce");
			}
		}
	},
	true,
);

window.addEventListener("keydown", (e) => {
	if (
		e.key === "z" &&
		document.body.dataset.parrotTransactionLocked !== "true" &&
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

const monitoring = new Monitoring();
asyncFunctionProxy.registerInstance(monitoring);

const figmaRemote = new FigmaUtil();
asyncFunctionProxy.proxyAsyncMethods(figmaRemote);

figmaRemote.getFeatureFlags().then((featureFlags) => {
	FeatureFlags.setFeatureflags(featureFlags);
});

figmaRemote.getUserId().then((userId) => {
	identify(userId!);
});

Promise.all([figmaRemote.getInlangFileId()]).then(([fileId]) => {
	if (fileId) {
		track("file opened", { fileId });
		identifyProject({ projectId: fileId, properties: { name: fileId }, figmaRemote });
	}
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

declare global {
	interface Window {
		__PARROT_RUN_REAL_FIGMA_PERFORMANCE__?: (
			sizes?: number[],
			repetitions?: number,
		) => Promise<RealFigmaPerformanceSample[]>;
	}
}

if (location.hostname === "localhost") {
	const performanceHarness = new (class {
		proxyClassName = "RealFigmaPerformanceHarness";
		async run(_sizes?: number[], _repetitions?: number): Promise<RealFigmaPerformanceSample[]> {
			return [];
		}
	})();
	asyncFunctionProxy.proxyAsyncMethods(performanceHarness);
	window.__PARROT_RUN_REAL_FIGMA_PERFORMANCE__ = async (
		sizes = [100, 1_000, 5_000],
		repetitions = 3,
	) => {
		const samples = await Promise.race([
			performanceHarness.run(sizes, repetitions),
			new Promise<never>((_, reject) =>
				window.setTimeout(
					() => reject(new Error("The real-Figma performance run exceeded three minutes.")),
					180_000,
				),
			),
		]);
		console.table(samples);
		document.body.dataset.parrotPerformanceResult = JSON.stringify(samples);
		return samples;
	};
	const requestedSizes = new URLSearchParams(location.search).get("parrotPerformanceSizes");
	if (requestedSizes) {
		const sizes = requestedSizes
			.split(",")
			.map(Number)
			.filter((size) => Number.isSafeInteger(size) && size > 0);
		void window
			.__PARROT_RUN_REAL_FIGMA_PERFORMANCE__(sizes)
			.then((samples) => {
				document.body.dataset.parrotPerformanceResult = JSON.stringify(samples);
			})
			.catch((error) => console.error("Real-Figma performance run failed", error));
	}
}
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
	const [performanceStatus, setPerformanceStatus] = useState("Run real Figma performance");

	const [user, setUser] = useState(undefined as PluginUser | undefined);

	const [windowMode, setWindowMode] = useState(WindowManagerUi.instance!.windowMode);
	const [keyQuery, setKeyQuery] = useState(MessageStoreMemory.toQueryObject(""));

	useEffect(() => {
		// asynchronous fetch the state from figma helper
		(async () => {
			await userStateManagerUi.loadUserState();
			userStateManagerUi.trackFileUsageStatistics();

			if (windowMode === WindowMode.DevPanel) {
				const updatedUser = await userStateManagerUi.requestUserRole(UserFileRole.developer);
				setUser(updatedUser);
			} else {
				const updatedUser = await userStateManagerUi.requestUserRole(UserFileRole.designer);
				setUser(updatedUser);
			}
		})();

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
			localizedLabelManager.startFillupCache();

			let initialScreen = (await figmaRemote.getLocalFileConfig("lastView")) ?? "design";
			if (fileSetupCompleted === undefined || fileSetupCompleted === "") {
				initialScreen = "onboarding";
			}
			setAppScreen(initialScreen);
		})();
	}, []);

	useEffect(() => {
		if (appScreen) {
			track(`app_screen__${appScreen}`);
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

	if (!appScreen || !user) {
		return <>Loading Plugin</>;
	}
	let view;

	if (windowMode === WindowMode.DevPanel) {
		return (
			<>
				<Tooltip contentAttribute="data-tooltip-content" />
				<div className="view dev-panel">
					<div className="comming-soon">
						Parrot´s Dev Mode version is comming soon... <br />
						<br />
						Translate your Designs with Parrot in Design Mode in the meantime!
						<br />
						<br />
						🦜
					</div>
				</div>
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
						showSearchBar={false}
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

		case "export":
			view = <Export userManager={userStateManagerUi} labelManager={localizedLabelManager} />;
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
		case "users":
			view = <UserManagement userManager={userStateManagerUi} />;
			break;
		default:
			break;
	}

	return (
		<>
			{location.hostname === "localhost" && (
				<button
					style={{ position: "fixed", right: 8, bottom: 8, zIndex: 10000 }}
					disabled={performanceStatus.startsWith("Running")}
					onClick={() => {
						setPerformanceStatus("Running real Figma performance…");
						void window
							.__PARROT_RUN_REAL_FIGMA_PERFORMANCE__?.([500, 5_000], 3)
							.then((samples) => setPerformanceStatus(`Performance ${JSON.stringify(samples)}`))
							.catch((error) => setPerformanceStatus(`Performance error: ${String(error)}`));
					}}
				>
					{performanceStatus}
				</button>
			)}
			<Tooltip contentAttribute="data-tooltip-content" />
			<div className="toolbar">
				<div className="tabHeader">
					<div
						className={`tab ${appScreen === "design" ? "active" : ""}`}
						onClick={() => setAppScreen("design")}
					>
						Layers
					</div>
					<div
						className={`tab ${appScreen === "messages" ? "active" : ""}`}
						onClick={() => {
							setKeyQuery(MessageStoreMemory.toQueryObject(""));
							setAppScreen("messages");
						}}
					>
						Messages
					</div>
					{FEATURES_FLAGS.export && (
						<div
							className={`tab ${appScreen === "export" ? "active" : ""}`}
							onClick={() => setAppScreen("export")}
						>
							{FEATURES_FLAGS.versioning ? "Versions & Export" : "Export"}
						</div>
					)}
					<div
						className={`tab ${appScreen === "settings" ? "active" : ""}`}
						onClick={() => setAppScreen("settings")}
					>
						Setup
					</div>
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
								tooltip: "Use as Window",
							},
							{
								iconName: "window-mode-fullscreen-svg",
								value: WindowMode.Fullscreen,
								tooltip: "Switch to Fullscreen",
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
