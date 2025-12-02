import { IHttpContext } from './context.js';

const defaultOptions = {
  origin: '*',
  credentials: false,
  maxAge: 86400, // in seconds
  privateNetworkAccess: false,
  secureContext: false,
  allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Authorization',
    'Accept',
    'Referer',
    // 'User-Agent',
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
  privateNetworkAccess: boolean
  secureContext: boolean
  allowMethods: string[]
  allowHeaders: string[]
  exposeHeaders: string[]
}

/**
 * CORS middleware
 * @todo handle vary origin (https://stackoverflow.com/questions/44800431/caching-effect-on-cors-no-access-control-allow-origin-header-is-present-on-th)
 */
export class HttpCors {
  opts: HttpCorsOpts & Record<string, any>;

  constructor(opts: Partial<HttpCorsOpts> = {}) {
    this.opts = { ...defaultOptions, ...opts };
  }

  static middleware(opts: Partial<HttpCorsOpts> = {}) {
    const cors = new HttpCors(opts);
    return cors.handle.bind(cors);
  }

  /**
   * 
   * @param ctx 
   * @param next 
   * @returns {Promise<any>}
   */
  handle(ctx: IHttpContext, next: any) {
    /**
     * common headers are kept outside of conditions
     * origin,credentials,secureContext
     */

    // always allow given origin
    ctx.headers.set('Access-Control-Allow-Origin', this.opts.origin);

    // Access-Control-Allow-Credentials
    if (this.opts.credentials === true) {
      // When used as part of a response to a preflight request,
      // this indicates whether or not the actual request can be made using credentials.
      ctx.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    if (this.opts.secureContext) {
      ctx.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      ctx.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    if (ctx.method.toLowerCase() === 'options') {
      // preflight request handling

      if (!ctx.headers.get('access-control-request-method')) {
        // this not preflight request, ignore it
        return next() as Promise<any>;
      }

      // Access-Control-Max-Age
      if (this.opts.maxAge) {
        ctx.headers.set('Access-Control-Max-Age', String(this.opts.maxAge));
      }

      if (this.opts.privateNetworkAccess && ctx.headers.get('Access-Control-Request-Private-Network')) {
        ctx.headers.set('Access-Control-Allow-Private-Network', 'true');
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

      ctx.noContent();

      return Promise.resolve();
    }

    // Access-Control-Expose-Headers
    if (this.opts.exposeHeaders.length) {
      ctx.headers.set('Access-Control-Expose-Headers', this.opts.exposeHeaders.join(','));
    }

    return next() as Promise<any>;
  }
}
