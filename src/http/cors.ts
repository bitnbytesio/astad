import { IHttpContext } from './context.js';

const defaultOptions = {
  origin: '*',
  credentials: false,
  maxAge: 86400, // in seconds
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'content-type',
    'authorization',
    'accept',
    'referer',
    'user-agent',
    'Content-Transfer-Encoding',
    'Content-Disposition',
    'Content-Type',
  ],
  exposeHeaders: [],
};

export interface HttpCorsOpts {
  origin: string
  credentials: boolean
  maxAge: number // in seconds
  allowMethods: string[]
  allowHeaders: string[]
  exposeHeaders: string[]
}

export class HttpCors {
  opts: HttpCorsOpts & Record<string, any>;

  constructor(opts: Partial<HttpCorsOpts> = {}) {
    this.opts = { ...defaultOptions, ...opts };
  }

  static middleware(opts: Partial<HttpCorsOpts> = {}) {
    const cors = new HttpCors(opts);
    return cors.handle;
  }

  /**
   * 
   * @param ctx 
   * @param next 
   * @returns {Promise<any>}
   */
  handle(ctx: IHttpContext, next: any) {
    ctx.headers.set('Access-Control-Allow-Origin', this.opts.origin);

    if (ctx.method.toLowerCase() === 'options') {
      // Preflight Request
      if (!ctx.headers.get('access-control-request-method')) {
        ctx.noContent();
        return Promise.resolve();
      }

      // Access-Control-Max-Age
      if (this.opts.maxAge) {
        ctx.headers.set('Access-Control-Max-Age', String(this.opts.maxAge));
      }

      // Access-Control-Allow-Credentials
      if (this.opts.credentials === true) {
        // When used as part of a response to a preflight request,
        // this indicates whether or not the actual request can be made using credentials.
        ctx.headers.set('Access-Control-Allow-Credentials', 'true');
      }

      // Access-Control-Allow-Methods
      if (this.opts.allowMethods.length) {
        ctx.headers.set('Access-Control-Allow-Methods', this.opts.allowMethods.join(','));
      }

      // Access-Control-Allow-Headers
      if (this.opts.allowHeaders.length) {
        ctx.headers.set('Access-Control-Allow-Headers', this.opts.allowHeaders.join(','));
      } else {
        ctx.headers.set('Access-Control-Allow-Headers', ctx.headers.get('access-control-request-headers') || '*');
      }


      // Access-Control-Expose-Headers
      if (this.opts.exposeHeaders.length) {
        ctx.headers.set('Access-Control-Expose-Headers', this.opts.exposeHeaders.join(','));
      }

      ctx.noContent();
      return Promise.resolve();
    }

    return next() as Promise<any>;
  }
}
