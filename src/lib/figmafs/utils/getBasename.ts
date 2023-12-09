export default function getBasename(path: string): string {
  return (
    path
      .split('/')
      .filter((x) => x)
      .at(-1) ?? path
  );
}
