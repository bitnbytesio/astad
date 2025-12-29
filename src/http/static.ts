import * as fs from "node:fs/promises";
import { createReadStream } from "node:fs";

import { IHttpContext } from "./context.js";
import { pathsafe } from "../support/path.js";
import { GuessMime } from "../support/mime.js";

export interface IHttpStaticOpts {
  root?: string
  prefix?: string
  index?: string
}

export class HttpStatic {
  constructor(readonly opts: IHttpStaticOpts = {}) {
    if (!this.opts.root) {
      this.opts.root = process.cwd();
    }
  }

  static middleware(opts: Partial<IHttpStaticOpts> = {}) {
    const instance = new HttpStatic(opts);
    return instance.handle.bind(instance);
  }

  get prefix() {
    return this.opts.prefix || '/';
  }

  async handle(ctx: IHttpContext, next: any) {
    await next();

    // Only handle if response is still 404
    if (ctx.response.status !== 404) {
      return;
    }

    // Only handle GET and HEAD requests
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
      return;
    }

    let filePath = ctx.path;
    const prefix = this.prefix;

    // Check if path matches prefix
    if (filePath.indexOf(prefix) !== 0) {
      return;
    }

    // Remove prefix from path
    filePath = filePath.replace(prefix, '');

    // Handle index file for root path
    if ((!filePath || filePath === '/') && this.opts.index) {
      filePath = this.opts.index;
    }

    // Remove leading slash
    if (filePath.startsWith('/')) {
      filePath = filePath.slice(1);
    }

    // Validate path to prevent traversal attacks
    const absfile = pathsafe(filePath, this.opts.root);
    if (!absfile) {
      return; // Path traversal attempt, stay 404
    }

    try {
      const stat = await fs.stat(absfile);
      if (!stat.isFile()) {
        return; // Not a file, stay 404
      }

      const mime = GuessMime(absfile);
      const isHead = ctx.method === 'HEAD';

      ctx.headers.set('Content-Length', stat.size.toString());
      ctx.headers.set('Content-Type', mime);

      if (isHead) {
        ctx.reply({ status: 200, body: '', headers: { 'content-type': mime } });
      } else {
        ctx.reply({
          status: 200,
          body: createReadStream(absfile),
          headers: { 'content-type': mime },
        });
      }
    } catch {
      // File not found or not accessible, stay 404
      return;
    }
  }
}