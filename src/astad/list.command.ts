import { CliApplication, CliContext, CommandCompose, ICommand } from "../cli/index.js";

export class ListCommand implements ICommand {
  signature: string = "list";
  description: string = "List all registered commands";

  constructor(private app: CliApplication) { }

  compose(): CommandCompose {
    const command = new CommandCompose(this.signature);
    return command;
  }

  handle(ctx: CliContext) {
    const commands = this.app.list();

    if (commands.length === 0) {
      ctx.info('No commands registered.');
      return;
    }

    ctx.info('Available commands:');
    ctx.log('');

    // Find the longest signature for alignment
    const maxLen = Math.max(...commands.map(cmd => cmd.signature.length));

    for (const cmd of commands) {
      const padding = ' '.repeat(maxLen - cmd.signature.length + 2);
      ctx.log(`  ${cmd.signature}${padding}${cmd.description || ''}`);
    }

    ctx.log('');
  }
}
