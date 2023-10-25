import * as internal from 'node:stream';
import { HttpResponse } from './response.js';

export interface IHttpContext {
  query: HttpRequestQuery
  headers: HttpRequestHeaders
  params: Record<string, string>
  body: any
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
  is(...types: string[]): string | null | false
  accepts(...types: string[]): string | false
  getHeader(key: string): string | string[] | undefined
  json(data: any, status?: number): void
  noContent(): void
  created(): void
  throw(status: number, message: string): never
  abort(status: number, message?: string): void
  reply(response: HttpResponse): void
  view(template: any, data?: any, status?: number): Promise<any>
  stream(stream: internal.Readable, mime?: string): void
  // shouldRender(): boolean
  // getView(): { template: string, data: any }
  set<T = any>(key: any, value: T): T
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
}
