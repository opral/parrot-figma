import * as mixpanel from 'mixpanel-figma';
import posthog from 'posthog-js';
import * as pjs from '../../../package.json';
import FigmaUtil from '../../shared/FigmaUtil';

export function track(name: string, opts = {}) {
  posthog.capture(`PARROT ${name}`, opts);
}

export function identify(figmaUserId: string) {
  if (figmaUserId) {
    posthog.identify(figmaUserId, {
      // USER_ID: userId,
      FIGMA_USER_ID: figmaUserId,
      // NAME: name,
      version: pjs.version,
    });
  }
}

export async function identifyProject(args: {
  projectId: string,
  properties: Record<string, any>,
  figmaRemote: FigmaUtil
}) {
  if (typeof process.env.PUBLIC_POSTHOG_TOKEN === 'undefined') return;
  await args.figmaRemote.setRootPluginData('projectId', args.projectId);
  try {
    posthog.group('project', args.projectId, {
      name: args.projectId,
    });
  } catch (e) {
    // TODO implement sentry logging
    // do not console.log and avoid exposing internal errors to the user
  }
}

// TODO Update user data
export function setUserData(data: { [key: string]: any }) {
  if (process.env.MIXPANEL_ACCESS_TOKEN && 'people' in mixpanel) {
    mixpanel.people.set(data);
  } else {
    console.log(`would set user property to ${JSON.stringify(data)}`);
  }
}

export function initializeAnalytics() {
  //   if (process.env.MIXPANEL_ACCESS_TOKEN) {
  //     mixpanel.init(process.env.MIXPANEL_ACCESS_TOKEN, {
  //       disable_cookie: true,
  //       disable_persistence: true,
  //       api_host: 'https://api-eu.mixpanel.com',
  //     });
  //   }
  posthog.init(process.env.PUBLIC_POSTHOG_TOKEN ?? '', {
    api_host: process.env.ENVIRONMENT === 'production' ? 'https://telemetry.inlang.com' : 'http://localhost:4006',
  });
}

export async function captureLoadProjectEvent(figmaRemote: FigmaUtil) {
  const projectId = await figmaRemote.getRootPluginData('projectId');
  const inlangProjectSettings = await figmaRemote.getRootPluginData('inlangProjectSettings');
  const numberOfMessagesWithKeys = await figmaRemote.getRootPluginData('numberOfMessagesWithKeys');
  const numberOfMessages = await figmaRemote.getRootPluginData('numberOfMessages');

  if (projectId && inlangProjectSettings && numberOfMessagesWithKeys) {
    posthog.capture('SDK loaded project', {
      projectId,
      appId: 'app.parrot.figmaPlugin',
      settings: JSON.parse(inlangProjectSettings),
      numberOfMessages: Number(numberOfMessages),
      numberOfMessagesWithKeys: Number(numberOfMessagesWithKeys),
    });
  }
}
