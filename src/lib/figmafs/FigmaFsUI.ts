/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-param-reassign */
import { NodeishFilesystem } from '@lix-js/fs';
import TextEncoding from 'text-encoding';
import { FileChangeInfo, NodeishStats } from './types/NodishStats';
import normalPath from './utils/normalPath';
import { FigFsStats, figFsStatsToStats } from './types/FigFsStats';
import getBasename from './utils/getBasename';
import getDirname from './utils/getDirname';
import recreateFstatsMethods from './utils/recreateFstatsMethods';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

  private sandboxFs: NodeishFilesystem;

  static instance: FigmaFsUI | undefined;

  static init(
    sandboxFs: NodeishFilesystem,
  ) {
    if (this.instance) {
      throw new Error('init called twice');
    }

    this.instance = new FigmaFsUI(sandboxFs);
  }

  constructor(sandboxFs: NodeishFilesystem) {
    this.sandboxFs = sandboxFs;

    window.addEventListener('message', (event : MessageEvent) => {
      if (event.data.pluginMessage.target === 'FigmaFsUI') {
        debugger;
        if (event.data.pluginMessage.type === 'changeEvent') {
          this.processFileChanges(event.data.pluginMessage.event as FileChangeInfo);
        }
      }
    });
  }

  private processFileChanges(event: FileChangeInfo) {
    const normalizedPath = normalPath(event.filename!);
    this.fsStatsCache.delete(normalizedPath);
    this.fileContentCache.delete(normalizedPath);

    for (const listener of this.listeners) {
      // "On most platforms, 'rename' is emitted whenever a filename appears or disappears in the directory."
      listener(event);
    }
  }

  async writeFile(path: string, data: string | Uint8Array, options?: { mode: number; } | undefined): Promise<void> {
    const normalizedPath = normalPath(path);

    // const dataString = typeof data !== 'string' ? new TextDecoder().decode(data) : data;

    // const newStats: FigFsStats = {
    //   mt: Date.now(),
    //   m: options?.mode ?? 0o644,
    //   t: 0,
    // };

    // const currentStatsForRollback = this.fsStatsCache.get(normalizedPath);
    // const currentContentForRollback = this.fileContentCache.get(normalizedPath);

    // // file was written successfully - update file in ui as well
    // // TODO #28 check if we should update the cache before we write and rollback on error instead?
    // // thoughts: we hand over the content and the stats to the remote - async -
    // // this means we don't know the state of the content. we can handle it as:
    // // - it was written - we update the cache
    // // - it was not written - we don't update the cache
    // // we have two channels - cache invalidation, file watch
    // // - cache invalidation should only fire if another user changes data
    // // - file watch fires on every change - even when triggered by the user

    // this.fsStatsCache.set(normalizedPath, figFsStatsToStats(newStats));
    // this.fileContentCache.set(normalizedPath, dataString);

    // try {

    this.fsStatsCache.delete(normalizedPath);
    this.fileContentCache.delete(normalizedPath);

    
    // we only allow passing stirngs
    const stringData = typeof data !== 'string' ? decoder.decode(data as Uint8Array) : data;

    if (normalizedPath === '/.git/objects/pack/pack-ee366b1cbd33c57026e4dc15e59d1533670d6b99.idx/') {
      console.log('CONTENT OF WRITE /.git/objects/pack/pack-ee366b1cbd33c57026e4dc15e59d1533670d6b99.idx');
      console.log(data);

      const base64 = btoa(String.fromCharCode.apply(null, Array.from(data as Uint8Array)));
      const decodedBinaryString = atob(base64);
      const decodedBinaryData = new Uint8Array([...decodedBinaryString].map((char) => char.charCodeAt(0)));
      console.log(stringData);

      console.log(encoder.encode(decoder.decode(data as Uint8Array)));

      console.log(decodedBinaryData);
    }

    await this.sandboxFs.writeFile(path, stringData, options);
    // } catch (e) {
    //   // rollback cache
    //   if (currentStatsForRollback) {
    //     this.fsStatsCache.set(normalizedPath, currentStatsForRollback);
    //   }

    //   if (currentContentForRollback) {
    //     this.fileContentCache.set(normalizedPath, currentContentForRollback);
    //   }

    //   throw e;
    // }
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

      return encoder.encode(cachedContent);
    }

    const fileStats = await this.sandboxFs.stat(path);
    recreateFstatsMethods(fileStats);
    const fileContent = await this.sandboxFs.readFile(path, { encoding: 'utf-8' });

    this.fsStatsCache.set(normalizedPath, fileStats);
    this.fileContentCache.set(normalizedPath, fileContent);


    if (normalizedPath === '/.git/objects/pack/pack-ee366b1cbd33c57026e4dc15e59d1533670d6b99.idx/') {
      console.log('CONTENT OF READ /.git/objects/pack/pack-ee366b1cbd33c57026e4dc15e59d1533670d6b99.idx');
      console.log(fileContent);
      console.log(encoder.encode(fileContent));
    }


    if (options?.encoding || typeof options === 'string') {
      return fileContent;
    }
    return encoder.encode(fileContent);
  }

  async readdir(path: string): Promise<string[]> {
    return this.sandboxFs.readdir(path);
  }

  async mkdir(path: string, options?: { recursive: boolean; } | undefined): Promise<string | undefined> {
    return this.sandboxFs.mkdir(path, options);
  }

  async rm(path: string, options?: { recursive: boolean; } | undefined): Promise<void> {
    const normalizedPath = normalPath(path);

    this.fsStatsCache.delete(normalizedPath);
    this.fileContentCache.delete(normalizedPath);

    if (options && options.recursive) {
      for (const statsCacheFilePath of this.fsStatsCache.keys()) {
        if (statsCacheFilePath.startsWith(normalizedPath)) {
          this.fsStatsCache.delete(statsCacheFilePath);
        }
      }
      for (const contentCacheFilePath of this.fileContentCache.keys()) {
        if (contentCacheFilePath.startsWith(normalizedPath)) {
          this.fileContentCache.delete(contentCacheFilePath);
        }
      }
    }
    await this.sandboxFs.rm(path, options);
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

    const freshStats = await this.sandboxFs.stat(path);
    recreateFstatsMethods(freshStats);
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

    const freshLStats = await this.sandboxFs.lstat(path);
    recreateFstatsMethods(freshLStats);
    return freshLStats;
  }

  symlink(target: string, path: string): Promise<void> {
    return this.sandboxFs.symlink(target, path);
  }

  unlink(path: string): Promise<void> {
    return this.sandboxFs.unlink(path);
  }

  readlink(path: string): Promise<string> {
    return this.sandboxFs.readlink(path);
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

    const listener = (passedEvent: FileChangeInfo) => {
      const event = {
        eventType: passedEvent.eventType,
        filename: passedEvent.filename,
      };

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
