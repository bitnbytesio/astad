import * as path from 'node:path';

export function GuessMime(source: string) {
  const ext = path.extname(source);

  let type = '';

  switch (ext) {
    case '.jpg':
    case '.jpeg':
      type = 'image/jpeg';
      break;
    case '.png':
      type = 'image/png';
      break;
    case '.gif':
      type = 'image/gif';
      break;
    case '.mp3':
      type = 'audio/mpeg';
      break;
    case '.oga':
    case '.ogg':
    case '.opus':
      type = 'audio/oga';
      break;
    case '.wav':
      type = 'audio/wave';
      break;
    case '.mkv':
      type = 'video/x-matroska';
      break;
    case '.mp4':
      type = 'video/mp4';
      break;
    case '.ogv':
      type = 'video/ogv';
      break;
    case '.webm':
      type = 'video/webm';
      break;
    case '.ogx':
      type = 'application/ogg';
      break;
    case '.pdf':
      type = 'application/pdf';
      break;
    default:
      type = 'application/octet-stream';
      break;
  }

  return type;
}