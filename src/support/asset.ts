import { stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import * as path from 'node:path';

import { IHttpContext } from "../http/context.js";
import { checksum } from './file.js';
import { HttpRouter } from '../index.js';
import { IRouterOptions } from '../http/router/contracts.js';
import { GuessMime } from './mime.js';

export interface IFileinfo {
  size: number
  modified: Date
  checksome: string
  mime: string
}

export interface IHttpAssetOpts {
  root: string
  files: Array<string | { path: string, mime: string }>
  cache: boolean
  debug: boolean
}

export class HttpAsset {
  store: Record<string, any> = {};
  maxAgeSeconds = 60; // 200*24*60*60

  constructor(readonly opts: IHttpAssetOpts) { }

  async setup() {
    for (const file of this.opts.files) {
      const store = await this.info(typeof file == 'string' ? file : file.path);
      if (typeof file == 'object' && file.mime) {
        store.mime = file.mime;
      }
    }
    await writeFile(path.join(process.cwd(), `astad-http-assets.json`), JSON.stringify(this.store, null, 2));
  }

  routes(options?: Partial<IRouterOptions>) {
    const handler = async (ctx: IHttpContext) => {
      await this.file(ctx, { path: ctx.path }, ctx.method.toLowerCase() == 'head');
    };
    const route = new HttpRouter(options);
    for (const file of this.opts.files) {
      const abspath = typeof file == 'string' ? file : file.path;
      const rpath = path.relative(this.opts.root, abspath);
      route.get(`/${rpath}`, handler);
    }
    return route;
  }

  /**
   * caution: returns ref to object
   * @param file 
   * @returns 
   */
  async info(file: string): Promise<IFileinfo> {
    if (this.store[file]) {
      return this.store[file];
    }
    const info = await stat(file);
    const mime = GuessMime(file);
    return this.store[file] = {
      size: info.size,
      modified: info.mtime,
      checksome: await checksum(file),
      mime,
    };
  }

  async file(ctx: IHttpContext, file: IHttpAssetFile, head = false) {
    const absfile = path.join(this.opts.root, file.path);
    const info = await this.info(absfile);
    if (!this.opts.debug) {
      ctx.headers.set('Content-Length', info.size.toString());
    }
    ctx.headers.set('ETag', info.checksome);
    if (this.opts.cache && !this.opts.debug) {
      const etag = ctx.headers.get('if-none-match');
      if (etag && etag === info.checksome) {
        ctx.abort(304);
        return;
      }

      ctx.headers.set('Cache-Control', `public, max-age=${this.maxAgeSeconds}`);
    }
    if (!head) {
      ctx.stream(createReadStream(absfile), file.mime || info.mime);
    }
  }

  css(ctx: IHttpContext, file: string) {
    return this.file(ctx, { path: file, mime: `text/css` });
  }

  js(ctx: IHttpContext, file: string) {
    return this.file(ctx, { path: file, mime: `text/javascript` });
  }

  image(ctx: IHttpContext, file: string, type: string = 'jpg') {
    return this.file(ctx, { path: file, mime: `image/${type}` });
  }
}

export interface IHttpAssetFile {
  path: string
  mime?: string
}