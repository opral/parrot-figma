/* eslint-disable @typescript-eslint/no-loop-func */
import { NodeishFilesystem } from '@lix-js/fs';

import TextEncoding from 'text-encoding';
import normalPath from './utils/normalPath';
import { FilesystemError, NodeishStats, FileChangeInfo } from './types/NodishStats';
import { FigFsStats, FileType, figFsStatsToStats, newFigStats } from './types/FigFsStats';
import getDirname from './utils/getDirname';
import getBasename from './utils/getBasename';

const fileContentKeyPrefix = 'fs_fc_';
const fileStatsKeyPrefix = 'fs_fst_';

const encoder = new TextEncoding.TextEncoder();
const decoder = new TextEncoding.TextDecoder();

// TODO #28 define path matcher to define where data should be stored

/*
  storage considerations:

  # naiv
  fp_readme.md -> content
  fs_readme.md -> { modified: 12323 }

  - when an update of plugin data comes in:
  0. store all filepath that the ui read at least once (cached) - consider all files thousands
  1. go through all keys with prefix fs_
  2. deserialzize content of fs_readme, compare deserialzized version

  # Store hashed content

*/

export default class FigmaFsSandbox implements NodeishFilesystem {
  public proxyClassName = 'FigmaFsSandbox';

  listeners: Set<(event: FileChangeInfo) => void> = new Set();

  propagatedFileState: Map<string, string> = new Map();

  constructor(asProxy: boolean) {
    if (!asProxy) {
      for (const key of figma.root.getPluginDataKeys()) {
        if (key.startsWith(fileStatsKeyPrefix)) {
          this.propagatedFileState.set(key, figma.root.getPluginData(key));
        }
      }

      figma.on('documentchange', this.forwardDocumentChanges.bind(this));
    }
  }

  private async getStatsFromPluginData(path: string, lstat: boolean = false): Promise<FigFsStats> {
    if (path === '/') {
      const newFigStat = newFigStats(0, 0o755, FileType.Directory);
      return newFigStat;
    }

    const normalizedPath = normalPath(path);

    const statsRaw = figma.root.getPluginData(fileStatsKeyPrefix + normalizedPath);
    if (statsRaw === '') {
      throw new FilesystemError('ENOENT', path, 'stat');
    }

    const stats: FigFsStats = JSON.parse(statsRaw) as FigFsStats;
    if (!lstat && stats.st) {
      return this.getStatsFromPluginData(stats.st, lstat);
    }
    return stats;
  }

  async stat(path: string): Promise<NodeishStats> {
    const figFsStats = await this.getStatsFromPluginData(path, false);
    if (path === '/') {
      console.log(figFsStats);
      console.log(figFsStatsToStats(figFsStats));
    }
    return figFsStatsToStats(figFsStats);
  }

  async lstat(path: string): Promise<NodeishStats> {
    const figFsStats = await this.getStatsFromPluginData(path, true);
    return figFsStatsToStats(figFsStats);
  }

  private async readFileFromPluginData(path: string): Promise<{ content: string }> {
    const normalizedPath = normalPath(path);

    // TODO #28 filter by folder
    // if (path.startsWith('.git')) {
    //   return localStorage.
    // }

    // check fs stat first - we use this to distinguish between empty and deleted files - no way between plugin data unset or '' (see: https://www.figma.com/plugin-docs/api/node-properties/#getplugindata)
    const fileStats = await this.stat(path);
    if (fileStats.isDirectory()) {
      throw new FilesystemError('EISDIR', path, 'readFile');
    }

    const fileContentString = figma.root.getPluginData(`${fileContentKeyPrefix}${normalizedPath}`) ?? '';
    return { content: fileContentString };
  }

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: { encoding: 'utf-8' | 'binary'; }): Promise<string>;
  async readFile(path: any, options?: any): Promise<string | Uint8Array> {
    if (typeof path !== 'string') {
      throw new Error(`path other than string not supported - type found: ${typeof path}`);
    }

    const { content } = await this.readFileFromPluginData(path);

    if (options?.encoding || typeof options === 'string') {
      return content;
    }

    throw new Error('non string reads are not supported');
  }

  private async writeFileToPluginData(path: string, data: string, figFsStats: FigFsStats): Promise<void> {
    const normalizedPath = normalPath(path);
    const dirName = getDirname(normalizedPath);
    const baseName = getBasename(normalizedPath);

    try {
      const parentDirStats = await this.stat(dirName);
      if (!parentDirStats.isDirectory()) {
        // path exists but seems not to be a folder
        throw new FilesystemError('ENOENT', path, 'writeFile');
      }
    } catch (e: any) {
      throw new FilesystemError('ENOENT', path, 'writeFile');
    }

    figma.root.setPluginData(fileContentKeyPrefix + normalizedPath, data);
    figma.root.setPluginData(fileStatsKeyPrefix + normalizedPath, JSON.stringify(figFsStats));

    for (const listener of this.listeners) {
      // "On most platforms, 'rename' is emitted whenever a filename appears or disappears in the directory."
      listener({ eventType: 'rename', filename: dirName + baseName });
    }
  }

  async writeFileFromUI(path: string, data: string, stats: FigFsStats): Promise<void> {
    console.log(`writeFileFromUI${path}`);
    const normalizedPath = normalPath(path);

    // the write comes from the ui -> update cache stats with the new stats - ui do not need to be informed about the new content

    return this.writeFileToPluginData(path, data, stats);
  }

  async writeFile(path: string, data: string | Uint8Array, options?: { mode: number; } | undefined): Promise<void> {

    const figFsStats = newFigStats(Date.now(), options?.mode ?? 0o644, FileType.File);
    
    if (typeof data !== 'string') {
      throw new Error('non strings currently not supportet as file content');
    }

    return this.writeFileToPluginData(path, data, figFsStats);
  }

  async readdir(path: string): Promise<string[]> {
    const stat = await this.stat(path);
    const normalizedPath = normalPath(path);
    const folderSubPaths = [];

    if (stat.isDirectory()) {
      const keys = figma.root.getPluginDataKeys().filter((key) => key.startsWith(fileStatsKeyPrefix + normalizedPath));
      for (const key of keys) {
        const pathAfterFolder = key.substring((fileStatsKeyPrefix + normalizedPath).length, key.length - 1);
        if (!pathAfterFolder.includes('/')) {
          folderSubPaths.push(pathAfterFolder);
        }
      }
    }
    return folderSubPaths;
  }

  async mkdir(path: string, options?: { recursive: boolean; } | undefined): Promise<string | undefined> {
    console.log(`mkdir${path}`);
    const normalizedPath = normalPath(path);
    const parentDirPath = getDirname(path);

    try {
      const parentDirStats = await this.stat(parentDirPath);
      if (!parentDirStats.isDirectory()) {
        // path exists but seems not to be a folder
        throw new FilesystemError('ENOTDIR', path, 'mkdir');
      }
    } catch (e: any) {
      if (e.name !== FilesystemError.name) {
        // unknown error - rethrow
        throw e;
      }

      // ok parent folder does not exist yet - create it first if recrusion option is set
      if (!options?.recursive) {
        await this.mkdir(parentDirPath, options);
      } else {
        throw new FilesystemError('ENOENT', path, 'mkdir');
      }
    }

    try {
      // alright - parent folders should be in place lets create this folder
      const dirStats = await this.stat(path);
      if (!dirStats.isDirectory()) {
        // path exists but seems not to be a folder
        throw new FilesystemError('ENOTDIR', path, 'mkdir');
      }
      // folder exists already - return its path
      return path;
    } catch (e: any) {
      // we expect a FileSystem error if we try to get stats of something not extisting
      if (e.name !== FilesystemError.name) {
        // unknown error - rethrow
        throw e;
      }

      const figFsStats = newFigStats(Date.now(), 0o755, FileType.Directory);

      // TODO #28 fire watcher
      figma.root.setPluginData(fileStatsKeyPrefix + normalizedPath, JSON.stringify(figFsStats));

      for (const listener of this.listeners) {
        // "On most platforms, 'rename' is emitted whenever a filename appears or disappears in the directory."
        listener({ eventType: 'rename', filename: path });
      }
    }

    return path;
  }

  private async rmPathFromPluginData(path: string, recursive: boolean): Promise<void> {
    const normalizedPath = normalPath(path);
    // if file does not exist it will throw here
    const statsOfPathToDelete = this.lstat(path);

    if ((await statsOfPathToDelete).isDirectory()) {
      if (!recursive) {
        throw new FilesystemError('EISDIR', normalizedPath, 'rm');
      }

      // TODO find ALL files with the dir as prefix and start with the deepest one delete one after another
      // XXX recursiv deletion can be extremely costy if the file has thousands of properties
      const files = await this.readdir(normalizedPath);
      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        await this.rmPathFromPluginData(file, true);
      }

      figma.root.setPluginData(fileStatsKeyPrefix + normalizedPath, '');
    } else {
      figma.root.setPluginData(fileContentKeyPrefix + normalizedPath, '');
      figma.root.setPluginData(fileStatsKeyPrefix + normalizedPath, '');
    }

    for (const listener of this.listeners) {
      listener({ eventType: 'rename', filename: normalizedPath });
    }
  }

  async rm(path: string, options?: { recursive: boolean; } | undefined): Promise<void> {
    return this.rmPathFromPluginData(path, options?.recursive ?? false);
  }

  async rmdir(path: string): Promise<void> {
    const normalizedPath = normalPath(path);

    // if folder does not exist it will throw here
    const statsOfFolderToDelete = await this.lstat(path);

    if (statsOfFolderToDelete.isDirectory()) {
      const files = await this.readdir(path);
      if (files.length > 0) {
        throw new FilesystemError('ENOTEMPTY', path, 'rmdir');
      }

      figma.root.setPluginData(fileStatsKeyPrefix + normalizedPath, '');
    }

    for (const listener of this.listeners) {
      listener({ eventType: 'rename', filename: path });
    }
  }

  async symlink(target: string, path: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async unlink(path: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async readlink(path: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  watch(
    path: string,
    options?: {
      recursive?: boolean
      signal?: AbortSignal
      persistent?: false
    },
    // WatchOptions
  ): AsyncIterable<FileChangeInfo> {
    const normalizedPath = normalPath(path);
    const watchName = getBasename(normalizedPath);
    const watchDir = getDirname(normalizedPath);
    const watchPath = watchName === '/' ? watchDir : watchDir + watchName;

    // @ts-ignore
    if (options?.persistent || options?.encoding) {
      throw new Error("Some watch opptions not implemented, only 'recursive' allowed");
    }

    const queue: FileChangeInfo[] = [];

    let handleNext: (arg: any) => void;
    let rejecteNext: (err: Error) => void;
    let changeEvent: Promise<Error | undefined> = new Promise((resolve, reject) => {
      handleNext = resolve;
      rejecteNext = reject;
    });

    const listener = (event: FileChangeInfo) => {
      const eventToForward = {
        eventType: event.eventType,
        filename: event.filename,
      };

      if (eventToForward.filename === null) {
        throw new Error('Internal watcher error: missing filename');
      }
      const changeName = getBasename(eventToForward.filename);
      const changeDir = getDirname(eventToForward.filename);

      if (eventToForward.filename === watchPath) {
        eventToForward.filename = changeName;
        queue.push(eventToForward);
        setTimeout(() => handleNext(undefined), 0);
      } else if (changeDir === `${watchPath}/`) {
        eventToForward.filename = eventToForward.filename.replace(`${watchPath}/`, '') || changeName;
        queue.push(eventToForward);
        setTimeout(() => handleNext(undefined), 0);
      } else if (options?.recursive && eventToForward.filename.startsWith(watchPath)) {
        eventToForward.filename = eventToForward.filename.replace(`${watchPath}/`, '') || changeName;
        queue.push(eventToForward);
        setTimeout(() => handleNext(undefined), 0);
      }
    };

    this.listeners.add(listener);

    if (options?.signal) {
      options.signal.addEventListener(
        'abort',
        () => {
          this.listeners.delete(listener);
          try {
            options.signal?.throwIfAborted();
          } catch (err) {
            rejecteNext(err as Error);
          }
        },
        { once: true },
      );
    }

    const asyncIterator = async function* () {
      while (!options?.signal?.aborted) {
        if (queue.length > 0) {
          yield queue.shift() as FileChangeInfo;
        } else {
          // eslint-disable-next-line no-await-in-loop
          await changeEvent;
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          changeEvent = new Promise((resolve, reject) => {
            handleNext = resolve;
            rejecteNext = reject;
          });
        }
      }
    };

    return asyncIterator();
  }

  forwardDocumentChanges(event: any) {
    for (const change of event.documentChanges) {
      
      if (
      //  change.origin === 'LOCAL' we could optimize this for local changes....
        change.type !== 'PROPERTY_CHANGE'
      || change.node.id !== '0:0'
      || change.properties.indexOf('pluginData') === -1) {
        // eslint-disable-next-line no-continue
        continue;
      }
      console.log('PLUGIN DATA UPDATE - propagating change');

      // TODO #25 CACHING implement for multi user - keep tracK of changes in config as well
      // eslint-disable-next-line default-case
      const currentFileStatsStorageKeys = figma.root.getPluginDataKeys().filter((value) => value.startsWith(fileStatsKeyPrefix));

      const changedFiles = {
        deleted: [] as string[],
        updated: [] as string[],
        added: [] as string[],
      };

      let currentStatsKeys = [...this.propagatedFileState.keys()];

      for (const currentFileStatsStorageKey of currentFileStatsStorageKeys) {
        const path = currentFileStatsStorageKey.substring((fileStatsKeyPrefix).length);
        if (this.propagatedFileState.get(currentFileStatsStorageKey) === undefined) {
          changedFiles.added.push(path);
          this.propagatedFileState.set(currentFileStatsStorageKey, figma.root.getPluginData(currentFileStatsStorageKey));
          for (const listener of this.listeners) {
            // "On most platforms, 'rename' is emitted whenever a filename appears or disappears in the directory."
            listener({ eventType: 'rename', filename: path });
            console.log('PLUGIN DATA UPDATE - propagating change1');
          }
        } else {
          if (figma.root.getPluginData(currentFileStatsStorageKey) !== this.propagatedFileState.get(currentFileStatsStorageKey)) {
            changedFiles.updated.push(path);
            this.propagatedFileState.set(currentFileStatsStorageKey, figma.root.getPluginData(currentFileStatsStorageKey));
            for (const listener of this.listeners) {
              // "On most platforms, 'rename' is emitted whenever a filename appears or disappears in the directory."
              listener({ eventType: 'rename', filename: path });
              console.log('PLUGIN DATA UPDATE - propagating change3');
            }
          }

          currentStatsKeys = currentStatsKeys.filter((key) => key !== currentFileStatsStorageKey);
        }
      }

      for (const deletedStatsKey of currentStatsKeys) {
        const path = deletedStatsKey.substring((fileStatsKeyPrefix).length);
        changedFiles.deleted.push(path);
        this.propagatedFileState.delete(deletedStatsKey);
        for (const listener of this.listeners) {
          // "On most platforms, 'rename' is emitted whenever a filename appears or disappears in the directory."
          listener({ eventType: 'rename', filename: path });
          console.log('PLUGIN DATA UPDATE - propagating change2');
        }
      }

      // console.log('informing about update:');
      // console.log(changedFiles);

      // if (changedFiles.deleted.length > 0
      //   || changedFiles.added.length > 0
      //   || changedFiles.updated.length > 0) {
      //   // TODO #28 use this message to feed watcher in ui...
      //   figma.ui.postMessage({
      //     target: 'FigmaFsUI',
      //     type: 'filechanges',
      //     source: change.origin, // if local we can skip cache invalidation :D
      //     changedFiles,
      //   });
      // }
    }
  }
}
