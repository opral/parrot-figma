/* eslint-disable @typescript-eslint/no-loop-func */
import { NodeishFilesystem } from '@lix-js/fs';

import normalPath from './utils/normalPath';
import { FilesystemError, NodeishStats, FileChangeInfo } from './types/NodishStats';
import getDirname from './utils/getDirname';
import getBasename from './utils/getBasename';

// TODO #28 define path matcher to define where data should be stored

/**
 * We need a file system that uses different storage system for different folders
 *
 * root folder should be held in memory
 * ./inlang folder should be stored and synced with the figma file
 *
 * OR
 *
 * / should be held in local storage
 * /project.inlang/ should be stored in the local file
 */
export default class DelegatingFs implements NodeishFilesystem {
  public proxyClassName = 'DelegatingFs';

  listeners: Set<(event: FileChangeInfo) => void> = new Set();

  fileSystems: { path: string, fs: NodeishFilesystem }[];

  constructor(fileSystems?: { path: string, fs: NodeishFilesystem }[]) {
    if (fileSystems) {
      this.fileSystems = fileSystems;

      for (const delegateFs of fileSystems) {
        this.propagateEvents(delegateFs);
      }
    } else {
      // we are runnig as a proxy
      this.fileSystems = [];
    }
  }

  private propagateEvents(delegateFs: { path: string, fs: NodeishFilesystem }) {
    const startWatching = async () => {
      try {
        const watcher = delegateFs.fs.watch(delegateFs.path, {
          // TODO #1844  - check who would signal here -
          // signal: abortController.signal,
          persistent: false,
          recursive: true,
        });
        if (watcher) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for await (const event of watcher) {
            if (!event.filename) {
              throw new Error('filename not set in event...');
            }
            const newEvent = { ...event };
            newEvent.filename = delegateFs.path !== '/' ? delegateFs.path + event.filename : event.filename;
            for (const listener of this.listeners) {
              listener(newEvent);
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        // https://github.com/inlang/monorepo/issues/1647
        // the file does not exist (yet)
        // this is not testable beacause the fs.watch api differs
        // from node and lix. lenghty
        if (err.code === 'ENOENT') return;
        throw err;
      }
    };
    startWatching();
  }

  private getFilesystemForPath(path: string): NodeishFilesystem {
    for (const fileSystem of this.fileSystems) {
      if (path.startsWith(fileSystem.path)) {
        return fileSystem.fs;
      }
    }

    return this.fileSystems[this.fileSystems.length - 1]!.fs;
  }

  async stat(path: string): Promise<NodeishStats> {
    // TODO stat needs to cross fs system borders...
    const fs = this.getFilesystemForPath(path);
    return fs.stat(path);
  }

  async lstat(path: string): Promise<NodeishStats> {
    const fs = this.getFilesystemForPath(path);
    return fs.lstat(path);
  }

  async readFile(path: string): Promise<Uint8Array>;
  async readFile(path: string, options: { encoding: 'utf-8' | 'binary'; }): Promise<string>;
  async readFile(path: any, options?: any): Promise<string | Uint8Array> {
    const fs = this.getFilesystemForPath(path);
    const data = fs.readFile(path, options);
    return data;
  }

  async writeFile(path: string, data: string | Uint8Array, options?: { mode: number; } | undefined): Promise<void> {
    const fs = this.getFilesystemForPath(path);
    return fs.writeFile(path, data, options);
  }

  async readdir(path: string): Promise<string[]> {
    if (path === '/') {
      const allPaths = new Set<string>();
      for (const fs of this.fileSystems) {
        // eslint-disable-next-line no-await-in-loop
        const paths = await fs.fs.readdir('/');
        for (const pathInFs of paths) {
          allPaths.add(pathInFs);
        }
      }
      return [...allPaths];
    }
    const fs = this.getFilesystemForPath(path);


    return fs.readdir(path);
  }

  async mkdir(path: string, options?: { recursive: boolean; } | undefined): Promise<string | undefined> {
    const normalizedPath = normalPath(path);
    const parentDirPath = getDirname(path);

    try {
      const parentDirStats = await this.stat(parentDirPath);
      if (!parentDirStats.isDirectory()) {
        // path exists but seems not to be a folder
        throw new FilesystemError('ENOTDIR', path, 'mkdir');
      }
    } catch (e: any) {
      if (e.name !== FilesystemError.name || e.code === 'ENOTDIR') {
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
      if (e.name !== FilesystemError.name || e.code === 'ENOTDIR') {
        // unknown error - rethrow
        throw e;
      }

      const fs = this.getFilesystemForPath(path);
      await fs.mkdir(path, { recursive: false });
    }

    return path;
  }

  async rm(path: string, options?: { recursive: boolean; } | undefined): Promise<void> {
    const normalizedPath = normalPath(path);
    // if file does not exist it will throw here
    const statsOfPathToDelete = this.lstat(path);

    if ((await statsOfPathToDelete).isDirectory()) {
      if (options === undefined ||  !options.recursive) {
        throw new FilesystemError('EISDIR', normalizedPath, 'rm');
      }

      const filePathsInFolder = await this.readdir(normalizedPath);
      for (const filePath of filePathsInFolder) {
        // eslint-disable-next-line no-await-in-loop
        await this.rm(filePath, { recursive: true });
        const normalizedPathInFolder = normalPath(path);
        const fs = this.getFilesystemForPath(normalizedPathInFolder);
        fs.rm(filePath, { recursive: false });
      }
    } else {
      const fs = this.getFilesystemForPath(normalizedPath);
      fs.rm(normalizedPath, { recursive: false });
    }
  }

  async rmdir(path: string): Promise<void> {
    const normalizedPath = normalPath(path);
    const fs = this.getFilesystemForPath(normalizedPath);
    // if folder does not exist it will throw here
    fs.rmdir(path);
  }

  async symlink(target: string, path: string): Promise<void> {
    const normalizedPath = normalPath(path);
    const fs = this.getFilesystemForPath(normalizedPath);
    fs.symlink(target, path);
  }

  async unlink(path: string): Promise<void> {
    const normalizedPath = normalPath(path);
    const fs = this.getFilesystemForPath(normalizedPath);
    fs.unlink(path);
  }

  async readlink(path: string): Promise<string> {
    const normalizedPath = normalPath(path);
    const fs = this.getFilesystemForPath(normalizedPath);
    return fs.readlink(path);
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
    debugger;
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
    }

    return asyncIterator();
  }
}
