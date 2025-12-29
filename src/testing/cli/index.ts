import { AsyncLocalStorage } from "async_hooks";
import {
  CliContext,
  ICommand,
  CliAppMiddleware,
} from "../../cli/index.js";

/**
 * Test result from executing a CLI command
 */
export interface ITestCliResult {
  /** The context after command execution */
  ctx: CliContext;
  /** Any error that was thrown during execution */
  error: Error | null;
  /** Captured console output */
  output: ITestCliOutput;
  /** Check if command executed successfully (no error) */
  success: boolean;
  /** Get a value from context state */
  value<T = any>(key: any): T | undefined;
}

export interface ITestCliOutput {
  log: string[];
  info: string[];
  error: string[];
  json: any[];
  all: string[];
}

/**
 * Options for executing a test command
 */
export interface ITestCliExecOptions {
  /** Command arguments (after command name) */
  args?: string[];
  /** Flags to pass (e.g., { output: './dist', verbose: true }) */
  flags?: Record<string, string | boolean | string[]>;
}

/**
 * TestCliApplication provides utilities for testing CLI commands.
 *
 * @example
 * ```ts
 * const testCli = new TestCliApplication();
 * testCli.register(new BuildCommand());
 *
 * const result = await testCli.exec('build', {
 *   args: ['src'],
 *   flags: { output: './dist', minify: true }
 * });
 *
 * expect(result.success).toBe(true);
 * expect(result.value('outputPath')).toBe('./dist');
 * ```
 */
export class TestCliApplication {
  private commands: ICommand[] = [];
  private middlewares: CliAppMiddleware[] = [];
  private asyncLocalStorage = new AsyncLocalStorage<any>();

  /**
   * Register a command for testing
   */
  register(command: ICommand): this {
    this.commands.push(command);
    return this;
  }

  /**
   * Add middleware
   */
  use(middleware: CliAppMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Find a command by signature
   */
  find(signature: string): ICommand | undefined {
    return this.commands.find(cmd => cmd.signature === signature);
  }

  /**
   * Execute a command with the given options
   *
   * @param signature - Command signature to execute
   * @param options - Execution options (args, flags)
   */
  async exec(signature: string, options: ITestCliExecOptions = {}): Promise<ITestCliResult> {
    const command = this.find(signature);
    if (!command) {
      throw new Error(`Command "${signature}" not found`);
    }

    const composed = command.compose();
    const ctx = new CliContext('node', 'test.js', composed);

    // Apply arguments
    if (options.args) {
      for (let i = 0; i < options.args.length && i < composed.args.length; i++) {
        composed.args[i].value = options.args[i];
      }
    }

    // Apply flags
    if (options.flags) {
      for (const [name, value] of Object.entries(options.flags)) {
        const flag = composed.flags.find(f => f.name === name || f.alias === name);
        if (flag) {
          if (flag.multiple && Array.isArray(value)) {
            flag.value = value;
          } else {
            flag.value = value;
          }
        }
      }
    }

    // Capture output
    const output: ITestCliOutput = {
      log: [],
      info: [],
      error: [],
      json: [],
      all: [],
    };

    // Override context output methods to capture output
    ctx.log = (message: string, ...args: any[]) => {
      const formatted = args.length ? `${message} ${args.join(' ')}` : message;
      output.log.push(formatted);
      output.all.push(formatted);
    };

    ctx.info = (message: string) => {
      output.info.push(message);
      output.all.push(message);
    };

    ctx.error = (message: string) => {
      output.error.push(message);
      output.all.push(message);
    };

    ctx.json = (data: any) => {
      output.json.push(data);
      output.all.push(JSON.stringify(data, null, 2));
    };

    ctx.infof = (message: string, ...args: any[]) => {
      const formatted = message.replace(/%s/g, () => String(args.shift() ?? ''));
      output.info.push(formatted);
      output.all.push(formatted);
    };

    ctx.set('command', command);

    let error: Error | null = null;

    try {
      // Compose middleware
      const composedMiddleware = this.composeMiddleware(this.middlewares);

      // Execute in async context
      await this.asyncLocalStorage.run(ctx, async () => {
        await composedMiddleware(ctx, async () => {
          await command.handle(ctx);
        });
      });
    } catch (err: any) {
      error = err;
    }

    return {
      ctx,
      error,
      output,
      success: error === null,
      value<T = any>(key: any): T | undefined {
        return ctx.value(key);
      },
    };
  }

  /**
   * Execute a command and expect it to succeed
   */
  async execSuccess(signature: string, options: ITestCliExecOptions = {}): Promise<ITestCliResult> {
    const result = await this.exec(signature, options);
    if (!result.success) {
      throw result.error || new Error('Command failed');
    }
    return result;
  }

  /**
   * Execute a command and expect it to fail
   */
  async execFailure(signature: string, options: ITestCliExecOptions = {}): Promise<ITestCliResult> {
    const result = await this.exec(signature, options);
    if (result.success) {
      throw new Error('Expected command to fail but it succeeded');
    }
    return result;
  }

  /**
   * Compose middleware functions
   */
  private composeMiddleware(middlewares: CliAppMiddleware[]) {
    return async (ctx: CliContext, next: () => Promise<void>) => {
      let index = -1;

      const dispatch = async (i: number): Promise<void> => {
        if (i <= index) {
          throw new Error('next() called multiple times');
        }
        index = i;

        let fn: any = middlewares[i];
        if (i === middlewares.length) {
          fn = next;
        }

        if (!fn) {
          return;
        }

        if (typeof fn === 'object' && typeof fn.handle === 'function') {
          fn = fn.handle.bind(fn);
        }

        await fn(ctx, () => dispatch(i + 1));
      };

      return dispatch(0);
    };
  }

  /**
   * Clear all registered commands and middleware
   */
  clear(): this {
    this.commands = [];
    this.middlewares = [];
    return this;
  }
}

/**
 * Create a test context for a command without executing it.
 * Useful for unit testing command logic.
 *
 * @param command - Command to create context for
 * @param options - Options for setting up context
 */
export function createTestCliContext(
  command: ICommand,
  options: ITestCliExecOptions = {}
): CliContext {
  const composed = command.compose();
  const ctx = new CliContext('node', 'test.js', composed);

  // Apply arguments
  if (options.args) {
    for (let i = 0; i < options.args.length && i < composed.args.length; i++) {
      composed.args[i].value = options.args[i];
    }
  }

  // Apply flags
  if (options.flags) {
    for (const [name, value] of Object.entries(options.flags)) {
      const flag = composed.flags.find(f => f.name === name || f.alias === name);
      if (flag) {
        if (flag.multiple && Array.isArray(value)) {
          flag.value = value;
        } else {
          flag.value = value;
        }
      }
    }
  }

  ctx.set('command', command);
  return ctx;
}
