import t from 'tap';
import { CliContext, CommandCompose, ICommand } from '../../cli/index.js';
import { TestCliApplication, createTestCliContext } from './index.js';

// Test commands
class GreetCommand implements ICommand {
  signature = 'greet';
  description = 'Greet a user';

  compose() {
    const cmd = new CommandCompose(this.signature);
    cmd.arg({ name: 'name', default: 'World' });
    cmd.flag({ name: 'loud', alias: 'l', default: false });
    return cmd;
  }

  handle(ctx: CliContext) {
    const name = ctx.arg('name');
    const loud = ctx.flag('loud');
    const greeting = `Hello, ${name}!`;

    ctx.set('greeting', greeting);
    ctx.set('loud', loud);

    if (loud) {
      ctx.info(greeting.toUpperCase());
    } else {
      ctx.log(greeting);
    }
  }
}

class BuildCommand implements ICommand {
  signature = 'build';
  description = 'Build project';

  compose() {
    const cmd = new CommandCompose(this.signature);
    cmd.arg({ name: 'source', default: './src' });
    cmd.flag(
      { name: 'output', alias: 'o', default: './dist' },
      { name: 'minify', alias: 'm', default: false },
      { name: 'target', alias: 't', multiple: true, default: [] },
    );
    return cmd;
  }

  handle(ctx: CliContext) {
    ctx.set('source', ctx.arg('source'));
    ctx.set('output', ctx.flag('output'));
    ctx.set('minify', ctx.flag('minify'));
    ctx.set('targets', ctx.flag('target'));

    ctx.json({
      source: ctx.arg('source'),
      output: ctx.flag('output'),
      minify: ctx.flag('minify'),
      targets: ctx.flag('target'),
    });
  }
}

class FailingCommand implements ICommand {
  signature = 'fail';
  description = 'Always fails';

  compose() {
    return new CommandCompose(this.signature);
  }

  handle(_ctx: CliContext) {
    throw new Error('Command failed intentionally');
  }
}

class AsyncCommand implements ICommand {
  signature = 'async';
  description = 'Async command';

  compose() {
    return new CommandCompose(this.signature);
  }

  async handle(ctx: CliContext) {
    await new Promise(resolve => setTimeout(resolve, 10));
    ctx.set('completed', true);
    ctx.info('Async complete');
  }
}

// Tests
t.test('TestCliApplication:register() adds command', async t => {
  const cli = new TestCliApplication();
  cli.register(new GreetCommand());

  t.ok(cli.find('greet'));
  t.notOk(cli.find('unknown'));
});

t.test('TestCliApplication:exec() executes command', async t => {
  const cli = new TestCliApplication();
  cli.register(new GreetCommand());

  const result = await cli.exec('greet');

  t.equal(result.success, true);
  t.equal(result.error, null);
  t.equal(result.value('greeting'), 'Hello, World!');
});

t.test('TestCliApplication:exec() with args', async t => {
  const cli = new TestCliApplication();
  cli.register(new GreetCommand());

  const result = await cli.exec('greet', { args: ['John'] });

  t.equal(result.value('greeting'), 'Hello, John!');
});

t.test('TestCliApplication:exec() with flags', async t => {
  const cli = new TestCliApplication();
  cli.register(new GreetCommand());

  const result = await cli.exec('greet', {
    args: ['Jane'],
    flags: { loud: true },
  });

  t.equal(result.value('greeting'), 'Hello, Jane!');
  t.equal(result.value('loud'), true);
});

t.test('TestCliApplication:exec() captures log output', async t => {
  const cli = new TestCliApplication();
  cli.register(new GreetCommand());

  const result = await cli.exec('greet', { args: ['Test'] });

  t.ok(result.output.log.includes('Hello, Test!'));
  t.ok(result.output.all.includes('Hello, Test!'));
});

t.test('TestCliApplication:exec() captures info output', async t => {
  const cli = new TestCliApplication();
  cli.register(new GreetCommand());

  const result = await cli.exec('greet', {
    args: ['Loud'],
    flags: { loud: true },
  });

  t.ok(result.output.info.includes('HELLO, LOUD!'));
});

t.test('TestCliApplication:exec() captures json output', async t => {
  const cli = new TestCliApplication();
  cli.register(new BuildCommand());

  const result = await cli.exec('build', {
    args: ['./app'],
    flags: { output: './out', minify: true },
  });

  t.equal(result.output.json.length, 1);
  t.same(result.output.json[0], {
    source: './app',
    output: './out',
    minify: true,
    targets: [],
  });
});

t.test('TestCliApplication:exec() handles multiple flag values', async t => {
  const cli = new TestCliApplication();
  cli.register(new BuildCommand());

  const result = await cli.exec('build', {
    flags: { target: ['es2020', 'es2021'] },
  });

  t.same(result.value('targets'), ['es2020', 'es2021']);
});

t.test('TestCliApplication:exec() captures errors', async t => {
  const cli = new TestCliApplication();
  cli.register(new FailingCommand());

  const result = await cli.exec('fail');

  t.equal(result.success, false);
  t.ok(result.error);
  t.equal(result.error?.message, 'Command failed intentionally');
});

t.test('TestCliApplication:exec() throws on unknown command', async t => {
  const cli = new TestCliApplication();

  await t.rejects(cli.exec('unknown'), /Command "unknown" not found/);
});

t.test('TestCliApplication:execSuccess() throws on failure', async t => {
  const cli = new TestCliApplication();
  cli.register(new FailingCommand());

  await t.rejects(cli.execSuccess('fail'), /Command failed intentionally/);
});

t.test('TestCliApplication:execSuccess() returns result on success', async t => {
  const cli = new TestCliApplication();
  cli.register(new GreetCommand());

  const result = await cli.execSuccess('greet');
  t.equal(result.success, true);
});

t.test('TestCliApplication:execFailure() throws on success', async t => {
  const cli = new TestCliApplication();
  cli.register(new GreetCommand());

  await t.rejects(cli.execFailure('greet'), /Expected command to fail/);
});

t.test('TestCliApplication:execFailure() returns result on failure', async t => {
  const cli = new TestCliApplication();
  cli.register(new FailingCommand());

  const result = await cli.execFailure('fail');
  t.equal(result.success, false);
});

t.test('TestCliApplication:exec() works with async commands', async t => {
  const cli = new TestCliApplication();
  cli.register(new AsyncCommand());

  const result = await cli.exec('async');

  t.equal(result.success, true);
  t.equal(result.value('completed'), true);
  t.ok(result.output.info.includes('Async complete'));
});

t.test('TestCliApplication:use() adds middleware', async t => {
  const cli = new TestCliApplication();
  cli.register(new GreetCommand());

  const order: string[] = [];

  cli.use(async (ctx, next) => {
    order.push('before');
    await next();
    order.push('after');
  });

  await cli.exec('greet');

  t.same(order, ['before', 'after']);
});

t.test('TestCliApplication:middleware execution order', async t => {
  const cli = new TestCliApplication();
  cli.register(new GreetCommand());

  const order: string[] = [];

  cli.use(async (ctx, next) => {
    order.push('m1-before');
    await next();
    order.push('m1-after');
  });

  cli.use(async (ctx, next) => {
    order.push('m2-before');
    await next();
    order.push('m2-after');
  });

  await cli.exec('greet');

  t.same(order, ['m1-before', 'm2-before', 'm2-after', 'm1-after']);
});

t.test('TestCliApplication:clear() removes commands and middleware', async t => {
  const cli = new TestCliApplication();
  cli.register(new GreetCommand());
  cli.use(async (_ctx, next) => next());

  cli.clear();

  t.notOk(cli.find('greet'));
});

t.test('createTestCliContext() creates context without execution', async t => {
  const command = new BuildCommand();
  const ctx = createTestCliContext(command, {
    args: ['./app'],
    flags: { output: './build', minify: true },
  });

  t.equal(ctx.arg('source'), './app');
  t.equal(ctx.flag('output'), './build');
  t.equal(ctx.flag('minify'), true);
});

t.test('createTestCliContext() with default values', async t => {
  const command = new BuildCommand();
  const ctx = createTestCliContext(command, {});

  t.equal(ctx.arg('source'), './src');
  t.equal(ctx.flag('output'), './dist');
  t.equal(ctx.flag('minify'), false);
});

t.test('TestCliApplication:exec() uses flag alias', async t => {
  const cli = new TestCliApplication();
  cli.register(new BuildCommand());

  const result = await cli.exec('build', {
    flags: { o: './out', m: true },
  });

  t.equal(result.value('output'), './out');
  t.equal(result.value('minify'), true);
});
