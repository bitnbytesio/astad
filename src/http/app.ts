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

  constructor(protected opts: IHttpAppOpts) {
    if (this.opts.asyncLocalStorage) {
      this.asyncLocalStorage = this.opts.asyncLocalStorage instanceof AsyncLocalStorage ? this.opts.asyncLocalStorage : new AsyncLocalStorage();
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
        ctx.set(HTTP_KEY_REQ_ID, reqid);
        ctx.set(HTTP_KEY_VIEW_PROVIDER, this.viewProvider);

        // execute application middlewares
        await this.composedMiddleware(ctx, async (ctx: IHttpContext, next: any) => {
          // find route
          const route = this._router.find(ctx.method as any, ctx.path, ctx.params);
          if (route) {
            // execute route
            await route.getComposedHandler()(ctx, next);
            return;
          }

          // handover control to next middleware
          await next();
        });
      } catch (err: any) {
        console.error(err);
        // if (ctx.accepts('json')) {

        // }
        err.status = err.statusCode || err.status || err.code || 500;
        const message = err.status < 500 || err.expose ? err.message : 'Internal server error.';
        const resultError = ResultError.try(err);
        if (ctx.accepts('html')) {
          if (this.viewProvider) {
            this.viewProvider.renderError(ctx, resultError)
          }
        } else {
          
          const data: any = { message };
          if (err.status == 422 && err.errors) {
            data.errors = err.errors;
          }
          ctx.json(data, err.status);
        }
        // if (ctx.accepts('json')) {
        //   ctx.json(data, status);
        // } else {
        //   ctx.reply()
        // }
      }

      // template handling
      // if (ctx.shouldRender()) {
      //   // render view
      //   if (!this._view) {
      //     throw new Error('view engine is not set.');
      //   }
      //   const view = ctx.getView();
      //   await this._view.render(view.template, view.data);
      // }

      // handover control to framework
      await next();
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
  asyncLocalStorage?: true | AsyncLocalStorage<any>,
  host?: string,
  port?: number,
}

export interface IHttpMiddleware {
  handle(ctx: any, next: any): Promise<any>
}

export type HttpMiddlewareCallback = (ctx: any, next: any) => Promise<any>;

export type HttpAppMiddleware = HttpMiddlewareCallback | IHttpMiddleware;

export type HttpCorrelationIdGenerator = () => { toString(): string };