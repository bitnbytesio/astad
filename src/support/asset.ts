import { stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import * as path from 'node:path';

import { IHttpContext } from "../http/context.js";
import { checksum } from './file.js';
import { HttpRouter } from '../index.js';
import { IRouterOptions } from '../http/router/contracts.js';
import { GuessMime } from './mime.js';
import { pathsafe } from './path.js';

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
  allowRange?: boolean
}

export class HttpAsset {
  store: Record<string, any> = {};
  maxAgeSeconds = 60; // 200*24*60*60

  constructor(readonly opts: IHttpAssetOpts) { }

  async setup() {
    for (const file of this.opts.files) {
      const fpath = typeof file == 'string' ? file : file.path;
      const store = await this.info(fpath);
      if (!store) {
        throw new Error(`File ${fpath} not found or is not readable.`);
      }
      if (typeof file == 'object' && file.mime) {
        store.mime = file.mime;
      }
    }
    await writeFile(path.join(process.cwd(), `astad-http-assets.json`), JSON.stringify(this.store, null, 2));
  }

  routes(options?: Partial<IRouterOptions>) {
    const handler = async (ctx: IHttpContext) => {
      await this.file(ctx, { path: ctx.path });
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
  async info(file: string): Promise<IFileinfo | null> {
    if (this.store[file]) {
      return this.store[file];
    }
    try {
      const info = await stat(file);
      const mime = GuessMime(file);
      return this.store[file] = {
        size: info.size,
        modified: info.mtime,
        checksome: await checksum(file),
        mime,
      };
    } catch (_: any) {
      return null;
    }
  }

  streamOptions(ctx: IHttpContext) {
    const options: any = {};
    if (this.opts.allowRange) {
      const range = ctx.headers.get('range');
      if (range && range.startsWith('bytes=')) {
        const [positions] = range.replace(/bytes=/, '').split('-');
        options.start = parseInt(positions[0], 10);
        if (positions[1]) {
          const end = parseInt(positions[1], 10);
          if (end && !Number.isNaN(end)) {
            options.end = end;
          }
        }
      }
    }
    return options;
  }

  /**
   * @unsafe does not normalize paths
   * @param ctx 
   * @param file 
   * @param head 
   * @returns 
   */
  async file(ctx: IHttpContext, file: IHttpAssetFile, head?: boolean) {
    head = head || ctx.method.toLowerCase() == 'head';
    const absfile = path.join(this.opts.root, file.path);
    const info = await this.info(absfile);
    if (!info) {
      ctx.abort(404);
      return;
    }

    if (!this.opts.debug) {
      // content length may vary in debug mode
      ctx.headers.set('Content-Length', info.size.toString());
      ctx.headers.set('ETag', info.checksome);
    }

    if (this.opts.cache && !this.opts.debug) {
      // only set cache-control, we cache enabled and not in debug mode
      const etag = ctx.headers.get('if-none-match');
      if (etag && etag === info.checksome) {
        ctx.abort(304);
        return;
      }

      ctx.headers.set('Cache-Control', `public, max-age=${this.maxAgeSeconds}`);
    }
    if (!head) {
      const options = this.streamOptions(ctx);
      ctx.reply({
        status: options.start ? 206 : 200,
        body: createReadStream(absfile, options),
        headers: { 'content-type': file.mime || info.mime },
      });
      return;
    }
    ctx.reply({
      status: 200,
      body: '',
      headers: { 'content-type': file.mime || info.mime },
    });
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

  async hasAsset(relativePath: string) {
    const absfile = path.join(this.opts.root, relativePath);
    return await this.info(absfile) != null;
  }
}

export interface IHttpAssetFile {
  path: string
  mime?: string
}

export interface IHttpAssetMiddlewareOpts {
  root: string
  prefix?: string
  index?: string
  debug: boolean
  cache: boolean
  maxAgeSeconds: number
}

export class HttpAssetMiddleware {
  store: Record<string, any> = {};
  maxAgeSeconds = 60; // 200*24*60*60

  constructor(readonly opts: IHttpAssetMiddlewareOpts) { }

  static middleware(opts: IHttpAssetMiddlewareOpts) {
    const cors = new HttpAssetMiddleware(opts);
    return cors.handle.bind(this);
  }

  get prefix() {
    return this.opts.prefix || '/';
  }


  async handle(ctx: IHttpContext, next: any) {
    await next();

    if (ctx.response.status != 404) {
      return;
    }

    // skip if this is not a GET/HEAD request
    if (ctx.method !== 'HEAD' && ctx.method !== 'GET') {
      return;
    }

    let fpath = ctx.path;
    const prefix = this.prefix;

    if (fpath.indexOf(prefix) !== 0) {
      return;
    }

    fpath = fpath.replace(prefix, '');

    if ((!fpath || fpath == '/') && this.opts.index) {
      fpath = this.opts.index;
    }

    await this.file(ctx, { path: fpath });
  }

  /**
  * caution: returns ref to object
  * @param file 
  * @returns 
  */
  async info(file: string): Promise<IFileinfo | null> {
    if (this.store[file]) {
      return this.store[file];
    }
    try {
      const info = await stat(file);
      const mime = GuessMime(file);
      return this.store[file] = {
        size: info.size,
        modified: info.mtime,
        checksome: await checksum(file),
        mime,
      };
    } catch (_: any) {
      return null;
    }
  }

  streamOptions(ctx: IHttpContext) {
    const options: any = {};
    //if (this.opts.allowRange) {
    const range = ctx.headers.get('range');
    if (range && range.startsWith('bytes=')) {
      const [positions] = range.replace(/bytes=/, '').split('-');
      options.start = parseInt(positions[0], 10);
      if (positions[1]) {
        const end = parseInt(positions[1], 10);
        if (end && !Number.isNaN(end)) {
          options.end = end;
        }
      }
    }
    //}
    return options;
  }

  async file(ctx: IHttpContext, file: IHttpAssetFile, head?: boolean) {
    head = head || ctx.method.toLowerCase() == 'head';
    if (file.path.startsWith('/')) {
      file.path = file.path.slice(1);
    }
    const absfile = pathsafe(file.path, this.opts.root);
    if (!absfile) {
      console.log('absfile failed from ctx.path', file.path, ctx.path)
      return false;
    }
    console.log('figured absfile from ctx.path', absfile, ctx.path)
    const info = await this.info(absfile);
    if (!info) {
      console.log('info not found')
      return false;
    }

    if (!this.opts.debug) {
      // content length may vary in debug mode
      ctx.headers.set('Content-Length', info.size.toString());
      ctx.headers.set('ETag', info.checksome);
    }

    if (this.opts.cache && !this.opts.debug) {
      // only set cache-control, we cache enabled and not in debug mode
      const etag = ctx.headers.get('if-none-match');
      if (etag && etag === info.checksome) {
        ctx.abort(304);
        return;
      }

      ctx.headers.set('Cache-Control', `public, max-age=${this.maxAgeSeconds}`);
    }
    if (!head) {
      console.log('streaming found')
      const options = this.streamOptions(ctx);
      try {
        // TODO: prune from info incase file is not available
        const body = createReadStream(absfile, options);
        ctx.reply({
          status: options.start ? 206 : 200,
          body,
          headers: { 'content-type': file.mime || info.mime },
        });
      } catch (err) {
        console.log(err);
        delete this.store[absfile];
      }
      return;
    }

    ctx.reply({
      status: 200,
      body: '',
      headers: { 'content-type': file.mime || info.mime },
    });
  }
}