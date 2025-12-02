/**
 * @module session
 * @added v0.2.12
 */

import { IHttpContext } from "../http/context.js";
import { ISessionDriver } from "./contract.js";
import { SessionFileDriver } from "./file.js";

export class Session {
  protected data: any = { $: {} };
  protected flashData: any = {};
  _id: string | undefined;
  opened = false;

  constructor(public readonly driver: ISessionDriver) { }

  /**
   * Resets in-memory session state to initial values.
   * Does NOT affect stored session data - only clears local instance state.
   * Called internally after close() or destroy() to prepare for potential reuse.
   */
  protected reset() {
    this.data = { $: {} };
    this.flashData = {};
    this._id = undefined;
    this.opened = false;
  }

  /**
   * Opens or resumes a session.
   * If id is provided, attempts to load existing session data.
   * If no id, creates a new session with generated id.
   * @param id - optional existing session id to resume
   */
  async init(id?: string) {
    this._id = await this.driver.open(id);
    this.opened = true;
    this.data = JSON.parse(await this.driver.read() || '{ "$": {} }');
  }

  /**
   * Writes current session data to storage immediately.
   * Does not close the session - use for mid-request persistence.
   */
  async flush() {
    this.shouldBeOpened();
    await this.driver.write(JSON.stringify(this.data));
  }

  /**
   * Closes the session, persists data, and processes flash data.
   *
   * Flash data lifecycle:
   * 1. Delete keys that were flashed in the PREVIOUS request (stored in $.flashed)
   * 2. Move current request's flash data into session storage
   * 3. Record new flash keys in $.flashed for deletion on next close()
   *
   * Session can be reopened with init() after close.
   */
  async close() {
    this.shouldBeOpened();
    // Get list of keys flashed in previous request
    this.data.$.flashed = this.data.$.flashed || [];

    // Delete flash data from previous request (one-time read)
    if (this.data.$.flashed.length) {
      for (const key of this.data.$.flashed) {
        delete this.data[key];
      }
    }

    // Move this request's flash data into session
    for (const key in this.flashData) {
      this.data[key] = this.flashData[key];
    }
    // Track flash keys for deletion on next close
    this.data.$.flashed = Object.keys(this.flashData);

    await this.driver.write(JSON.stringify(this.data));
    this.reset();
    await this.driver.close();
  }

  /**
   * Permanently destroys the session and its stored data.
   * Unlike close(), the session cannot be resumed - storage is deleted.
   * Use for logout or session invalidation.
   */
  async destroy() {
    this.shouldBeOpened();
    await this.driver.destroy();
    this.reset();
  }

  /**
   * Guard to ensure session is initialized before operations.
   * @throws Error if session not opened via init()
   */
  shouldBeOpened() {
    if (!this.opened) {
      throw new Error;
    }
  }

  get id() {
    return this._id as string;
  }

  /**
   * Checks if a key exists in session data.
   */
  has(key: string) {
    return typeof this.data[key] != 'undefined';
  }

  /**
   * Gets a value from session.
   * Automatically deserializes objects that were JSON-stringified on set().
   * Primitives and refs are returned as-is.
   */
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

  /**
   * Stores a value in session with automatic serialization.
   * Objects are JSON-stringified; primitives stored directly.
   * Value is cloned - changes to original won't affect session.
   */
  set(key: string, value: any) {
    const primitive = Object(value) !== value;
    if (!primitive) {
      value = JSON.stringify(value);
    }
    this.data[key] = { value, primitive };
  }

  /**
   * Stores a reference to a value without cloning.
   * Unlike set(), changes to the original object WILL affect session data.
   * Use when you need live reference to mutable objects.
   */
  put(key: string, value: any) {
    const primitive = Object(value) !== value;
    this.data[key] = { value, primitive, ref: true };
  }

  /**
   * Gets and removes a value from session in one operation.
   * Useful for one-time tokens or messages.
   */
  pull(key: string) {
    const data = this.data[key];
    delete this.data[key];
    return data.value;
  }

  /**
   * Stores data available only for the NEXT request.
   * Flash data is automatically deleted on the following close().
   * Use for redirect messages, form errors, etc.
   */
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
    return cors.handle.bind(cors);
  }

  /**
   * 
   * @param ctx 
   * @param next 
   * @returns {Promise<any>}
   */
  async handle(ctx: IHttpContext, next: any, valueKey = 'sess') {
    const sess = new Session(this.opts.driver || new SessionFileDriver);
    ctx.put(valueKey, sess);

    const cookiekey = this.opts.cookie || 'sess';
    await sess.init(ctx.cookies.get(cookiekey));
    ctx.cookies.set(cookiekey, sess.id);
    await next();
    await sess.close();
  }
}