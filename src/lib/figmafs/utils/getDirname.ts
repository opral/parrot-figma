import normalPath from './normalPath';

export default function getDirname(path: string): string {
  return normalPath(
    path
      .split('/')
      .filter((x) => x)
      .slice(0, -1)
      .join('/') ?? path,
  );
}
