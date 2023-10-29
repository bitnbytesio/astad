import { AsyncLocalStorage } from "async_hooks";
import { isClass, isFunction } from "../support/type.js";

export enum ContainerScope {
  Value = "VALUE", // provide what ever is given
  Contextual = 'CONTEXTUAL', // provide same instance in context
  Singleton = 'SINGLETON', // provide same instance, context does not matter here 
  Transient = 'TRANSIENT', // provide new instance each time
}

interface IClass<T = any> {
  new(...args: any): T
}

export type ContainerIdentifer = string | symbol;
export type ContainerValueIdentifier<T = any> = string | symbol | CallableFunction | IClass<T>;
export type ContainerValue = IContainerValue | IContainerFactory;

export interface IContainerValue {
  id: ContainerValueIdentifier
  scope: ContainerScope
  value: any
}

export interface IContainerFactory {
  id: ContainerValueIdentifier
  scope: ContainerScope
  factory: CallableFunction
  deps: Array<ContainerValueIdentifier>
}

export class Container {
  public readonly id: ContainerIdentifer;
  static contextRegistryKey = "containerRegistry";

  protected registry = new Map<ContainerValueIdentifier, ContainerValue>();
  protected resolvedRegistry = new Map<ContainerValueIdentifier, any>();

  constructor(id: ContainerIdentifer, protected asyncLocalStorage?: AsyncLocalStorage<any>) {
    this.id = id;
  }

  createErrorWithIdentifier(id: ContainerValueIdentifier, message: string) {
    let idstr = 'unk';
    // @ts-ignore
    if (id.name) {
      // @ts-ignore
      idstr = id.name;
    }
    if (!idstr && typeof id.toString == 'function') {
      idstr = id.toString();
    }
    return new Error(message.replace('%id', idstr));
  }

  register(data: ContainerValue, replace = false) {
    if (this.registry.has(data.id) && !replace) {
      throw new Error('Identifier already exists.');
    }

    if (data.scope == ContainerScope.Value && !(data as any).value) {
      throw new Error('Scope should have value.');
    }

    if (data.scope == ContainerScope.Transient && (data as any).value) {
      if (typeof (data as any).value != 'function') {
        throw new Error('Transient scope does not allow static value.');
      }
    }

    if (data.scope == ContainerScope.Contextual && !(data as any).factory) {
      throw new Error('Contextual scope only allow factory.');
    }

    this.registry.set(data.id, data);
  }

  set(data: ContainerValue) {
    return this.register(data);
  }

  put(data: ContainerValue) {
    return this.register(data, true);
  }

  value<T>(id: ContainerValueIdentifier): T {
    const data = this.registry.get(id);
    if (!data) {
      throw this.createErrorWithIdentifier(id, 'Identifier(%id) not found.');
    }

    if (!(data as any).value) {
      throw this.createErrorWithIdentifier(id, 'Identifier(%id) does not have a value.');
    }

    return (data as IContainerValue).value;
  }

  protected valueResolver(data: ContainerValue) {
    const value = (data as IContainerValue).value;
    if (value) {
      if (isClass(value)) {
        return new (value as any)();
      }
      if (isFunction(value)) {
        return (value as any)();
      }
      return value;
    }
    const factory = (data as IContainerFactory).factory as Function;

    return factory.apply(null, (data as IContainerFactory).deps.map(dep => this.resolve(dep)));
  }

  protected factoryResolver(data: ContainerValue) {
    const factory = (data as IContainerFactory).factory as Function;

    return factory.apply(null, (data as IContainerFactory).deps.map(dep => this.resolve(dep)));
  }

  hasResolved(id: ContainerValueIdentifier): boolean {
    const data = this.registry.get(id);
    if (!data) {
      throw this.createErrorWithIdentifier(id, 'Identifier(%id) not found.');
    }

    switch (data.scope) {
      case ContainerScope.Value:
        return true;
      case ContainerScope.Singleton:
        const resolved = this.resolvedRegistry.get(id) || {};
        if (resolved.singleton) {
          return true;
        }
        break;
      case ContainerScope.Transient:
        return false;
      case ContainerScope.Contextual:
        const ctxData = this.ctxRegistry().get(id) || {};
        if (ctxData.value) {
          return true;
        }
        break
    }

    return false;

  }

  resolveAsync<T>(id: ContainerIdentifer) {
    return this.resolve(id) as Promise<T>;
  }

  resolve<T>(id: ContainerValueIdentifier): T {
    const data = this.registry.get(id);
    if (!data) {
      throw this.createErrorWithIdentifier(id, 'Identifier(%id) not found.');
    }

    switch (data.scope) {
      case ContainerScope.Value:
        if ((data as IContainerValue).value) {
          return (data as any).value as T;
        }
        break;
      case ContainerScope.Singleton:
        const resolved = this.resolvedRegistry.get(id) || {};
        if (resolved.singleton) {
          return resolved.singleton;
        }
        resolved.singleton = this.valueResolver(data);
        this.resolvedRegistry.set(id, resolved);
        return resolved.singleton as T;

      case ContainerScope.Transient:
        return this.valueResolver(data) as T;
      case ContainerScope.Contextual:
        const ctxData = this.ctxRegistry().get(id) || {};
        if (ctxData.value) {
          return ctxData.value;
        }
        ctxData.value = this.valueResolver(data);
        this.ctxRegistry().set(id, ctxData);
        return ctxData.value as T;
    }
    throw this.createErrorWithIdentifier(id, 'Unable to resolve identifier(%id).');
  }

  fresh<T>(id: ContainerValueIdentifier): T {
    const data = this.registry.get(id);
    if (!data) {
      throw this.createErrorWithIdentifier(id, 'Identifier(%id) not found.');
    }

    return this.valueResolver(data);
  }

  call(cb: Function, deps: Array<ContainerIdentifer> = []) {
    return cb(...deps.map(dep => this.resolve(dep)));
  }

  async callAsync(cb: Function, deps: Array<ContainerIdentifer> = []) {
    return await cb(...await Promise.all(deps.map(dep => this.resolveAsync(dep))));
  }

  preresolve() {
    for (const id of this.registry.keys()) {
      const data = this.registry.get(id) as ContainerValue;
      if (data.scope == ContainerScope.Singleton) {
        this.resolve(id);
      }
    }
  }

  protected ctxRegistry(): Map<ContainerValueIdentifier, any> {
    if (!this.asyncLocalStorage) {
      throw new Error('context not available.');
    }
    const store = this.asyncLocalStorage.getStore();
    if (!store['contextRegistryKey']) {
      return store['contextRegistryKey'] = new Map;
    }
    return store['contextRegistryKey'];
  }

  setAsyncLocalStorage(asyncLocalStorage: AsyncLocalStorage<any>) {
    this.asyncLocalStorage = asyncLocalStorage;
  }

  contextStore<T = any>() {
    return (this.asyncLocalStorage as any).getStore() as T;
  }

  contextStoreSet(k: string, v: any) {
    this.contextStore().set(k, v);
  }

  contextStoreGet<T = any>(k: string) {
    return this.contextStore().value(k) as T | undefined;
  }


  asyncLocalRun(store: any, cb: CallableFunction) {
    if (!this.asyncLocalStorage) {
      this.asyncLocalStorage = new AsyncLocalStorage();
    }
    return this.asyncLocalStorage.run(store, cb as any);
  }
}