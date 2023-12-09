import { NodeishStats } from './NodishStats';

export enum FileType {
  File = 0,
  Directory = 1,
  Symlink = 2,
}

export type FigFsStats = {
  /*
    * 0 = File
    * 1 = Directory
    * 2 = Symlink
    * */
  t: FileType;

  // modify time
  mt: number;

  // mode
  m: number;

  // symlink targer
  st?: string;
};

export function figFsStatsToStats(figFsStats: FigFsStats): NodeishStats {
  return {
    ctimeMs: figFsStats.mt,
    mtimeMs: figFsStats.mt,
    dev: 0,
    ino: 0,
    mode: figFsStats.m,
    uid: 0,
    gid: 0,
    size: -1,
    isFile: () => figFsStats.t === FileType.File,
    isDirectory: () => figFsStats.t === FileType.Directory,
    isSymbolicLink: () => figFsStats.t === FileType.Symlink,
    symlinkTarget: figFsStats.st,
  };
}
