import { NodeishStats } from './NodishStats';

export enum FileType {
  File = 0o100000,
  Directory = 0o040000,
  Symlink = 0o120000,
}

const S_IFMT = 0o170000;

export type FigFsStats = {

  // modify time
  mt: number;

  // mode
  m: number;

  // symlink targer
  st?: string;
};

export function newFigStats(modifiedTime: number, mode: number, type: FileType, symlinkTarget?: string): FigFsStats {
    
  return {
    mt: modifiedTime,
    // eslint-disable-next-line no-bitwise
    m: mode | type,
    st: symlinkTarget,
  };
}

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
    isFile: () => {
      // eslint-disable-next-line no-bitwise
      const fileTypeBits = figFsStats.m & S_IFMT;
      return fileTypeBits === FileType.File;
    },
    isDirectory: () => {
      // eslint-disable-next-line no-bitwise
      const fileTypeBits = figFsStats.m & S_IFMT;
      return fileTypeBits === FileType.Directory;
    },
    isSymbolicLink: () => {
      // eslint-disable-next-line no-bitwise
      const fileTypeBits = figFsStats.m & S_IFMT;
      return fileTypeBits === FileType.Symlink;
    },
    symlinkTarget: figFsStats.st,
  };
}
