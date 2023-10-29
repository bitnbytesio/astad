import { AsyncLocalStorage } from "async_hooks";
import { HTTP_KEY_REQ_ID } from "../../http/consts.js";
import { HttpRouter } from "../../index.js";
import { TestHttpContext } from "./context.js";
import { ITestHttpContext } from "./contracts.js";
import { IHttpContext } from "../../http/context.js";

export function TestHttpRouter(router: HttpRouter) {
  let correlationIdCount = 0;
  const correlationIdGenerator = () => correlationIdCount++;
  const asyncLocalStorage = new AsyncLocalStorage<IHttpContext>();

  const handler = async (ctx: IHttpContext) => {
    try {
      const reqid = correlationIdGenerator().toString();
      ctx.headers.set('x-req-id', reqid);
      ctx.set(HTTP_KEY_REQ_ID, reqid);

      const route = router.find(ctx.method as any, ctx.path, ctx.params);
      if (route) {
        // execute route
        await route.getComposedHandler()(ctx, async () => { });
        return;
      }
      ctx.json({ message: 'Route not found' }, 404);
    } catch (err: any) {
      ctx.set('errored', err);
      const status = err.statusCode || err.status || err.code || 500;
      //const message = status < 500 || err.expose ? err.message : 'Internal server error.';
      const message = err.message;
      const data: any = { message };
      if (status == 422 && err.errors) {
        data.errors = err.errors;
      }
      ctx.json(data, status);
    }
  };

  return {
    asyncLocalStorage,
    req(req: ITestHttpContext) {
      return {
        async exec() {
          // create context
          const ctx = new TestHttpContext(req);

          // execute handler in async context
          await asyncLocalStorage.run(ctx, async () => {
            await handler(ctx)
          });

          /**
           * create response object
           */
          return new class implements ITestHttpRouteResponse {
            error = ctx.value<Error>('errored') || null;
            headers = ctx.response.headers
            status = ctx.response.status
            _jsonbody: any = null;

            hasError() {
              return !!this.error;
            }
            body<T = any>() {
              return ctx.response.body as T;
            }
            json<T = any>() {
              if (this._jsonbody) {
                return this._jsonbody as T;
              }
              return this._jsonbody = JSON.parse(JSON.stringify(ctx.response.body)) as T;
            }
            getHeader(name: string): string | undefined {
              const val = ctx.response.headers[name.toLowerCase()];
              if (Array.isArray(val)) {
                return val[0]
              }
              return val;
            }
          } as ITestHttpRouteResponse;
        },
      };
    },
  };
}

export interface ITestHttpRouteResponse {
  error: any
  headers: Record<string, string | string[]>
  status: number
  hasError(): boolean
  body<T = any>(): T
  json<T = any>(): T
  getHeader(name: string): string | undefined
}