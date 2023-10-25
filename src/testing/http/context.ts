import * as internal from 'node:stream';

import { HttpRequestHeaders, HttpRequestQuery, IHttpContext } from '../../http/context.js';
import { HttpResponse } from '../../http/response.js';
import { IViewEngine } from '../../http/view.js';
import { HTTP_KEY_VIEW_PROVIDER } from '../../http/consts.js';
import { IHttpFile, ITestHttpContext, ITestHttpResponse } from './contracts.js';
import { TestHttpError } from './error.js';


export class TestHttpContext implements IHttpContext {
  query: HttpRequestQuery;
  headers: HttpRequestHeaders;
  params = {};
  willRender = false;
  state: Record<any, any> = {};
  response: ITestHttpResponse = {
    headers: {},
    status: 404,
    body: undefined,
  }

  protected _reply: HttpResponse | null = null;

  parseHeaders(headers: any) {
    const lowerd: any = {}
    for (const key in headers) {
      lowerd[key.toLowerCase()] = headers[key];
    }
    return lowerd;
  }

  constructor(protected ctx: ITestHttpContext) {
    this.query = new HttpRequestQuery(ctx.query || {});
    this.headers = new HttpRequestHeaders(
      this.parseHeaders(ctx.headers || {}),
      (k: string, v: string | string[]) => {
        this.setHeader(k, v);
      });
  }

  modify(ctx: ITestHttpContext) {
    this.ctx = ctx;
    this.query = new HttpRequestQuery(ctx.query || {});
    this.headers = new HttpRequestHeaders(
      this.parseHeaders(ctx.headers || {}),
      (k: string, v: string | string[]) => {
        this.setHeader(k, v);
      });
  }

  setHeader(k: string, v: string | string[]) {
    this.response.headers[k] = v;
  }

  get host() {
    return this.ctx.host || '127.0.0.1' as string;
  }

  get path() {
    return this.ctx.path as string;
  }

  get method() {
    return this.ctx.method || 'GET' as string;
  }

  createUrl() {
    const base = this.origin;
    return new URL(`${this.path}?${this.query.toString()}`, base);
  }

  get url() {
    return this.ctx.URL || this.createUrl();
  }

  get href() {
    return this.url.toString();
  }

  get origin() {
    return `${this.protocol}://${this.host}`;
  }

  get protocol() {
    return this.ctx.protocol || 'http';
  }

  get secure() {
    return this.protocol == 'https';
  }

  get ip() {
    return this.ctx.ip || '127.0.0.1';
  }

  get ips() {
    return this.ctx.ips || [this.ip];
  }

  get body() {
    return this.ctx.body;
  }

  get files() {
    return (this.ctx.files || {}) as Record<string, IHttpFile>;
  }

  is(...types: string[]): string | null | false {
    for (const type of types) {
      const ctype = this.headers.value('content-type', '');
      if (ctype.includes(type)) {
        return ctype as string;
      }
    }
    return false;
  }

  accepts(...types: string[]) {
    for (const type of types) {
      const ctype = this.headers.value('accept', '');
      if (ctype.includes(type)) {
        return ctype as string;
      }
    }
    return false;
  }

  getHeader(key: string) {
    return this.headers.get(key);
  }

  json(data: any, status = 200) {
    this.response.headers['content-type'] = 'application/json';
    this.response.status = status;
    this.response.body = data;
  }

  noContent() {
    this.response.status = 204;
    this.response.body = undefined;
  }

  created() {
    this.response.status = 201;
    this.response.body = undefined;
  }

  throw(status: number, message: string): never {
    throw new TestHttpError(status, message);
  }

  abort(status: number, message?: string): void {
    this.response.status = status;
    this.response.body = { message: message || 'Something went wrong.' };
  }

  /**
   * ununsed
   * @param response 
   */
  reply(response: HttpResponse) {
    this._reply = response;
  }

  stream(stream: internal.Readable, mime: string = 'application/octet-stream') {
    this.response.status = 200;
    this.response.headers['content-type'] = mime;
    this.response.body = stream;
  }

  async view(template: string, data = {}, status = 200) {
    const view = this.value<IViewEngine>(HTTP_KEY_VIEW_PROVIDER);
    if (!view) {
      throw new Error('view engine is not set.');
    }
    this.response.status = status;
    this.response.body = await view.render(template, data);
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