import * as mixpanel from 'mixpanel-figma';
import * as pjs from '../../../package.json';
import posthog from 'posthog-js';

export function track(name: string, opts = {}) {
  if (process.env.MIXPANEL_ACCESS_TOKEN) {
    posthog.capture('parrot-' + name, opts);
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
  posthog.init('xxxx', {
    api_host: 'http://localhost:4005',
  });
}
