import * as mixpanel from 'mixpanel-figma';
import posthog from 'posthog-js';
import { InlangProject } from '@inlang/sdk';
import * as pjs from '../../../package.json';

let projectId: string | undefined;

export function track(name: string, opts = {}) {
  if (process.env.MIXPANEL_ACCESS_TOKEN) {
    posthog.capture(`parrot-${name}`, opts);
  } else {
    console.log(`tracking: ${name} ${JSON.stringify(opts)}`);
  }
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

export function identifyProject(args: {
  projectId: string,
  properties: Record<string, any>
}) {
  if (typeof process.env.PUBLIC_POSTHOG_TOKEN === 'undefined') return;
  projectId = args.projectId;
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

export function captureLoadProjectEvent(inlangProject: InlangProject) {
  // capture project loaded event using the Figma file id
  if (projectId) {
    posthog.capture('SDK loaded project', {
      projectId,
      appId: 'app.parrot.figmaPlugin',
      settings: inlangProject?.settings(),
      // TODO: fix for v2Persistence
      // https://github.com/opral/inlang-message-sdk/issues/78
      numberOfMessages: inlangProject?.query.messages.includedMessageIds().length,
    });
  }
}
