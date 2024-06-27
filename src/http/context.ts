import * as internal from 'node:stream';
import { IHttpError, IHttpResponse } from './response.js';
import { deepClone } from '../support/obj.js';

export interface IHttpCookieOpts {
  // maxAge: a number representing the milliseconds from Date.now() for expiry.
  maxAge?: number
  // expires: a Date object indicating the cookie's expiration date (expires at the end of session by default).

  expires?: Date,
  path?: string
  domain?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'strict' | 'lax' | 'none' | boolean
  signed?: boolean
  overwrite?: boolean
}

export interface IHttpCookies {
  get(name: string): string | undefined
  set(name: string, value: string, options?: IHttpCookieOpts): any
}

export interface IHttpContext {
  query: HttpRequestQuery
  headers: HttpRequestHeaders
  cookies: IHttpCookies
  params: Record<string, string>
  /**
   * request body
   */
  body: any
  /**
   * uploaded files
   */
  files: any
  host: string
  path: string
  method: string
  url: URL
  href: string
  origin: string
  protocol: string
  secure: boolean
  ip: string
  ips: string[]
  response: IHttpResponse
  aborted: boolean
  is(...types: string[]): string | null | false
  accepts(...types: string[]): string | false
  getHeader(key: string): string | string[] | undefined
  json(data: any, status?: number): void
  noContent(): void
  created(): void
  throw(status: number, message: string): never
  abort(status: number, message?: string): void
  abort(error: IHttpError): void
  reply(response: IHttpResponse): void
  view(template: any, data?: any, status?: number): Promise<any>
  stream(stream: internal.Readable, mime?: string): void
  redirect(url: string, alt?: string): void
  // shouldRender(): boolean
  // getView(): { template: string, data: any }
  /**
   * @deprecated Use {@link put} instead
   * @param key 
   * @param value 
   */
  set<T = any>(key: any, value: T): T
  put<T = any>(key: any, value: T): T
  value<T = any>(key: any): T | undefined
}

export class HttpRequestHeaders {
  constructor(
    readonly headers: Record<string, string | string[]>,
    readonly setHeaderCb: (k: string, v: string | string[]) => any,
  ) { }

  /**
   * read header value
   * @param key 
   * @returns {string|undefined}
   */
  get(key: string) {
    key = key.toLowerCase();
    if (!this.headers[key]) {
      return undefined;
    }
    if (Array.isArray(this.headers[key])) {
      return this.headers[key][0] as string;
    }
    return this.headers[key] as string;
  }

  value<T = string | string[]>(key: string, defaultValue: string | null = null) {
    return (this.get(key) || defaultValue) as T;
  }

  array(key: string) {
    key = key.toLowerCase();
    return Array.isArray(this.headers[key]) ? this.headers[key] : [this.headers[key]];
  }

  all(key: string) {
    return this.array(key);
  }

  set(key: string, value: string) {
    this.setHeaderCb(key, value);
  }

  /**
   * @added v0.2.12
   * @returns
   */
  toObject() {
    return deepClone(this.headers);
  }
}

export class HttpRequestQuery {
  constructor(readonly query: Record<string, string | string[]>) { }

  get(key: string): string | undefined {
    if (Array.isArray(this.query[key])) {
      return this.query[key][0];
    }
    return this.query[key] as string;
  }

  array(key: string) {
    return Array.isArray(this.query[key]) ? this.query[key] : [this.query[key]];
  }

  all(key: string) {
    return this.array(key);
  }

  toString() {
    const qs = [];
    for (const key in this.query) {
      const vals = this.array(key);
      for (const val of vals) {
        qs.push(`${key}=${val}`)
      }
    }
    return qs.join('&');
  }

  toObject() {
    return deepClone(this.query);
  }
}

export class HttpCookies {
  cookies: Record<string, any> = {};
  constructor(readonly raw: string) {
    const carray = raw.split(';');
    for (const citem of carray) {
      let [name, value, ...rest] = citem.split('=');
      name = name?.trim();
      if (name) {

      }
      // const value = rest.join(`=`).trim();
      this.cookies[name] = { value, rest };

    }
  }

  get(name: string) {
    return this.cookies[name]?.value;
  }

  set(name: string, value: string, opts: IHttpCookieOpts) {
    this.cookies[name] = { value, ...opts };
  }
}