import { AsyncLocalStorage } from "async_hooks";

export class TestMinimalContext {
  asyncLocalStorage = new AsyncLocalStorage();

  readonly state: Record<any, any> = {};

  set<T = any>(key: any, value: T): T {
    return this.state[key] = value
  }

  value<T = any>(key: any): T | undefined {
    return this.state[key];
  }

  run(cb: () => any) {
    return this.asyncLocalStorage.run(this, cb);
  }
}