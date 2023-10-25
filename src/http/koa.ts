import { Server } from 'node:http';
import * as internal from 'node:stream';

import { HttpRequestHeaders, HttpRequestQuery, IHttpContext } from './context.js';
import { IViewEngine } from './view.js';
import { HTTP_KEY_VIEW_PROVIDER } from './consts.js';
import { HttpResponse } from './response.js';

export type HttpKoaMiddlewareCallback = (ctx: any, next: any) => Promise<any> | any

export interface IHttpKoa {
  listen(...args: any): Server
  use(fn: HttpKoaMiddlewareCallback): IHttpKoa
}

export class HttpKoa {
  constructor(protected app: IHttpKoa) {

  }

  use(fn: HttpKoaMiddlewareCallback) {
    return this.app.use(fn);
  }

  handler(fn: any) {
    this.app.use(async (ctx: any, next: any) => {
      const httpCtx = new HttpKoaContext(ctx);
      await fn(httpCtx, next);
    });
  }

  listen(...args: any) {
    return this.app.listen(...args);
  }
}

export class HttpKoaContext implements IHttpContext {
  query: HttpRequestQuery;
  headers: HttpRequestHeaders;
  params = {};
  willRender = false;
  state: Record<any, any> = {};

  protected _reply: HttpResponse | null = null;

  constructor(protected ctx: any) {
    this.query = new HttpRequestQuery(ctx.query);
    this.headers = new HttpRequestHeaders(
      ctx.headers,
      (k: string, v: string | string[]) => {
        ctx.set(k, v);
      });
  }

  get host() {
    return this.ctx.request.host as string;
  }

  get path() {
    return this.ctx.request.path as string;
  }

  get method() {
    return this.ctx.request.method as string;
  }

  get url() {
    return this.ctx.request.URL as URL;
  }

  get href() {
    return this.ctx.request.href as string;
  }

  get origin() {
    return this.ctx.request.origin as string;
  }

  get protocol() {
    return this.ctx.request.protocol as string;
  }

  get secure() {
    return this.ctx.request.secure as boolean;
  }

  get ip() {
    return this.ctx.request.ip as string;
  }

  get ips() {
    return this.ctx.request.ips as string[];
  }

  get body() {
    return this.ctx.request.body;
  }

  get files() {
    return this.ctx.request.files || {};
  }

  is(...types: string[]): string | null | false {
    return this.ctx.request.is(...types);
  }

  accepts(...types: string[]) {
    return this.ctx.request.accepts(types);
  }

  getHeader(key: string) {
    return this.ctx.request.header(key);
  }

  json(data: any, status = 200) {
    this.ctx.status = status;
    this.ctx.body = data;
  }

  noContent() {
    this.ctx.status = 204;
    this.ctx.body = undefined;
  }

  created() {
    this.ctx.status = 201;
    this.ctx.body = undefined;
  }

  throw(status: number, message: string) {
    return this.ctx.throw(status, message) as never;
  }

  abort(status: number, message?: string): void {
    this.ctx.status = status;
    this.ctx.body = { message: message || 'Something went wrong.' };
  }

  /**
   * ununsed
   * @param response 
   */
  reply(response: HttpResponse) {
    this._reply = response;
  }

  stream(stream: internal.Readable, mime: string = 'application/octet-stream') {
    this.ctx.status = 200;
    this.ctx.type = mime;
    this.ctx.body = stream;
  }

  async view(template: string, data = {}, status = 200) {
    const view = this.value<IViewEngine>(HTTP_KEY_VIEW_PROVIDER);
    if (!view) {
      throw new Error('view engine is not set.');
    }
    this.ctx.status = status;
    this.ctx.body = await view.render(template, data);
    this.willRender = true;
  }

  shouldRender() {
    return this.willRender;
  }

  // getView(): { template: string; data: any; } {
  //   return this.ctx.body;
  // }

  set<T = any>(key: any, value: T): T {
    return this.state[key] = value
  }

  value<T = any>(key: any): T | undefined {
    return this.state[key];
  }
}