import * as mixpanel from "mixpanel-figma";
import FigmaUtil from "../../shared/FigmaUtil";

export function track(name: string, opts = {}) {
	void name;
	void opts;
}

export function identify(figmaUserId: string) {
	void figmaUserId;
}

export async function identifyProject(args: {
	projectId: string;
	properties: Record<string, any>;
	figmaRemote: FigmaUtil;
}) {
	void args;
}

export function setUserData(data: { [key: string]: any }) {
	if (process.env.MIXPANEL_ACCESS_TOKEN && "people" in mixpanel) {
		mixpanel.people.set(data);
	} else {
		console.log(`would set user property to ${JSON.stringify(data)}`);
	}
}

export async function captureLoadProjectEvent(figmaRemote: FigmaUtil) {
	void figmaRemote;
}
