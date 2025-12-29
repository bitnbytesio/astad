import * as path from 'node:path';

export const MIME_EXT_MAP: any = {
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html',

  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',

  '.mp3': 'audio/mpeg',
  '.mkv': 'video/x-matroska',
  '.mp4': 'video/mp4',

  '.oga': 'audio/oga',
  '.ogg': 'audio/oga',
  '.opus': 'audio/oga',
  '.ogv': 'video/ogv',
  '.ogx': 'application/ogg',

  '.ico': 'image/vnd.microsoft.icon',
  '.png': 'image/png',
  '.pdf': 'application/pdf',

  '.svg': 'image/svg+xml',
  '.wav': 'audio/wave',

  // fonts
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',

  '.txt': 'text/plain',

  '.weba': 'image/webm',
  '.webp': 'image/webp',
  '.webm': 'video/webm',

  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',

  default: 'application/octet-stream',
};

export function GuessMime(source: string, customMap: { [key: string]: string } = {}) {
  const ext = path.extname(source);
  return customMap[ext] || MIME_EXT_MAP[ext] || MIME_EXT_MAP.default;
}

/**
 * Register a single MIME type for an extension
 * @param ext Extension including the dot (e.g., '.tsx')
 * @param mime MIME type (e.g., 'text/typescript')
 */
export function registerMime(ext: string, mime: string) {
  if (!ext.startsWith('.')) {
    ext = '.' + ext;
  }
  MIME_EXT_MAP[ext] = mime;
}

/**
 * Register multiple MIME types at once
 * @param map Object mapping extensions to MIME types
 */
export function registerMimeTypes(map: { [ext: string]: string }) {
  for (const [ext, mime] of Object.entries(map)) {
    registerMime(ext, mime);
  }
}

/**
 * Set the default MIME type for unknown extensions
 * @param mime MIME type to use as default
 */
export function setDefaultMime(mime: string) {
  MIME_EXT_MAP.default = mime;
}