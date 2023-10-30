import * as path from "node:path";

const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/

export function safe(unsafepath: string, root?: string) {
  if (!root) {
    root = process.cwd();
  }

  // containing NULL bytes is malicious
  if (unsafepath.indexOf('\0') !== -1) {
    throw new Error('Malicious Path')
  }

  // path should never be absolute
  if (path.isAbsolute(unsafepath)) {
    throw new Error('Malicious Path')
  }

  // path outside root
  if (UP_PATH_REGEXP.test(path.normalize('.' + path.sep + unsafepath))) {
    throw new Error('Forbidden');
  }

  // join the relative path
  return path.normalize(path.join(path.resolve(root), unsafepath));
}