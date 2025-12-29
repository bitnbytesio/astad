import { IHttpContext } from "../../http/context.js";
import { TestHttpContext } from "./context.js";
import { ITestHttpContext, ITestHttpResponse } from "./contracts.js";

/**
 * Middleware function type
 */
export type HttpMiddlewareFn = (ctx: IHttpContext, next: () => Promise<void>) => Promise<void>;

/**
 * Middleware class type
 */
export interface IHttpMiddlewareClass {
  handle(ctx: IHttpContext, next: () => Promise<void>): Promise<void>;
}

/**
 * Result from testing middleware
 */
export interface ITestMiddlewareResult {
  /** The context after middleware execution */
  ctx: TestHttpContext;
  /** The response set by middleware */
  response: ITestHttpResponse;
  /** Whether next() was called */
  nextCalled: boolean;
  /** Any error thrown by middleware */
  error: Error | null;
  /** Whether middleware completed successfully */
  success: boolean;
  /** Whether context was aborted */
  aborted: boolean;
  /** Get a value from context state */
  value<T = any>(key: any): T | undefined;
  /** Get response header */
  getHeader(name: string): string | string[] | undefined;
}

/**
 * Options for middleware test
 */
export interface ITestMiddlewareOptions {
  /** Mock next() behavior */
  nextBehavior?: 'call' | 'skip' | 'throw';
  /** Error to throw if nextBehavior is 'throw' */
  nextError?: Error;
  /** Pre-set context values */
  contextValues?: Record<any, any>;
}

/**
 * TestMiddleware provides utilities for testing HTTP middleware in isolation.
 *
 * @example
 * ```ts
 * const tester = new TestMiddleware(authMiddleware);
 *
 * // Test with valid auth
 * const result = await tester.run({
 *   path: '/api/users',
 *   headers: { authorization: 'Bearer valid-token' }
 * });
 * expect(result.nextCalled).toBe(true);
 *
 * // Test with invalid auth
 * const failResult = await tester.run({
 *   path: '/api/users',
 *   headers: {}
 * });
 * expect(failResult.response.status).toBe(401);
 * ```
 */
export class TestMiddleware {
  private middleware: HttpMiddlewareFn;

  constructor(middleware: HttpMiddlewareFn | IHttpMiddlewareClass) {
    if (typeof middleware === 'function') {
      this.middleware = middleware;
    } else {
      this.middleware = middleware.handle.bind(middleware);
    }
  }

  /**
   * Run the middleware with the given request context
   *
   * @param request - Test request context
   * @param options - Test options
   */
  async run(
    request: ITestHttpContext,
    options: ITestMiddlewareOptions = {}
  ): Promise<ITestMiddlewareResult> {
    const ctx = new TestHttpContext(request);

    // Apply pre-set context values
    if (options.contextValues) {
      for (const [key, value] of Object.entries(options.contextValues)) {
        ctx.set(key, value);
      }
    }

    let nextCalled = false;
    let error: Error | null = null;

    const next = async () => {
      nextCalled = true;
      if (options.nextBehavior === 'throw' && options.nextError) {
        throw options.nextError;
      }
    };

    try {
      await this.middleware(ctx, next);
    } catch (err: any) {
      error = err;
    }

    return {
      ctx,
      response: ctx.response,
      nextCalled,
      error,
      success: error === null,
      aborted: ctx.aborted,
      value<T = any>(key: any): T | undefined {
        return ctx.value(key);
      },
      getHeader(name: string): string | string[] | undefined {
        return ctx.response.headers[name.toLowerCase()];
      },
    };
  }

  /**
   * Run middleware and expect next() to be called
   */
  async runExpectNext(
    request: ITestHttpContext,
    options: ITestMiddlewareOptions = {}
  ): Promise<ITestMiddlewareResult> {
    const result = await this.run(request, options);
    if (!result.nextCalled) {
      throw new Error('Expected next() to be called but it was not');
    }
    return result;
  }

  /**
   * Run middleware and expect it to abort/respond without calling next()
   */
  async runExpectAbort(
    request: ITestHttpContext,
    options: ITestMiddlewareOptions = {}
  ): Promise<ITestMiddlewareResult> {
    const result = await this.run(request, options);
    if (result.nextCalled) {
      throw new Error('Expected middleware to abort but next() was called');
    }
    return result;
  }

  /**
   * Run middleware and expect it to throw an error
   */
  async runExpectError(
    request: ITestHttpContext,
    options: ITestMiddlewareOptions = {}
  ): Promise<ITestMiddlewareResult> {
    const result = await this.run(request, options);
    if (result.success) {
      throw new Error('Expected middleware to throw an error but it succeeded');
    }
    return result;
  }
}

/**
 * Chain multiple middlewares together for testing
 *
 * @param middlewares - Array of middleware functions or classes
 * @returns Combined middleware function
 */
export function chainMiddleware(
  ...middlewares: (HttpMiddlewareFn | IHttpMiddlewareClass)[]
): HttpMiddlewareFn {
  const fns = middlewares.map(m =>
    typeof m === 'function' ? m : m.handle.bind(m)
  );

  return async (ctx: IHttpContext, next: () => Promise<void>) => {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;

      const fn = i < fns.length ? fns[i] : next;
      if (!fn) return;

      await fn(ctx, () => dispatch(i + 1));
    };

    return dispatch(0);
  };
}

/**
 * Create a simple pass-through middleware for testing
 */
export function createPassthroughMiddleware(): HttpMiddlewareFn {
  return async (_ctx, next) => {
    await next();
  };
}

/**
 * Create a middleware that sets context values
 */
export function createContextSetterMiddleware(
  values: Record<any, any>
): HttpMiddlewareFn {
  return async (ctx, next) => {
    for (const [key, value] of Object.entries(values)) {
      ctx.set(key, value);
    }
    await next();
  };
}

/**
 * Create a middleware that aborts with a status
 */
export function createAbortMiddleware(status: number, message?: string): HttpMiddlewareFn {
  return async (ctx, _next) => {
    ctx.abort(status, message);
  };
}
