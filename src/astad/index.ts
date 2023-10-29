import { CliApplication, CommandCompose, ICommand, CliContext, CliAppMiddleware } from '../cli/index.js';
import { InfoCommand } from './info.command.js';
import { InitCommand } from './init.command.js';

export type AstadLoadable = (astad: Astad) => any;

export class Astad {
  app: CliApplication;
  constructor() {
    this.app = new CliApplication({ asyncLocalStorage: true });
    this.app.command(new InfoCommand);
    this.app.command(new InitCommand);
  }

  use(fn: CliAppMiddleware) {
    this.app.use(fn);
  }

  load(loadable: AstadLoadable) {
    return loadable(this);
  }

  register(cmd: ICommand) {
    this.app.command(cmd);
  }

  handle() {
    return this.app.handle();
  }
}

export { CommandCompose as AstadCompose }
export { CliContext as AstadContext }