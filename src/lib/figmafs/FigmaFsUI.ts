/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-param-reassign */
import { NodeishFilesystem } from '@lix-js/fs';
import { FileChangeInfo, NodeishStats } from './types/NodishStats';
import { FigmaSandboxFsProvider } from './types/FigmaSandboxFsProvider';
import normalPath from './utils/normalPath';
import { FigFsStats, figFsStatsToStats } from './types/FigFsStats';
import getBasename from './utils/getBasename';
import getDirname from './utils/getDirname';


/**
 * This FS is split into two parts:
 * 1. FigmaFs - this class implements the NodishFileSystem interface and can run in the plugins ui's - ifragem (this class). It delegates writes to persistance adapters like the figma rootnode fs persistance.
 * 2. FigmaPersistance adapter -
 * The Sandbox will forward changes (done by other users in the same file) to the UI.
 *
 * The persistance of the sandbox
 */
export default class FigmaFsUI implements NodeishFilesystem {
  listeners: Set<(event: FileChangeInfo) => void> = new Set();

  // files that we got from the parent process live in a cache - we update this when parent informs about a change or the ui activily writes data
  private fileContentCache: Map<string, string> = new Map();

  // filestats also cached like files
  private fsStatsCache: Map<string, NodeishStats> = new Map();

  private sandboxFs: FigmaSandboxFsProvider;

  static instance: FigmaFsUI | undefined;

  static init(
    sandboxFs: FigmaSandboxFsProvider,
  ) {
    if (this.instance) {
      throw new Error('init called twice');
    }

    this.instance = new FigmaFsUI(sandboxFs);
  }

  constructor(sandboxFs: FigmaSandboxFsProvider) {
    this.sandboxFs = sandboxFs;

    window.addEventListener('message', (event : MessageEvent) => {
      if (event.data.pluginMessage.target === 'FigmaFsUI') {
        if (event.data.pluginMessage.type === 'filechanges') {
          if (event.data.pluginMessage.origin !== 'LOCAL' || event.data.pluginMessage.origin !== 'REMOTE') {
            this.processFileChanges(event.data.pluginMessage.origin, event.data.pluginMessage.changedFiles);
          }
        }
      }
    });
  }

  private processFileChanges(origin: 'LOCAL' | 'REMOTE', changedFiles: { added: string[], updated: [], deleted: [] }) {
    for (const addedFilePath of changedFiles.added) {
      for (const listener of this.listeners) {
        // "On most platforms, 'rename' is emitted whenever a filename appears or disappears in the directory."
        listener({ eventType: 'rename', filename: addedFilePath });
      }
    }

    for (const deletedFilePath of changedFiles.deleted) {
      if (origin === 'REMOTE') {
        const normalizedPath = normalPath(deletedFilePath);
        this.fsStatsCache.delete(normalizedPath);
        this.fileContentCache.delete(normalizedPath);
      }

      for (const listener of this.listeners) {
        // "On most platforms, 'rename' is emitted whenever a filename appears or disappears in the directory."
        listener({ eventType: 'rename', filename: deletedFilePath });
      }
    }

    for (const updatedFilePath of changedFiles.updated) {
      if (origin === 'REMOTE') {
        const normalizedPath = normalPath(updatedFilePath);
        this.fsStatsCache.delete(normalizedPath);
        this.fileContentCache.delete(normalizedPath);
      }
      for (const listener of this.listeners) {
        // "On most platforms, 'rename' is emitted whenever a filename appears or disappears in the directory."
        listener({ eventType: 'rename', filename: updatedFilePath });
      }
    }
  }

  async writeFile(path: string, data: string | Uint8Array, options?: { mode: number; } | undefined): Promise<void> {
    const normalizedPath = normalPath(path);

    const dataString = typeof data !== 'string' ? new TextDecoder().decode(data) : data;

    const newStats: FigFsStats = {
      mt: Date.now(),
      m: options?.mode ?? 0o644,
      t: 0,
    };

    const currentStatsForRollback = this.fsStatsCache.get(normalizedPath);
    const currentContentForRollback = this.fileContentCache.get(normalizedPath);

    // file was written successfully - update file in ui as well
    // TODO #28 check if we should update the cache before we write and rollback on error instead?
    // thoughts: we hand over the content and the stats to the remote - async -
    // this means we don't know the state of the content. we can handle it as:
    // - it was written - we update the cache
    // - it was not written - we don't update the cache
    // we have two channels - cache invalidation, file watch
    // - cache invalidation should only fire if another user changes data
    // - file watch fires on every change - even when triggered by the user

    this.fsStatsCache.set(normalizedPath, figFsStatsToStats(newStats));
    this.fileContentCache.set(normalizedPath, dataString);

    try {
      await this.sandboxFs.writeFileFromUI(path, dataString, newStats);
    } catch (e) {
      // rollback cache
      if (currentStatsForRollback) {
        this.fsStatsCache.set(normalizedPath, currentStatsForRollback);
      }

      if (currentContentForRollback) {
        this.fileContentCache.set(normalizedPath, currentContentForRollback);
      }

      throw e;
    }
  }

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: { encoding: 'utf-8' | 'binary'; }): Promise<string>;
  async readFile(path: any, options?: any): Promise<Uint8Array | string> {
    if (typeof path !== 'string') {
      throw new Error('type not supported');
    }

    const normalizedPath = normalPath(path);
    const cachedContent = this.fileContentCache.get(normalizedPath);
    if (cachedContent !== undefined) {
      if (options?.encoding || typeof options === 'string') {
        return cachedContent;
      }

      return new TextEncoder().encode(cachedContent);
    }

    const fileStats = await this.sandboxFs.getStatFromUi(path);
    const fileContent = await this.sandboxFs.readFileFromUI(path);

    this.fsStatsCache.set(normalizedPath, figFsStatsToStats(fileStats));
    this.fileContentCache.set(normalizedPath, fileContent);

    if (options?.encoding || typeof options === 'string') {
      return fileContent;
    }
    return new TextEncoder().encode(fileContent);
  }

  async readdir(path: string): Promise<string[]> {
    return this.sandboxFs.readdir(path);
  }

  async mkdir(path: string, options?: { recursive: boolean; } | undefined): Promise<string | undefined> {
    return this.sandboxFs.mkdir(path, options);
  }

  async rm(path: string, options?: { recursive: boolean; } | undefined): Promise<void> {
    const normalizedPath = normalPath(path);

    await this.sandboxFs.rmFromUI(path, options?.recursive ?? false);

    // rm cache after awaited the rm - could also be done by the events fired by the method...
    this.fileContentCache.delete(normalizedPath);
    this.fsStatsCache.delete(normalizedPath);
  }

  async rmdir(path: string): Promise<void> {
    const normalizedPath = normalPath(path);
    await this.sandboxFs.rmdir(path);
    // remove the current folder from the cache (shouldn't have content anyway)
    this.fsStatsCache.delete(normalizedPath);
  }

  async stat(path: string): Promise<NodeishStats> {
    const normalizedPath = normalPath(path);
    const cachedStat = this.fsStatsCache.get(normalizedPath);
    if (cachedStat) {
      if (cachedStat.symlinkTarget) {
        return this.stat(cachedStat.symlinkTarget);
      }
      return cachedStat;
    }

    const freshFigStats = await this.sandboxFs.getStatFromUi(path);
    const freshStats = figFsStatsToStats(freshFigStats);
    this.fsStatsCache.set(path, freshStats);

    if (freshStats.symlinkTarget) {
      return this.stat(freshStats.symlinkTarget);
    }
    return freshStats;
  }

  async lstat(path: string): Promise<NodeishStats> {
    const normalizedPath = normalPath(path);
    const cachedStat = this.fsStatsCache.get(normalizedPath);
    if (cachedStat) {
      return cachedStat;
    }

    const freshFigStats = await this.sandboxFs.getStatFromUi(path);
    const freshStats = figFsStatsToStats(freshFigStats);
    this.fsStatsCache.set(path, freshStats);
    return freshStats;
  }

  symlink(target: string, path: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  unlink(path: string): Promise<void> {
    throw new Error('Method unlink not implemented.');
  }

  readlink(path: string): Promise<string> {
    throw new Error('Method readlink not implemented.');
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
    const watchPath = watchDir + watchName;

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
      if (event.filename === null) {
        throw new Error('Internal watcher error: missing filename');
      }
      const changeName = getBasename(event.filename);
      const changeDir = getDirname(event.filename);

      if (event.filename === watchPath) {
        // eslint-disable-next-line no-param-reassign
        event.filename = changeName;
        queue.push(event);
        setTimeout(() => handleNext(undefined), 0);
      } else if (changeDir === `${watchPath}/`) {
        // eslint-disable-next-line no-param-reassign
        event.filename = event.filename.replace(`${watchPath}/`, '') || changeName;
        queue.push(event);
        setTimeout(() => handleNext(undefined), 0);
      } else if (options?.recursive && event.filename.startsWith(watchPath)) {
        // console.log(event.filename, { watchPath, changeDir, changeName })
        // eslint-disable-next-line no-param-reassignssqsq
        event.filename = event.filename.replace(`${watchPath}/`, '') || changeName;
        queue.push(event);
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

    return (async function* () {
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
    }());
  }
}
