import { NodeishStats } from '../types/NodishStats';

/* eslint-disable no-param-reassign */
const S_IFREG = 0o100000;
const S_IFDIR = 0o040000;
const S_IFLNK = 0o120000;
const S_IFMT = 0o170000;

export default function recreateFstatsMethods(fstat: NodeishStats) {
  fstat.isDirectory = () => {
    // eslint-disable-next-line no-bitwise
    const fileTypeBits = fstat.mode & S_IFMT;
    return fileTypeBits === S_IFDIR;
  };

  fstat.isFile = () => {
    // eslint-disable-next-line no-bitwise
    const fileTypeBits = fstat.mode & S_IFMT;
    return fileTypeBits === S_IFREG;
  };

  fstat.isSymbolicLink = () => {
    // eslint-disable-next-line no-bitwise
    const fileTypeBits = fstat.mode & S_IFMT;
    return fileTypeBits === S_IFLNK;
  };
}
