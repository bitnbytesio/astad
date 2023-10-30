import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

export function checksum(path: fs.PathLike, algorithm: string = 'sha1', encoding: crypto.BinaryToTextEncoding = 'hex'): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(path);
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest(encoding)));
  });
}