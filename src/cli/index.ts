import * as util from 'node:util';
import * as readline from 'node:readline';

import { FgRed, FgYellow, Reset } from './color.js';
import { composeAsync } from '../support/compose.js';
import { AsyncLocalStorage } from 'node:async_hooks';


export class CliContext {
  readonly state: Record<any, any> = {};
  //  readlineInterface: readline.Interface;

  constructor(
    readonly exec: string,
    readonly script: string,
    readonly command: CommandCompose,
  ) {
    // this.readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
  }

  set<T = any>(key: any, value: T): T {
    return this.state[key] = value
  }

  value<T = any>(key: any): T | undefined {
    return this.state[key];
  }

  /**
   * get command flag/arg value, return default value if not exists
   * @param name 
   * @returns 
   */
  read(name: string) {
    return this.command.read(name);
  }

  /**
   * get command flag value, return default value if not exists
   * @param name 
   * @returns 
   */
  flag(name: string) {
    const item = this.command.get(name);
    if (!item.flag) {
      throw new Error(`invalid flag ${name}.`)
    }
    return item.flag.value || item.flag.default;
  }

  /**
   * get command arg value, return default value if not exists
   * @param name 
   * @returns 
   */
  arg(name: string) {
    const item = this.command.get(name);
    if (!item.arg) {
      throw new Error(`invalid argument ${name}.`)
    }
    return item.arg.value || item.arg.default;
  }

  log(message: string, ...arg: any) {
    console.log(message, ...arg);
  }

  info(message: string) {
    console.info(`${FgYellow}${message}${Reset}`);
  }

  error(message: string) {
    console.error(`${FgRed}${message}${Reset}`);
  }

  infof(message: string, ...arg: any) {
    console.info(`${FgYellow}%s${Reset}`, util.format(message, ...arg));
  }

  json(data: any) {
    console.log(JSON.stringify(data, null, 2));
  }

  prompt(question: string) {
    return new Promise((resolve) => {
      const readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
      readlineInterface.question(question, answer => {
        readlineInterface.close();
        resolve(answer);
      });
    });
  }

  confirm(question: string) {
    return new Promise((resolve) => {
      const readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
      readlineInterface.question(question, answer => {
        readlineInterface.close();
        answer = answer.toLowerCase();
        resolve(answer == 'yes' || answer == 'y');
      });
    });
  }

  throw(error: Error) {
    throw error;
  }
}

export interface ICliParsedFlag {
  name: string
  value: true | string
}

interface ICliParsedArg {
  arg: string
  flag?: ICliParsedFlag
  command?: string
  matched?: boolean
}

function parseFlag(flag: string) {
  if (!flag.startsWith('-')) {
    throw new Error(`invalid flag "${flag}".`);
  }
  const [name, value] = flag.slice(1).split('=');

  const parsed: ICliParsedFlag = { name, value };
  if (typeof value == 'undefined') {
    parsed.value = true;
  }
  return parsed;
}

function processCommand(ctx: CliContext, args: ICliParsedArg[]) {
  // TODO: handle invalid args

  let argnum = 0;
  for (const arg of args) {
    if (arg.flag) {
      for (const flag of ctx.command.flags) {
        if (flag.name == arg.flag.name || flag.alias == arg.flag.name) {
          if (flag.multiple) {
            if (!Array.isArray(flag.value)) {
              flag.value = [];
            }
            flag.value.push(arg.flag.value);
            continue;
          }
          flag.value = arg.flag.value;
        }
      }
    }
    if (!arg.flag && !arg.command) {
      if (argnum >= ctx.command.args.length) {
        throw new Error(`invalid number of arguments.`);
      }
      ctx.command.args[argnum].value = arg.arg;
      argnum += 1;
    }
  }
}

export class CliApplication {
  protected asyncLocalStorage?: AsyncLocalStorage<any>;
  protected commands: ICommand[] = [];
  protected _fallback: ICommand | null = null;
  readonly middlewares: CliAppMiddleware[] = [];

  constructor(readonly opts: { asyncLocalStorage?: boolean | AsyncLocalStorage<any> } = {}) {
    if (this.opts.asyncLocalStorage) {
      this.asyncLocalStorage = this.opts.asyncLocalStorage instanceof AsyncLocalStorage ? this.opts.asyncLocalStorage : new AsyncLocalStorage();
    }
  }

  command(command: ICommand) {
    this.commands.push(command);
  }

  fallback(command: ICommand) {
    this._fallback = command;
  }

  find(name: string): ICommand | null {

    for (const cmd of this.commands) {
      if (cmd.signature == name) {
        return cmd;
      }
    }

    return null;
  }

  use(fn: CliAppMiddleware) {
    if (typeof fn == "object" && typeof fn.handle == 'function') {
      fn = fn.handle.bind(fn);
    }
    this.middlewares.push(fn);
  }

  async handle() {
    const composedMiddleware = composeAsync(this.middlewares);

    //console.log(process.argv);
    const [exec, script, ...args] = process.argv;
    // console.log({ exec, script, args });

    const appflags = [];
    const parsed: ICliParsedArg[] = [];
    let collectapp = true;
    let collectcmd = true;
    for (const arg of args) {
      if (arg.startsWith('-') && collectapp) {
        // collect app flags
        appflags.push(parseFlag(arg));
        continue;
      }
      if (!arg.startsWith('-') && collectapp) {
        collectapp = false;
      }

      if (!arg.startsWith('-') && collectcmd) {
        parsed.push({ arg, command: arg });
        collectcmd = false;
        continue;
      }

      if (arg.startsWith('-')) {
        parsed.push({ arg, flag: parseFlag(arg) });
        continue;
      }

      parsed.push({ arg });
    }

    if (!parsed.length) {
      throw new Error(`invalid command!`);
    }

    const commandarg = parsed[0];
    // handle fallback, incase command arg not present
    const command = this.find(commandarg.arg) || this._fallback;

    if (!command) {
      throw new Error(`invalid command ${command}`);
    }

    const composed = command.compose();
    const ctx = new CliContext(exec, script, composed);
    processCommand(ctx, parsed);
    ctx.set('command', command);

    if (this.asyncLocalStorage) {
      return await (this.asyncLocalStorage as AsyncLocalStorage<any>).run(ctx, async () => {
        await composedMiddleware(ctx, async () => {
          await command.handle(ctx);
        });
      });
    }

    await composedMiddleware(ctx, async () => {
      await command.handle(ctx);
    });
  }
}

export interface ICommand {
  signature: string
  description: string


  compose(): CommandCompose

  handle(ctx: CliContext): Promise<any> | any
}

export class CommandCompose {
  readonly flags: ICommandFlag[] = [];
  readonly args: ICommandArg[] = [];
  readonly map: Record<string, { flag: ICommandFlag } | { arg: ICommandArg }> = {};

  constructor(readonly name: string) {
  }

  /**
   * only for composing command
   * @param flags 
   * @returns 
   */
  flag(...flags: ICommandFlag[]) {
    for (const flag of flags) {
      if (this.map[flag.name]) {
        throw new Error(`Duplicate argument ${flag.name}.`);
      }
      if (flag.alias && this.map[flag.alias]) {
        throw new Error(`Duplicate alias ${flag.alias} of ${flag.name}.`);
      }
      this.map[flag.name] = { flag };
      this.flags.push(flag);
    }
    return this;
  }

  /**
   * only for composing command
   * @param args 
   * @returns 
   */
  arg(...args: ICommandArg[]) {
    for (const arg of args) {
      if (this.map[arg.name]) {
        throw new Error(`Duplicate argument ${arg.name}.`);
      }
      this.map[arg.name] = { arg };
      this.args.push(arg);
    }
    return this;
  }

  /**
   * get command param, can be flag or arg
   * @param name 
   * @returns 
   */
  get(name: string) {
    const item = this.map[name] as any;
    if (!item) {
      throw new Error(`invalid read argument ${name}.`);
    }
    return item;
  }

  /**
   * get command flag/arg value
   * @param name 
   * @returns 
   */
  value(name: string) {
    const item = this.get(name) as any;
    return item.flag.value || item.arg.value;
  }

  /**
   * get command flag/arg value, if not exists return default value
   * @param name 
   * @returns 
   */
  read(name: string) {
    const item = this.get(name) as any;
    const value = item.flag.value || item.arg.value;
    if (value) {
      return value;
    }
    return item.flag.default || item.arg.default;
  }
}

export interface ICommandArg<T = any> {
  name: string
  default?: T
  value?: T
  type?: Boolean | Number | String
}

export interface ICommandFlag<T = any> extends ICommandArg<T> {
  alias?: string
  multiple?: boolean
}

export interface ICliMiddleware {
  handle(ctx: any, next: any): Promise<any>
}

export type CliMiddlewareCallback = (ctx: any, next: any) => Promise<any>;

export type CliAppMiddleware = CliMiddlewareCallback | ICliMiddleware;