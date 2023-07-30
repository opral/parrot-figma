// TODO use the local storage for now - information will be sourced by the backend later

import { Language } from '../base/Language';

// TODO translated characters:
// this thing is tricky because it will need to calculate based on different files
// if a user a uses file a and user b uses file b i cant know the amount of characters translated

/**
 * Performs a deep merge of `source` into `target`.
 * Mutates `target` only but not its objects and arrays.
 *
 * @author inspired by [jhildenbiddle](https://stackoverflow.com/a/48218209).
 */
function mergeDeep(target: any, source: any) {
  const isObject = (obj: any) => obj && typeof obj === 'object';

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  Object.keys(source).forEach((key) => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      target[key] = targetValue.concat(sourceValue);
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = mergeDeep({ ...targetValue }, sourceValue);
    } else {
      target[key] = sourceValue;
    }
  });

  return target;
}

function generateGUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    // eslint-disable-next-line no-bitwise
    const r = (Math.random() * 16) | 0;
    // eslint-disable-next-line no-bitwise
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

enum UserType {
  owner = 'owner',
  designer = 'designer',
  developer = 'developer',
}

interface UserInFile {
  userId: string,
  userTypeStates: {
    [time: number]: {
      requestedState: UserType,
      actorId: string,
      type: 'request' | 'set' | 'reject'
    }
  },
  translations: {
    [time: number]: {
      chars: number,
      sourceLang: Language,
      targetLang: Language,
    }
  }
/*
    public async getCurrentState() {

    }

    public async getRequestedState() {

    } */
}

interface FileUsage {
  fileId: string,
  usersInFile: {
    [userID: string]: UserInFile
  }
}

interface UserStorage {
  [fileId: string]: FileUsage
}

const clientStorageKeyPrefix = 'userStorage_';
const fileStorageKey = 'fileStorage';

export default class UsageManager {
  state: FileUsage;

  localStorageStateIntegrated: Promise<void>;

  rootNodeId: string;

  constructor() {
    const fileState = this.loadFileStateFromRoot();
    this.state = fileState;
    this.localStorageStateIntegrated = (async () => {
      const localStorageState = await this.loadFileStateFromLocalStorage(fileState.fileId);
      this.state = this.mergeStates(localStorageState, fileState);
      await this.propagateState(false);
    })();

    this.rootNodeId = figma.root.id;

    figma.on('documentchange', (event: any) => {
      for (const change of event.documentChanges) {
        if (change.id === this.rootNodeId
                    && change === 'PROPERTY_CHANGE'
                    && change.properties.includes('pluginData')) {
          const newFileState = this.loadFileStateFromRoot();
          this.state = this.mergeStates(this.state, newFileState);

          // we don't have to wait for the propagation here
          this.propagateState();
        }
      }
    });
    // TODO listen on changes to integrate them into memory and update client state evntually
  }

  loadFileStateFromRoot(): FileUsage {
    const fileStateRaw = figma.root.getPluginData(fileStorageKey);
    if (fileStateRaw !== '') {
      return JSON.parse(fileStateRaw) as FileUsage;
    }
    const newFileId = generateGUID();
    console.log(`File seen by the plugin the first time - returngin with new ID ${newFileId}`);
    return {
      fileId: generateGUID(),
      usersInFile: {},
    };
  }

  async loadFileStateFromLocalStorage(fileId: string): Promise<FileUsage> {
    const userLocalState = await figma.clientStorage.getAsync(clientStorageKeyPrefix + fileId);
    if (userLocalState) {
      return userLocalState as FileUsage;
    }
    return {
      fileId,
      usersInFile: {},
    };
  }

  mergeStates(localState: FileUsage, fileState: FileUsage) {
    if (!localState.fileId) {
      return fileState;
    }

    if (localState.fileId != fileState.fileId) {
      throw new Error('file id differs');
    }

    return mergeDeep(localState, fileState) as FileUsage;
  }

  async propagateState(awaitLocalStateIntegrated = true) {
    if (awaitLocalStateIntegrated) {
      await this.localStorageStateIntegrated;
    }

    // merge two states together
    const currentFileStateRaw = figma.root.getPluginData(fileStorageKey);

    // write files state to root documents root node
    const newFileStateRaw = JSON.stringify(this.state);
    if (currentFileStateRaw !== newFileStateRaw) {
      figma.root.setPluginData(fileStorageKey, newFileStateRaw);
    }

    // write user state to localState
    await figma.clientStorage.setAsync(clientStorageKeyPrefix + this.state.fileId, this.state);
  }
}

/*
usage:

client storage cumulates the information and syncs into files open for the file

// file global property
file: {
    fileID: GUID
    users: {
        userId: {
            currentRole: owner|designer|dev
            states: {
                1231234123: { requestRole: owner|designer|dev }
                1231234124: { receivedRole: owner|designer|dev }
            },
            usage: {
                123124123: {role: owner|designer, characters: 30, from: 'de', to: 'en'},
            }
        }
    }
}

// users local storage
user: {
    files: {
        fileID(GUID): {
            userId: {
                currentRole: owner|designer|dev
                states: {
                    1231234123: { requestRole: owner|designer|dev }
                    1231234124: { receivedRole: owner|designer|dev }
                }
                usage: {
                    123124123: {role: owner|designer, characters: 30, from: 'de', to: 'en'},
                }
            }
        }
    }
}

// methods:
getCurrentUsers() {
    this.getUsers();
}

requestRole(role) {
    // check if role is available
    // if role is available return role
    //   - update role
    //   - return role
}

getRole(user) {
    // return the current role and the currently requested role if any
}

syncState(user) {
    if (user !== currentUser) {
        // throw
    }
    // TODO meger states and store it in the user and in the file
    // TODO merge usage for the current file and store it in the user and in the file
    // TODO uverride users role with the one found in the file
}
*/
