/**
 * @module session
 * @added v0.2.12
 */

import { IHttpContext } from "../http/context.js";
import { ISessionDriver } from "./contract.js";
import { SessionFileDriver } from "./file.js";

export class Session {
  protected data: any = {};
  protected flashData: any = {};
  _id: string | undefined;
  opened = false;

  constructor(public readonly driver: ISessionDriver) { }

  protected reset() {
    this.data = {};
    this.flashData = {};
    this._id = undefined;
    this.opened = false;
  }

  async init(id?: string) {
    this._id = await this.driver.open(id);
    this.opened = true;
    this.data = JSON.parse(await this.driver.read() || '{}');
  }

  async flush() {
    this.shouldBeOpened();
    await this.driver.write(JSON.stringify(this.data));
  }

  async close() {
    this.shouldBeOpened();
    const flashedKeys = [];
    for (const key in this.flashData) {
      this.data[key] = this.flashData[key];
      flashedKeys.push(key);
    }
    this.data.$flashedKeys = flashedKeys;
    await this.driver.write(JSON.stringify(this.data));
    this.reset();
    await this.driver.close();
  }

  shouldBeOpened() {
    if (!this.opened) {
      throw new Error;
    }
  }

  get id() {
    return this._id as string;
  }

  has(key: string) {
    return typeof this.data[key] != 'undefined';
  }

  get(key: string) {
    const data = this.data[key];
    if (!data) {
      return;
    }

    if (data.primitive || data.ref) {
      return data.value;
    }

    return JSON.parse(data.value);
  }

  set(key: string, value: any) {
    const primitive = Object(value) !== value;
    if (!primitive) {
      value = JSON.stringify(value);
    }
    this.data[key] = { value, primitive };
  }

  put(key: string, value: any) {
    const primitive = Object(value) !== value;
    this.data[key] = { value, primitive, ref: true };
  }

  pull(key: string) {
    const data = this.data[key];
    delete this.data[key];
    return data.value;
  }

  flash(key: string, value: any) {
    const primitive = Object(value) !== value;
    if (!primitive) {
      value = JSON.stringify(value);
    }
    this.flashData[key] = { value, primitive };
  }
}

export interface ISessionMiddlewareOpts {
  /**
   * @default {SessionFileDriver}
   */
  driver?: ISessionDriver
  /**
   * @default {"sess"}
   */
  cookie?: string
}

export class SessionMiddleware {
  constructor(public opts: ISessionMiddlewareOpts = {}) { }
  static middleware(opts: ISessionMiddlewareOpts = {}) {
    const cors = new SessionMiddleware(opts);
    return cors.handle.bind(this);
  }

  /**
   * 
   * @param ctx 
   * @param next 
   * @returns {Promise<any>}
   */
  async handle(ctx: IHttpContext, next: any) {
    const sess = new Session(this.opts.driver || new SessionFileDriver);
    await sess.init(ctx.cookies.get(this.opts.cookie || 'sess'));
    await next();
    await sess.close();
  }
}