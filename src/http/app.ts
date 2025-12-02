import { AsyncLocalStorage } from 'node:async_hooks';
import { Server } from 'node:http';
import { IHttpContext } from './context.js';
import { composeAsync } from '../support/compose.js';
import { HttpRouter } from './index.js';
import { IViewEngine } from './view.js';
import { HTTP_KEY_REQ_ID, HTTP_KEY_VIEW_PROVIDER } from './consts.js';
import { ResultError } from '../support/result.js';

export class HttpApp {
  protected asyncLocalStorage?: AsyncLocalStorage<any>;
  protected middlewares: HttpAppMiddleware[] = [];
  protected composedMiddleware: any = null;
  protected _router: HttpRouter;
  protected viewProvider: IViewEngine | null = null;
  protected correlationIdCount = 0;
  protected correlationIdGenerator: HttpCorrelationIdGenerator = () => this.correlationIdCount++;
  protected errorListeners = [];

  constructor(protected opts: IHttpAppOpts) {
    if (this.opts.asyncLocalStorage) {
      this.asyncLocalStorage = this.opts.asyncLocalStorage instanceof AsyncLocalStorage ? this.opts.asyncLocalStorage : new AsyncLocalStorage();
    }
    if (!this.opts.defaultErrorMessage) {
      this.opts.defaultErrorMessage = 'Internal server error.';
    }
    this._router = new HttpRouter();
  }

  getAsyncLocalStorage() {
    if (!(this.asyncLocalStorage instanceof AsyncLocalStorage)) {
      throw new Error('Async local store not available');
    }
    return this.asyncLocalStorage as AsyncLocalStorage<any>;
  }

  /**
   * application middleware
   * @param fn 
   */
  use(fn: HttpAppMiddleware) {
    if (typeof fn == "object" && typeof fn.handle == 'function') {
      fn = fn.handle.bind(fn);
    }
    this.middlewares.push(fn);
  }

  /**
   * set view engine
   * @param provider 
   */
  viewEngine(provider: IViewEngine) {
    this.viewProvider = provider;
  }

  getRouter() {
    return this._router;
  }

  router(router: HttpRouter): void
  router(prefix: string, router: HttpRouter): void
  router(...args: any) {
    this._router.use(...args);
  }

  correlationIdProvider(provider: HttpCorrelationIdGenerator) {
    this.correlationIdGenerator = provider;
  }

  handler() {
    // compose middlewares
    this.composedMiddleware = composeAsync(this.middlewares);

    const middleware = async (ctx: IHttpContext, next: any) => {
      try {
        const reqid = this.correlationIdGenerator().toString();
        ctx.headers.set('x-req-id', reqid);
        // put view provider in context
        ctx.put(HTTP_KEY_REQ_ID, reqid);
        ctx.put(HTTP_KEY_VIEW_PROVIDER, this.viewProvider);

        // execute application middlewares
        await this.composedMiddleware(ctx, async (ctx: IHttpContext, next: any) => {
          // find route
          const route = this._router.find(ctx.method as any, ctx.path, ctx.params);
          if (!route) {
            // handover control to next middleware
            await next();
            return;
          }
          // execute route, it will handover control to next middleware
          await route.getComposedHandler()(ctx, next);
        });

        if (ctx.aborted && (this.viewProvider && ctx.accepts('html'))) {
          ctx.reply({
            status: ctx.response.status,
            body: await this.viewProvider.renderError(ctx, { status: ctx.response.status, ...ctx.response.body }),
          });
        }

        // handover control to framework
        await next();
      } catch (err: any) {
        if (this.opts.dontHandleException) {
          throw err;
        }

        console.error(err);
        err.code = err.statusCode || err.status || err.code || 500;
        const message = err.code < 500 || err.expose ? err.message : this.opts.defaultErrorMessage as string;
        let status = Number.isNaN(Number(err.code)) ? 500 : Number(err.code);
        if (status < 100 || status > 599) {
          status = 500;
        }

        if (this.viewProvider && ctx.accepts('html')) {
          try {
            const resultError = ResultError.try(err);
            const renderedError = await this.viewProvider.renderError(ctx, resultError);
            ctx.reply({
              status: status,
              body: renderedError,
            });
          } catch (err: any) {
             console.error(err);
             
            const data: any = { message };
            if (err.code == 422 && err.errors) {
              data.errors = err.errors;
            }
            ctx.json(data, err.code);
          }
        } else {
          const data: any = { message };
          if (err.code == 422 && err.errors) {
            data.errors = err.errors;
          }
          ctx.json(data, err.code);
        }
      }
    };

    if (this.asyncLocalStorage) {
      return (ctx: IHttpContext, next: any) => {
        return (this.asyncLocalStorage as AsyncLocalStorage<any>).run(ctx, async () => await middleware(ctx, next));
      };
    }

    return middleware;
  }

  listen(cb?: Function): Server {
    const handler = this.handler();

    this.opts.use.handler(handler);

    return this.opts.use.listen(
      this.port(),
      this.host(),
      () => {
        console.info(`Server is listening ${this.address()}.`);
        if (typeof cb == 'function') {
          cb();
        }
      },
    );
  }

  port(): string {
    return this.opts.conf.var('APP_PORT') || '3000';
  }

  host(): string {
    return this.opts.conf.var('APP_HOST') || '127.0.0.1';
  }

  address(): string {
    return `${this.host()}:${this.port()}`;
  }
}

export interface IHttpAppOptUse {
  handler(fn: any): void
  use(...args: any): any
  listen(...args: any): Server
}

export interface IHttpAppOptConf {
  get<T = any>(key: any): T | null
  var(key: any): string | undefined
  //dvar<T = any>(key: any): T | undefined
  set<T = any>(key: any, value: T): T
}

export interface IHttpAppOpts {
  use: IHttpAppOptUse
  conf: IHttpAppOptConf
  asyncLocalStorage?: boolean | AsyncLocalStorage<any>,
  host?: string,
  port?: number,
  defaultErrorMessage?: string
  /**
   * set true, when you want to handle exception with framework instead of http app
   */
  dontHandleException?: boolean
}

export interface IHttpMiddleware {
  handle(ctx: IHttpContext, next: any): Promise<any>
}

export type HttpMiddlewareCallback = (ctx: IHttpContext, next: any) => Promise<any>;

export type HttpAppMiddleware = HttpMiddlewareCallback | IHttpMiddleware;

export type HttpCorrelationIdGenerator = () => { toString(): string };