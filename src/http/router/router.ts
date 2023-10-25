import { IRouterOptions, HTTP_METHOD, RouteHandlerCallback, RouteMiddlewareCallback } from './contracts.js';
import { HttpRoute } from './route.js';

export class HttpRouter<Signature = RouteHandlerCallback> {
  readonly routes: Array<HttpRoute> = []
  readonly opts: IRouterOptions;
  readonly _prefix: string = '';
  readonly middlewares: RouteMiddlewareCallback[] = [];

  readonly staticRoutes: NodeJS.Dict<HttpRoute> = {};

  constructor(options: Partial<IRouterOptions> = {}) {
    this.opts = this.opts = configureRouterOpts(options);
    this._prefix = this.opts.prefix;
    if (this._prefix == '/') {
      this._prefix = '';
    }
    this.middlewares = this.opts.middlewares;
  }

  get<T = Signature>(path: string, handler: T) {
    return this.add<T>('GET', path, handler);
  }

  post<T = Signature>(path: string, handler: T) {
    return this.add<T>('POST', path, handler);
  }

  put<T = Signature>(path: string, handler: T) {
    return this.add<T>('PUT', path, handler);
  }

  patch<T = Signature>(path: string, handler: T) {
    return this.add<T>('PATCH', path, handler);
  }

  delete<T = Signature>(path: string, handler: T) {
    return this.add<T>('DELETE', path, handler);
  }

  head<T = Signature>(path: string, handler: T) {
    return this.add<T>('HEAD', path, handler);
  }

  options<T = Signature>(path: string, handler: T) {
    return this.add<T>('OPTIONS', path, handler);
  }

  any<T = Signature>(path: string, handler: T) {
    return this.add<T>('*' as any, path, handler);
  }

  all<T = Signature>(methods: HTTP_METHOD[], path: string, handler: T) {
    const routes = [];
    for (const method of methods) {
      routes.push(this.add<T>(method, path, handler));
    }
    return routes;
  }

  add<T = Signature>(method: HTTP_METHOD, path: string, handler: T) {
    if (path[0] !== '/') {
      throw new Error(`Path ${path} must start with slash(/).`);
    }
    if (path.length > 1 && path.slice(-1) === '/') {
      throw new Error(`Path ${path} must not end with slash(/).`);
    }
    const route = new HttpRoute<T>([method], this.makePath(path), handler);
    if (this.middlewares.length) {
      route.middleware(...this.middlewares);
    }
    this.routes.push(route);
    this.static(route);
    return route;
  }

  prefix(prefix: string) {
    return new LinkedRouter(this, { prefix });
  }

  middleware(...middlewares: RouteMiddlewareCallback[]) {
    return new LinkedRouter(this, { middlewares });
  }

  addRoute(route: HttpRoute) {
    this.routes.push(route);
    this.static(route)
    return route;
  }

  static(route: HttpRoute) {
    if (route.isStatic()) {
      for (const method of route.methods) {
        this.staticRoutes[`${method}${route.getPath()}`] = route;
      }
    }
  }

  // merge<T = any>(method: HTTP_METHOD, path: string, handler: T) {
  //   const route = new Route<T>(method, path, handler);
  //   this.opts.composeHandler(route);
  //   this.routes.push(route);

  //   this.static(route)

  //   return route;
  // }



  makePath(path: string) {
    if (!this._prefix) {
      return path;
    }

    if (this._prefix === '/' && path[0] === '/') {
      return path;
    }

    return `${this._prefix}${path}`;
  }

  mergeRouters(routers: Array<HttpRouter>, options: { prefix?: string, merge?: boolean } = {}) {
    for (const router of routers) {
      for (const route of router.routes) {
        if (options.merge) {
          // no need reprefix
          this.addRoute(route);
          return;
        }

        // clone route
        const nroute = route.clone();

        // figure out prefix
        let prefix = options.prefix ? options.prefix + this._prefix : this._prefix;

        if (!prefix || prefix === '/') {
          prefix = '';
        }

        // prefix route path
        let routePath = nroute.getPath();
        routePath = prefix + routePath;
        if (routePath.endsWith('/')) {
          // remove trailing slash
          routePath = routePath.slice(0, routePath.length - 1)
        }
        nroute.setPath(routePath);

        // add route
        this.addRoute(nroute);
      }
    }
    // routers.forEach((router) => {
    //   // if (merge && !options.prefix) {
    //   //   this.routes.push(...router.routes.map((route: Route) => {
    //   //     this.static(route);
    //   //     return route;
    //   //   }));
    //   //   return;
    //   // }

    //   router.routes.forEach((route: Route) => {
    //     if (merge) {
    //       this.addRoute(route);
    //       return;
    //     }

    //     let routePath = route.getPath();

    //     if (options.prefix) {
    //       if (options.prefix === '/') {
    //         options.prefix = '';
    //       }

    //       routePath = options.prefix + route.getPath();

    //       if (routePath.endsWith('/')) {
    //         // remove trailing slash
    //         routePath = routePath.slice(0, routePath.length - 1)
    //       }
    //     }


    //     this.addRoute(route);
    //   });
    // });
  }

  use(...args: CallableFunction[]): void;
  use(...args: HttpRouter[]): void;
  use(prefix: string, ...args: HttpRouter[]): void;
  use(prefix: string, merge: boolean, ...args: HttpRouter[]): void;
  use(...args: any[]) {
    // if we got only one arg
    if (args.length === 1) {
      const [what] = args;
      // append routes
      if (what instanceof HttpRouter) {
        console.log(`merge single in(${this._prefix})`, what._prefix,)
        this.mergeRouters([what]);
        return;
      }
      if (typeof what == 'function') {
        this.middlewares.push(what);
        if (this.routes.length) {
          this.routes.forEach(route => route.middleware(what));
        }
      }
      throw new Error('Expects an instance of Router or a CallableFunction for middleware.');
    } else if (args.length >= 2) {
      const [prefix, ismerge, ...routes] = args;
      // first param should be prefix
      if (typeof prefix !== 'string') {
        throw new Error('First parameter should be path.');
      }
      const merge = typeof ismerge == 'boolean';
      if (!merge) {
        routes.push(ismerge);
      }
      for (const route of routes) {
        if (!(route instanceof HttpRouter)) {
          throw new Error('Routers expected after path.');
        }
      }
      // append routes
      this.mergeRouters(routes, { prefix, merge });
      return;
    }
  }

  find(method: HTTP_METHOD, path: string, params: NodeJS.Dict<string> = {}) {
    if (path.endsWith('/')) {
      // ignore trailing slash(/)
      path = path.slice(0, path.length - 1);
    }

    const staticRoute = this.staticRoutes[`${method}${path}`];

    if (staticRoute) {
      return staticRoute;
    }

    const len = this.routes.length;

    for (let i = 0; i < len; i++) {
      const r = this.routes[i];
      const matched = r.match(path, params);
      if (matched && r.matchMethod(method)) {
        return r;
      }
    }

    return false;
  }
}

class LinkedRouter<Signature = RouteHandlerCallback> {
  readonly opts: IRouterOptions;
  readonly middlewares: RouteMiddlewareCallback[] = [];
  readonly _prefix: string = '';
  constructor(readonly router: HttpRouter, options: Partial<IRouterOptions> = {}) {
    this.opts = configureRouterOpts(options);
    this.middlewares = this.opts.middlewares;
    this._prefix = this.opts.prefix;
    if (this._prefix == '/') {
      this._prefix = '';
    }

    // for (const property of Object.getOwnPropertyNames(router)) {
    //   Object.defineProperty(this, property, Object.getOwnPropertyDescriptor(router, property) as any);
    // }
    // const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    // for (const method of methods) {

    //   this[method] = (path: string, handler) => {
    //     return this.add<T>(method.toUpperCase(), path, handler);
    //   };
    // }
  }

  middleware(...middlewares: RouteMiddlewareCallback[]) {
    this.middlewares.push(...middlewares);
  }

  get<T = Signature>(path: string, handler: T) {
    return this.add<T>('GET', path, handler);
  }

  post<T = Signature>(path: string, handler: T) {
    return this.add<T>('POST', path, handler);
  }

  put<T = Signature>(path: string, handler: T) {
    return this.add<T>('PUT', path, handler);
  }

  patch<T = Signature>(path: string, handler: T) {
    return this.add<T>('PATCH', path, handler);
  }

  delete<T = Signature>(path: string, handler: T) {
    return this.add<T>('DELETE', path, handler);
  }

  head<T = Signature>(path: string, handler: T) {
    return this.add<T>('HEAD', path, handler);
  }

  options<T = Signature>(path: string, handler: T) {
    return this.add<T>('OPTIONS', path, handler);
  }

  all<T = Signature>(methods: HTTP_METHOD[], path: string, handler: T) {
    const routes = [];
    for (const method of methods) {
      routes.push(this.add<T>(method, path, handler));
    }
    return routes;
  }

  any<T = Signature>(path: string, handler: T) {
    return this.add<T>('*' as any, path, handler);
  }

  add<T = Signature>(method: HTTP_METHOD, path: string, handler: T) {
    path = this._prefix + path;
    if (path.endsWith('/')) {
      // remove trailing slash
      path = path.slice(0, path.length - 1)
    }
    const route = this.router.add(method, path, handler);
    if (this.middlewares.length) {
      route.middleware(...this.middlewares);
    }
    return route;
  }
}

function configureRouterOpts(options: Partial<IRouterOptions> = {}) {
  const opts = {
    prefix: '/',
    ignoreTrailingSlash: true,
    staticref: true,
    middlewares: [],
    composeHandler(_: HttpRoute) {
    },
    ...options,
  };

  if (opts.prefix) {
    if (opts.prefix[0] !== '/') {
      throw new Error(`Prefix ${opts.prefix} must start with slash(/).`);
    }
    if (opts.prefix.length > 1 && opts.prefix.slice(-1) === '/') {
      throw new Error(`Prefix ${opts.prefix} must not end with slash(/).`);
    }
  }

  return opts;
}