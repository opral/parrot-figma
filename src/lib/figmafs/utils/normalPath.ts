/**
 * Removes extraneous dots and slashes, resolves relative paths and ensures the
 * path begins and ends with '/'
 * FIXME: unify with utilities/normalizePath!
 */
export default function normalPath(path: string): string {
  const dots = /(\/|^)(\.\/)+/g;
  const slashes = /\/+/g;

  const upreference = /(?<!\.\.)[^/]+\/\.\.\//;

  // Append '/' to the beginning and end
  let normalizedPath = `/${path}/`;

  // Handle the edge case where a path begins with '/..'
  normalizedPath = normalizedPath.replace(/^\/\.\./, '');

  // Remove extraneous '.' and '/'
  normalizedPath = normalizedPath.replace(dots, '/').replace(slashes, '/');

  // Resolve relative paths if they exist
  let match;
  // eslint-disable-next-line no-cond-assign
  while ((match = normalizedPath.match(upreference)?.[0])) {
    normalizedPath = normalizedPath.replace(match, '');
  }

  return normalizedPath;
}
