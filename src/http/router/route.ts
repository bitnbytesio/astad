import { composeAsync } from '../../support/compose.js';
import { HTTP_METHOD, RouteMiddlewareCallback } from './contracts.js';

export class HttpRoute<T = any> {
  private _static: boolean = true;
  private regex: RegExp | null = null;
  private paramKeys: Array<string> = [];

  private _name: string = '';
  protected path: string = '';

  constructor(
    readonly methods: HTTP_METHOD[] | '*',
    path: string,
    protected handler: T,
    private metadata: NodeJS.Dict<any> = {},
  ) {
    this.setPath(path);
  }

  getPath() {
    return this.path;
  }

  setPath(path: string) {
    this.path = path;

    if (this.path !== '/' && this.path.endsWith('/')) {
      this.path = this.path.slice(0, -1);
    }

    this._name = this.path;

    this.setPathParamKeys();
    this.setRegex();
  }

  getHandler() {
    return this.handler;
  }

  /**
   * change route handler
   * @param handler 
   */
  setHandler(handler: T) {
    this.handler = handler;
  }

  get name() {
    return this._name;
  }

  as(name: string) {
    this._name = name
  }

  protected setPathParamKeys() {
    const keys = this.path.match(/:\w+/g);
    const any = this.path.includes('*');
    this.paramKeys = [];

    if (keys) {
      this.paramKeys = keys.map((m) => m.replace(':', ''));
      this._static = false;
    }

    if (any) {
      this._static = false;
    }
  }

  protected setRegex() {
    if (!this._static) {
      // \\w+
      const expr = this.path.replace(/:\w+/g, '([A-Za-z0-9._-]+)').replace(/\*/g, '(.*)');
      this.regex = new RegExp(`^(${expr})$`);
    }
  }

  /**
   * match route method
   * @param method 
   * @returns {boolean}
   */
  matchMethod(method: HTTP_METHOD) {
    // route method should match with given method
    if ((this.methods as any) == '*') {
      return true;
    }
    for (const rMethod of this.methods) {
      if (rMethod == method || (rMethod == 'GET' && method == 'HEAD')) {
        return true;
      }
    }
    return false
  }

  /**
   * match route path
   * @param path 
   * @param params 
   * @returns {boolean}
   */
  match(path: string, params: NodeJS.Dict<string> = {}) {
    // in case path is without params
    if (this.path === path) {
      return true;
    }

    // use regex to match route with given path
    const matched = path.match(this.regex as RegExp);

    if (!matched) {
      return false;
    }

    for (let i = 2; i < matched.length; i++) {
      params[this.paramKeys[i - 2]] = matched[i];
    }

    return true;
  }

  clone() {
    return new HttpRoute(Array.isArray(this.methods) ? [...this.methods] : '*', this.path, this.handler, { ...this.metadata });
  }

  /**
   * get metadata
   * @param meta 
   * @returns {NodeJS.Dict<any>}
   */
  meta(meta?: NodeJS.Dict<any>) {
    if (!meta) {
      return this.metadata;
    }

    return this.metadata = meta;
  }

  /**
   * check if route is static route
   * @returns {boolean}
   */
  isStatic() {
    return this._static;
  }

  middleware(...middlewares: RouteMiddlewareCallback[]) {
    this.handler = (Array.isArray(this.handler) ? [...middlewares, ...this.handler] : [...middlewares, this.handler]) as any;
    return this;
  }

  getComposedHandler<T>() {
    return composeAsync<T>((Array.isArray(this.handler) ? this.handler : [this.handler]) as any);
  }
}
