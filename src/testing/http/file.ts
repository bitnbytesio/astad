import { createReadStream } from 'node:fs';
import * as path from 'path';
import * as fs from 'fs/promises';

import { GuessMime } from '../../support/mime.js';
import { IHttpFile } from './contracts.js';

export class TestHttpFile implements IHttpFile {

  constructor(protected attrs: any = {}) { }

  get originalName() {
    return this.attrs.originalName;
  }

  get type() {
    return this.attrs.type;
  }

  get size() {
    return this.attrs.size;
  }

  get path() {
    return this.attrs.path;
  }

  get extension() {
    return this.attrs.extension;
  }

  readStream() {
    return createReadStream(this.path);
  }

  static async source(fpath: string) {
    const stat = await fs.stat(fpath);

    const attrs = {
      originalName: path.basename(fpath),
      type: GuessMime(fpath),
      size: stat.size,
      path: fpath,
      extension: path.extname(fpath),
    };

    return new TestHttpFile(attrs);
  }
}