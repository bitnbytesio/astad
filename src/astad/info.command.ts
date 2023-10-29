import * as Consts from '../consts.js';
import { CliContext, CommandCompose, ICommand } from "../cli/index.js";


export class InfoCommand implements ICommand {
  signature: string = "info";

  description: string = "print information!";

  protected kver = null;

  compose(): CommandCompose {
    const command = new CommandCompose(this.signature);

    return command;
  }


  handle(ctx: CliContext) {
    ctx.info('Astad!');
    ctx.infof('version: %s', Consts.VERSION);
    ctx.infof('Node.js: %s', process.version);
    ctx.log('ends here!')
  }
}