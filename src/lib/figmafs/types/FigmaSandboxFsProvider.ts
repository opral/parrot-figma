import { FigFsStats } from './FigFsStats';

export type FigmaSandboxFsProvider = {
  readFileFromUI(path: string): Promise<string>;
  writeFileFromUI(path: string, data: string, stats: FigFsStats): Promise<void>;
  rmFromUI(path: string, recursiv: boolean): Promise<void>;

  rmdir(path: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string, options?: { recursive: boolean } | undefined): Promise<string | undefined>;

  getStatFromUi(path: string): Promise<FigFsStats>;

  symlink(target: string, path: string): Promise<void>;
  unlink(path: string): Promise<void>;
  readlink(path: string): Promise<string>;
};
