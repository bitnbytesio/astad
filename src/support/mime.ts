import * as path from 'node:path';

export const MIME_EXT_MAP: any = {
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html',

  '.js': 'text/javascript',
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