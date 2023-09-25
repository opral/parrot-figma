import { Plugin } from '@inlang/sdk';
// import { id, displayName, description } from "../marketplace-manifest.json"
import { createMessage } from '@inlang/sdk/test-utilities';

// eslint-disable-next-line import/prefer-default-export
export const plugin: Plugin = {
  // id: id as Plugin["id"],
  id: 'plugin.organization.pluginName' as Plugin['id'],
  displayName: { en: 'test' } as Plugin['displayName'],
  description: { en: 'test' } as Plugin['description'],
  // displayName,
  // description,
  loadMessages: async () => {
    debugger;
    const fakeMessages = [
      createMessage('this-is-a-test-message', {
        en: 'Hello world!',
      }),
    ];
    return fakeMessages;
  },
  saveMessages: () => {

  },
};
