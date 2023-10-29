import { IHttpContext } from '../context.js';

export interface IRouterOptions {
  // router prefix
  prefix: string
  // ignore trailing slash
  ignoreTrailingSlash: boolean
  // keep static routes ref, speed up static routes but consumes more memory
  staticref: boolean
  middlewares: Array<RouteMiddlewareCallback>
}

export type HTTP_METHOD = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type RouteHandlerCallback<C = IHttpContext> = (ctx: C) => Promise<any> | any;
export type RouteNextCallback = () => Promise<any> | any;
export type RouteMiddlewareCallback<C = IHttpContext, N = RouteNextCallback> = (ctx: C, next: N) => Promise<any> | any;