import { AsyncLocalStorage } from "async_hooks";
import { Container, ContainerScope, ContainerValue, ContainerValueIdentifier } from "../../container/index.js";

export interface IMockOptions {
  /** If true, the mock will be a singleton regardless of original scope */
  singleton?: boolean;
}

/**
 * TestContainer provides utilities for mocking container dependencies in tests.
 *
 * @example
 * ```ts
 * const testContainer = new TestContainer(container);
 *
 * // Mock a service with a value
 * testContainer.mock('userService', { findById: () => mockUser });
 *
 * // Mock with a factory
 * testContainer.mockFactory('dbConnection', () => mockDb, []);
 *
 * // Run test...
 *
 * // Restore original services
 * testContainer.restore();
 * ```
 */
export class TestContainer {
  private originals = new Map<ContainerValueIdentifier, ContainerValue | undefined>();
  private asyncLocalStorage = new AsyncLocalStorage<any>();

  constructor(readonly container: Container) { }

  /**
   * Mock a service with a static value.
   * The original service is saved and can be restored with restore().
   *
   * @param id - Service identifier
   * @param value - Mock value to use
   * @param options - Mock options
   */
  mock<T>(id: ContainerValueIdentifier, value: T, options: IMockOptions = {}): this {
    // Save original if not already saved
    if (!this.originals.has(id)) {
      this.originals.set(id, this.container.findRegistryValue(id));
    }

    // Delete existing registration
    if (this.container.has(id)) {
      this.container.delete(id);
    }

    // Register mock
    this.container.put({
      id,
      scope: options.singleton ? ContainerScope.Singleton : ContainerScope.Value,
      value,
    });

    return this;
  }

  /**
   * Mock a service with a factory function.
   *
   * @param id - Service identifier
   * @param factory - Factory function to create mock
   * @param deps - Dependencies to inject into factory
   * @param options - Mock options
   */
  mockFactory(
    id: ContainerValueIdentifier,
    factory: (...args: any[]) => any,
    deps: ContainerValueIdentifier[] = [],
    options: IMockOptions = {}
  ): this {
    // Save original if not already saved
    if (!this.originals.has(id)) {
      this.originals.set(id, this.container.findRegistryValue(id));
    }

    // Delete existing registration
    if (this.container.has(id)) {
      this.container.delete(id);
    }

    // Register mock factory
    this.container.put({
      id,
      scope: options.singleton ? ContainerScope.Singleton : ContainerScope.Transient,
      factory,
      deps,
    });

    return this;
  }

  /**
   * Mock a service as a singleton.
   * Useful when you want a single mock instance shared across all resolves.
   *
   * @param id - Service identifier
   * @param value - Mock value or factory
   */
  mockSingleton<T>(id: ContainerValueIdentifier, value: T | (() => T)): this {
    // Save original if not already saved
    if (!this.originals.has(id)) {
      this.originals.set(id, this.container.findRegistryValue(id));
    }

    // Delete existing registration
    if (this.container.has(id)) {
      this.container.delete(id);
    }

    // Register as singleton
    this.container.put({
      id,
      scope: ContainerScope.Singleton,
      value: typeof value === 'function' ? value : value,
    });

    return this;
  }

  /**
   * Mock a contextual service (request-scoped).
   *
   * @param id - Service identifier
   * @param factory - Factory function to create mock per context
   * @param deps - Dependencies to inject into factory
   */
  mockContextual(
    id: ContainerValueIdentifier,
    factory: (...args: any[]) => any,
    deps: ContainerValueIdentifier[] = []
  ): this {
    // Save original if not already saved
    if (!this.originals.has(id)) {
      this.originals.set(id, this.container.findRegistryValue(id));
    }

    // Delete existing registration
    if (this.container.has(id)) {
      this.container.delete(id);
    }

    // Register as contextual
    this.container.put({
      id,
      scope: ContainerScope.Contextual,
      factory,
      deps,
    });

    return this;
  }

  /**
   * Restore a specific mocked service to its original registration.
   *
   * @param id - Service identifier to restore
   */
  restoreOne(id: ContainerValueIdentifier): this {
    if (!this.originals.has(id)) {
      return this;
    }

    // Delete mock
    if (this.container.has(id)) {
      this.container.delete(id);
    }

    // Restore original if it existed
    const original = this.originals.get(id);
    if (original) {
      this.container.put(original);
    }

    this.originals.delete(id);
    return this;
  }

  /**
   * Restore all mocked services to their original registrations.
   */
  restore(): this {
    for (const [id, original] of this.originals) {
      // Delete mock
      if (this.container.has(id)) {
        this.container.delete(id);
      }

      // Restore original if it existed
      if (original) {
        this.container.put(original);
      }
    }

    this.originals.clear();
    return this;
  }

  /**
   * Check if a service is currently mocked.
   *
   * @param id - Service identifier
   */
  isMocked(id: ContainerValueIdentifier): boolean {
    return this.originals.has(id);
  }

  /**
   * Get list of all mocked service identifiers.
   */
  getMockedIds(): ContainerValueIdentifier[] {
    return Array.from(this.originals.keys());
  }

  /**
   * Run a callback in an async context.
   * Useful for testing contextual scoped services.
   *
   * @param callback - Function to run in context
   * @param store - Optional store object for context
   */
  async runInContext<T>(callback: () => T | Promise<T>, store: any = new Map()): Promise<T> {
    // Set up container's async local storage if needed
    this.container.setAsyncLocalStorage(this.asyncLocalStorage);

    return await this.asyncLocalStorage.run(store, async () => {
      return await callback();
    });
  }

  /**
   * Create a spy wrapper around a service.
   * Returns the original service wrapped with call tracking.
   *
   * @param id - Service identifier
   * @returns Spy object with calls array and mock service
   */
  spy<T extends object>(id: ContainerValueIdentifier): ITestSpy<T> {
    const original = this.container.resolve<T>(id);
    const calls: ISpyCall[] = [];

    const handler: ProxyHandler<T> = {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
          return function (...args: any[]) {
            const call: ISpyCall = {
              method: String(prop),
              args,
              timestamp: Date.now(),
            };
            try {
              const result = value.apply(target, args);
              if (result instanceof Promise) {
                return result.then(
                  (resolved) => {
                    call.result = resolved;
                    calls.push(call);
                    return resolved;
                  },
                  (error) => {
                    call.error = error;
                    calls.push(call);
                    throw error;
                  }
                );
              }
              call.result = result;
              calls.push(call);
              return result;
            } catch (error) {
              call.error = error;
              calls.push(call);
              throw error;
            }
          };
        }
        return value;
      },
    };

    const proxy = new Proxy(original, handler);

    // Mock with the proxy
    this.mock(id, proxy);

    return {
      calls,
      service: proxy,
      getCallsFor(method: string) {
        return calls.filter(c => c.method === method);
      },
      getCallCount(method?: string) {
        if (method) {
          return calls.filter(c => c.method === method).length;
        }
        return calls.length;
      },
      wasCalled(method?: string) {
        if (method) {
          return calls.some(c => c.method === method);
        }
        return calls.length > 0;
      },
      reset() {
        calls.length = 0;
      },
    };
  }
}

export interface ISpyCall {
  method: string;
  args: any[];
  result?: any;
  error?: any;
  timestamp: number;
}

export interface ITestSpy<T> {
  /** All recorded calls */
  calls: ISpyCall[];
  /** The spied service (proxy) */
  service: T;
  /** Get all calls to a specific method */
  getCallsFor(method: string): ISpyCall[];
  /** Get total call count, optionally filtered by method */
  getCallCount(method?: string): number;
  /** Check if service/method was called */
  wasCalled(method?: string): boolean;
  /** Reset call history */
  reset(): void;
}
