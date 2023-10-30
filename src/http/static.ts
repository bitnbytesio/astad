import * as path from "node:path";
import * as fs from "node:fs/promises";

import { IHttpContext } from "./context.js";

export interface IHttpStaticOpts {
  root?: string
}



export class HttpStatic {
  constructor(readonly opts: IHttpStaticOpts = {}) {
    if (!this.opts.root) {
      this.opts.root = path.join(process.cwd());
    }
  }

  static middleware(opts: Partial<IHttpStaticOpts> = {}) {
    const instance = new HttpStatic(opts);
    return instance.handle.bind(this);
  }

  async handle(ctx: IHttpContext, next: any) {
    if (ctx.method == 'GET' || ctx.method == 'HEAD') {
      await fs.stat(ctx.path);
    }

    await next();
  }
}