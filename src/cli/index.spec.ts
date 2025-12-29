import t from 'tap';
import {
  CliApplication,
  CliContext,
  CommandCompose,
  ICommand,
  parseFlag,
  hasHelpFlag,
} from './index.js';

// Test command implementations
class SimpleCommand implements ICommand {
  signature = 'simple';
  description = 'A simple test command';

  compose() {
    return new CommandCompose(this.signature);
  }

  handle(ctx: CliContext) {
    ctx.set('executed', true);
  }
}

class CommandWithArgs implements ICommand {
  signature = 'greet';
  description = 'Greet with arguments';

  compose() {
    const command = new CommandCompose(this.signature);
    command.arg(
      { name: 'name', default: 'World' },
      { name: 'title', default: '' },
    );
    return command;
  }

  handle(ctx: CliContext) {
    ctx.set('name', ctx.arg('name'));
    ctx.set('title', ctx.arg('title'));
  }
}

class CommandWithFlags implements ICommand {
  signature = 'build';
  description = 'Build with flags';

  compose() {
    const command = new CommandCompose(this.signature);
    command.flag(
      { name: 'output', alias: 'o', default: './dist' },
      { name: 'minify', alias: 'm', default: false },
      { name: 'verbose', alias: 'v', default: false },
    );
    return command;
  }

  handle(ctx: CliContext) {
    ctx.set('output', ctx.flag('output'));
    ctx.set('minify', ctx.flag('minify'));
    ctx.set('verbose', ctx.flag('verbose'));
  }
}

class CommandWithMultipleFlags implements ICommand {
  signature = 'multi';
  description = 'Command with multiple flag values';

  compose() {
    const command = new CommandCompose(this.signature);
    command.flag(
      { name: 'target', alias: 't', default: [], multiple: true },
    );
    return command;
  }

  handle(ctx: CliContext) {
    ctx.set('targets', ctx.flag('target'));
  }
}

class CommandWithArgsAndFlags implements ICommand {
  signature = 'deploy';
  description = 'Deploy with args and flags';

  compose() {
    const command = new CommandCompose(this.signature);
    command.arg({ name: 'environment', default: 'staging' });
    command.flag(
      { name: 'force', alias: 'f', default: false },
      { name: 'dry-run', alias: 'd', default: false },
    );
    return command;
  }

  handle(ctx: CliContext) {
    ctx.set('environment', ctx.arg('environment'));
    ctx.set('force', ctx.flag('force'));
    ctx.set('dryRun', ctx.flag('dry-run'));
  }
}

// CommandCompose tests
t.test('CommandCompose:constructor', async t => {
  const compose = new CommandCompose('test');
  t.equal(compose.name, 'test');
  t.same(compose.flags, []);
  t.same(compose.args, []);
});

t.test('CommandCompose:arg() adds arguments', async t => {
  const compose = new CommandCompose('test');
  compose.arg(
    { name: 'first', default: 'default1' },
    { name: 'second', default: 'default2' },
  );

  t.equal(compose.args.length, 2);
  t.equal(compose.args[0].name, 'first');
  t.equal(compose.args[0].default, 'default1');
  t.equal(compose.args[1].name, 'second');
});

t.test('CommandCompose:arg() throws on duplicate', async t => {
  const compose = new CommandCompose('test');
  compose.arg({ name: 'duplicate' });

  t.throws(() => {
    compose.arg({ name: 'duplicate' });
  }, /Duplicate argument/);
});

t.test('CommandCompose:flag() adds flags', async t => {
  const compose = new CommandCompose('test');
  compose.flag(
    { name: 'verbose', alias: 'v', default: false },
    { name: 'output', alias: 'o', default: './dist' },
  );

  t.equal(compose.flags.length, 2);
  t.equal(compose.flags[0].name, 'verbose');
  t.equal(compose.flags[0].alias, 'v');
  t.equal(compose.flags[1].name, 'output');
});

t.test('CommandCompose:flag() throws on duplicate name', async t => {
  const compose = new CommandCompose('test');
  compose.flag({ name: 'verbose', alias: 'v' });

  t.throws(() => {
    compose.flag({ name: 'verbose', alias: 'x' });
  }, /Duplicate argument/);
});

t.test('CommandCompose:flag() throws on duplicate alias', async t => {
  const compose = new CommandCompose('test');
  compose.flag({ name: 'verbose', alias: 'v' });

  t.throws(() => {
    compose.flag({ name: 'version', alias: 'v' }); // 'v' alias already exists
  }, /Duplicate alias/);
});

t.test('CommandCompose:get() returns flag or arg', async t => {
  const compose = new CommandCompose('test');
  compose.arg({ name: 'myarg', default: 'argval' });
  compose.flag({ name: 'myflag', default: 'flagval' });

  const argItem = compose.get('myarg');
  t.ok('arg' in argItem);
  t.equal((argItem as any).arg.name, 'myarg');

  const flagItem = compose.get('myflag');
  t.ok('flag' in flagItem);
  t.equal((flagItem as any).flag.name, 'myflag');
});

t.test('CommandCompose:get() throws on invalid name', async t => {
  const compose = new CommandCompose('test');

  t.throws(() => {
    compose.get('nonexistent');
  }, /invalid read argument/);
});

t.test('CommandCompose:value() returns value with default fallback for flags', async t => {
  const compose = new CommandCompose('test');
  compose.flag({ name: 'output', default: './default' });

  // Before value is set, should return default
  t.equal(compose.value('output'), './default');

  // After setting value
  compose.flags[0].value = './custom';
  t.equal(compose.value('output'), './custom');
});

t.test('CommandCompose:value() returns value with default fallback for args', async t => {
  const compose = new CommandCompose('test');
  compose.arg({ name: 'name', default: 'World' });

  // Before value is set, should return default
  t.equal(compose.value('name'), 'World');

  // After setting value
  compose.args[0].value = 'John';
  t.equal(compose.value('name'), 'John');
});

// CliContext tests
t.test('CliContext:set() and value()', async t => {
  const compose = new CommandCompose('test');
  const ctx = new CliContext('node', 'script.js', compose);

  ctx.set('key', 'value');
  t.equal(ctx.value('key'), 'value');

  ctx.set('number', 42);
  t.equal(ctx.value('number'), 42);

  t.equal(ctx.value('nonexistent'), undefined);
});

t.test('CliContext:arg() gets argument value', async t => {
  const compose = new CommandCompose('test');
  compose.arg({ name: 'name', default: 'World' });
  compose.args[0].value = 'John';

  const ctx = new CliContext('node', 'script.js', compose);
  t.equal(ctx.arg('name'), 'John');
});

t.test('CliContext:arg() returns default when no value', async t => {
  const compose = new CommandCompose('test');
  compose.arg({ name: 'name', default: 'Default' });

  const ctx = new CliContext('node', 'script.js', compose);
  t.equal(ctx.arg('name'), 'Default');
});

t.test('CliContext:arg() throws on non-arg', async t => {
  const compose = new CommandCompose('test');
  compose.flag({ name: 'verbose' });

  const ctx = new CliContext('node', 'script.js', compose);
  t.throws(() => {
    ctx.arg('verbose');
  }, /invalid argument/);
});

t.test('CliContext:flag() gets flag value', async t => {
  const compose = new CommandCompose('test');
  compose.flag({ name: 'output', default: './dist' });
  compose.flags[0].value = './build';

  const ctx = new CliContext('node', 'script.js', compose);
  t.equal(ctx.flag('output'), './build');
});

t.test('CliContext:flag() returns default when no value', async t => {
  const compose = new CommandCompose('test');
  compose.flag({ name: 'output', default: './dist' });

  const ctx = new CliContext('node', 'script.js', compose);
  t.equal(ctx.flag('output'), './dist');
});

t.test('CliContext:flag() throws on non-flag', async t => {
  const compose = new CommandCompose('test');
  compose.arg({ name: 'name' });

  const ctx = new CliContext('node', 'script.js', compose);
  t.throws(() => {
    ctx.flag('name');
  }, /invalid flag/);
});

t.test('CommandCompose:value() can be accessed via alias', async t => {
  const compose = new CommandCompose('test');
  compose.flag({ name: 'output', alias: 'o', default: './dist' });

  // Access via name
  t.equal(compose.value('output'), './dist');
  // Access via alias
  t.equal(compose.value('o'), './dist');

  // Set value and check both
  compose.flags[0].value = './build';
  t.equal(compose.value('output'), './build');
  t.equal(compose.value('o'), './build');
});

t.test('CliContext:throw() throws error', async t => {
  const compose = new CommandCompose('test');
  const ctx = new CliContext('node', 'script.js', compose);

  t.throws(() => {
    ctx.throw(new Error('Test error'));
  }, /Test error/);
});

// CliApplication tests
t.test('CliApplication:command() registers command', async t => {
  const app = new CliApplication();
  const cmd = new SimpleCommand();

  app.command(cmd);
  t.equal(app.find('simple'), cmd);
});

t.test('CliApplication:find() returns null for unknown command', async t => {
  const app = new CliApplication();
  t.equal(app.find('unknown'), null);
});

t.test('CliApplication:list() returns empty array when no commands', async t => {
  const app = new CliApplication();
  const commands = app.list();
  t.same(commands, []);
});

t.test('CliApplication:list() returns all registered commands', async t => {
  const app = new CliApplication();
  const cmd1 = new SimpleCommand();
  const cmd2 = new CommandWithFlags();

  app.command(cmd1);
  app.command(cmd2);

  const commands = app.list();
  t.equal(commands.length, 2);
  t.equal(commands[0].signature, 'simple');
  t.equal(commands[1].signature, 'build');
});

t.test('CliApplication:list() returns a copy, not the original array', async t => {
  const app = new CliApplication();
  const cmd = new SimpleCommand();
  app.command(cmd);

  const commands1 = app.list();
  const commands2 = app.list();

  // Should be different array instances
  t.not(commands1, commands2);

  // Modifying returned array should not affect internal state
  commands1.pop();
  t.equal(app.list().length, 1);
});

t.test('CliApplication:fallback() sets fallback command', async t => {
  const app = new CliApplication();
  const fallback = new SimpleCommand();

  app.fallback(fallback);
  // Internal check - fallback is used when command not found
  t.ok(app['_fallback'] === fallback);
});

t.test('CliApplication:use() adds middleware function', async t => {
  const app = new CliApplication();
  const middleware = async (ctx: any, next: any) => { await next(); };

  app.use(middleware);
  t.equal(app.middlewares.length, 1);
});

t.test('CliApplication:use() adds middleware object', async t => {
  const app = new CliApplication();
  const middleware = {
    handle: async (ctx: any, next: any) => { await next(); }
  };

  app.use(middleware);
  t.equal(app.middlewares.length, 1);
});

// Flag with multiple values test
t.test('CommandCompose:flag() with multiple: true', async t => {
  const compose = new CommandCompose('test');
  compose.flag({ name: 'target', alias: 't', multiple: true, default: [] });

  t.equal(compose.flags[0].multiple, true);
});

// Integration-style tests using CommandCompose directly
t.test('integration: command with args parsing simulation', async t => {
  const cmd = new CommandWithArgs();
  const compose = cmd.compose();

  // Simulate arg parsing
  compose.args[0].value = 'John';
  compose.args[1].value = 'Mr';

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(ctx.value('name'), 'John');
  t.equal(ctx.value('title'), 'Mr');
});

t.test('integration: command with flags parsing simulation', async t => {
  const cmd = new CommandWithFlags();
  const compose = cmd.compose();

  // Simulate flag parsing
  compose.flags[0].value = './output';
  compose.flags[1].value = true;

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(ctx.value('output'), './output');
  t.equal(ctx.value('minify'), true);
  t.equal(ctx.value('verbose'), false); // default
});

t.test('integration: command with multiple flag values', async t => {
  const cmd = new CommandWithMultipleFlags();
  const compose = cmd.compose();

  // Simulate multiple flag values
  compose.flags[0].value = ['es2020', 'es2021', 'es2022'];

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.same(ctx.value('targets'), ['es2020', 'es2021', 'es2022']);
});

t.test('integration: command with args and flags', async t => {
  const cmd = new CommandWithArgsAndFlags();
  const compose = cmd.compose();

  // Simulate parsing
  compose.args[0].value = 'production';
  compose.flags[0].value = true;

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(ctx.value('environment'), 'production');
  t.equal(ctx.value('force'), true);
  t.equal(ctx.value('dryRun'), false); // default
});

t.test('integration: defaults are used when no value provided', async t => {
  const cmd = new CommandWithArgsAndFlags();
  const compose = cmd.compose();

  // No values set - should use defaults
  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(ctx.value('environment'), 'staging');
  t.equal(ctx.value('force'), false);
  t.equal(ctx.value('dryRun'), false);
});

// Middleware execution order test
t.test('CliApplication:middleware execution order', async t => {
  const app = new CliApplication();
  const order: string[] = [];

  app.use(async (ctx, next) => {
    order.push('before1');
    await next();
    order.push('after1');
  });

  app.use(async (ctx, next) => {
    order.push('before2');
    await next();
    order.push('after2');
  });

  // Manually test middleware composition
  const { composeAsync } = await import('../support/compose.js');
  const composed = composeAsync(app.middlewares);

  const compose = new CommandCompose('test');
  const ctx = new CliContext('node', 'script.js', compose);

  await composed(ctx, async () => {
    order.push('handler');
  });

  t.same(order, ['before1', 'before2', 'handler', 'after2', 'after1']);
});

// AsyncLocalStorage support test
t.test('CliApplication:asyncLocalStorage option', async t => {
  const app = new CliApplication({ asyncLocalStorage: true });
  t.ok(app['asyncLocalStorage'] !== undefined);
});

t.test('CliApplication:asyncLocalStorage with custom instance', async t => {
  const { AsyncLocalStorage } = await import('node:async_hooks');
  const als = new AsyncLocalStorage();
  const app = new CliApplication({ asyncLocalStorage: als });
  t.equal(app['asyncLocalStorage'], als);
});

// Edge cases
t.test('CommandCompose:chaining returns this', async t => {
  const compose = new CommandCompose('test');

  const result1 = compose.arg({ name: 'arg1' });
  t.equal(result1, compose);

  const result2 = compose.flag({ name: 'flag1' });
  t.equal(result2, compose);
});

t.test('CommandCompose: flag and arg cannot share same name', async t => {
  const compose = new CommandCompose('test');
  compose.flag({ name: 'version', alias: 'v' });

  // Cannot add arg with same name as existing flag
  t.throws(() => {
    compose.arg({ name: 'version' });
  }, /Duplicate argument/);
});

t.test('CommandCompose: arg and flag cannot share same name', async t => {
  const compose = new CommandCompose('test');
  compose.arg({ name: 'output' });

  // Cannot add flag with same name as existing arg
  t.throws(() => {
    compose.flag({ name: 'output', alias: 'o' });
  }, /Duplicate argument/);
});

// parseFlag tests - need to export or test indirectly
// We'll test via integration with CliApplication

// Flag parsing format tests
t.test('Flag parsing: single dash with equals (-word=value)', async t => {
  // Create a command that uses flags
  class TestCommand implements ICommand {
    signature = 'test';
    description = 'Test command';
    result: any = {};

    compose() {
      const cmd = new CommandCompose(this.signature);
      cmd.flag({ name: 'output', alias: 'o', default: '' });
      return cmd;
    }

    handle(ctx: CliContext) {
      this.result.output = ctx.flag('output');
    }
  }

  const cmd = new TestCommand();
  const compose = cmd.compose();

  // Simulate parsing -output=./dist
  compose.flags[0].value = './dist';

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(cmd.result.output, './dist');
});

t.test('Flag parsing: double dash with equals (--word=value)', async t => {
  class TestCommand implements ICommand {
    signature = 'test';
    description = 'Test command';
    result: any = {};

    compose() {
      const cmd = new CommandCompose(this.signature);
      cmd.flag({ name: 'config', default: '' });
      return cmd;
    }

    handle(ctx: CliContext) {
      this.result.config = ctx.flag('config');
    }
  }

  const cmd = new TestCommand();
  const compose = cmd.compose();

  // Simulate parsing --config=./config.json
  compose.flags[0].value = './config.json';

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(cmd.result.config, './config.json');
});

t.test('Flag parsing: value with equals sign preserved', async t => {
  class TestCommand implements ICommand {
    signature = 'test';
    description = 'Test command';
    result: any = {};

    compose() {
      const cmd = new CommandCompose(this.signature);
      cmd.flag({ name: 'env', default: '' });
      return cmd;
    }

    handle(ctx: CliContext) {
      this.result.env = ctx.flag('env');
    }
  }

  const cmd = new TestCommand();
  const compose = cmd.compose();

  // Simulate parsing --env=KEY=VALUE (value contains equals)
  compose.flags[0].value = 'KEY=VALUE';

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(cmd.result.env, 'KEY=VALUE');
});

t.test('Flag parsing: boolean flag (no value)', async t => {
  class TestCommand implements ICommand {
    signature = 'test';
    description = 'Test command';
    result: any = {};

    compose() {
      const cmd = new CommandCompose(this.signature);
      cmd.flag({ name: 'verbose', alias: 'v', default: false });
      return cmd;
    }

    handle(ctx: CliContext) {
      this.result.verbose = ctx.flag('verbose');
    }
  }

  const cmd = new TestCommand();
  const compose = cmd.compose();

  // Simulate parsing -v (boolean true)
  compose.flags[0].value = true;

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(cmd.result.verbose, true);
});

t.test('Flag parsing: alias with equals (-o=value)', async t => {
  class TestCommand implements ICommand {
    signature = 'test';
    description = 'Test command';
    result: any = {};

    compose() {
      const cmd = new CommandCompose(this.signature);
      cmd.flag({ name: 'output', alias: 'o', default: '' });
      return cmd;
    }

    handle(ctx: CliContext) {
      this.result.output = ctx.flag('output');
    }
  }

  const cmd = new TestCommand();
  const compose = cmd.compose();

  // Simulate parsing via alias -o=./build
  compose.flags[0].value = './build';

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(cmd.result.output, './build');
});

t.test('Flag parsing: space separated flag value simulation', async t => {
  class TestCommand implements ICommand {
    signature = 'test';
    description = 'Test command';
    result: any = {};

    compose() {
      const cmd = new CommandCompose(this.signature);
      cmd.flag({ name: 'file', alias: 'f', default: '' });
      return cmd;
    }

    handle(ctx: CliContext) {
      this.result.file = ctx.flag('file');
    }
  }

  const cmd = new TestCommand();
  const compose = cmd.compose();

  // Simulate parsing -f ./myfile.txt (space separated)
  compose.flags[0].value = './myfile.txt';

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(cmd.result.file, './myfile.txt');
});

t.test('Flag parsing: multiple flags with mixed formats', async t => {
  class TestCommand implements ICommand {
    signature = 'test';
    description = 'Test command';
    result: any = {};

    compose() {
      const cmd = new CommandCompose(this.signature);
      cmd.flag(
        { name: 'output', alias: 'o', default: '' },
        { name: 'verbose', alias: 'v', default: false },
        { name: 'config', alias: 'c', default: '' },
      );
      return cmd;
    }

    handle(ctx: CliContext) {
      this.result.output = ctx.flag('output');
      this.result.verbose = ctx.flag('verbose');
      this.result.config = ctx.flag('config');
    }
  }

  const cmd = new TestCommand();
  const compose = cmd.compose();

  // Simulate parsing: -o=./dist -v --config ./config.json
  compose.flags[0].value = './dist';
  compose.flags[1].value = true;
  compose.flags[2].value = './config.json';

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(cmd.result.output, './dist');
  t.equal(cmd.result.verbose, true);
  t.equal(cmd.result.config, './config.json');
});

t.test('Flag parsing: flag with path containing dashes', async t => {
  class TestCommand implements ICommand {
    signature = 'test';
    description = 'Test command';
    result: any = {};

    compose() {
      const cmd = new CommandCompose(this.signature);
      cmd.flag({ name: 'output', default: '' });
      return cmd;
    }

    handle(ctx: CliContext) {
      this.result.output = ctx.flag('output');
    }
  }

  const cmd = new TestCommand();
  const compose = cmd.compose();

  // Value contains dashes but is not a flag
  compose.flags[0].value = './my-output-dir';

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(cmd.result.output, './my-output-dir');
});

t.test('Flag parsing: flag name with dashes (--dry-run)', async t => {
  class TestCommand implements ICommand {
    signature = 'deploy';
    description = 'Deploy command';
    result: any = {};

    compose() {
      const cmd = new CommandCompose(this.signature);
      cmd.flag({ name: 'dry-run', alias: 'd', default: false });
      return cmd;
    }

    handle(ctx: CliContext) {
      this.result.dryRun = ctx.flag('dry-run');
    }
  }

  const cmd = new TestCommand();
  const compose = cmd.compose();

  // Simulate --dry-run
  compose.flags[0].value = true;

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(cmd.result.dryRun, true);
});

// Direct parseFlag function tests
t.test('parseFlag: single dash without value (-verbose)', async t => {
  const result = parseFlag('-verbose');
  t.equal(result.name, 'verbose');
  t.equal(result.value, true);
});

t.test('parseFlag: single dash with equals value (-output=./dist)', async t => {
  const result = parseFlag('-output=./dist');
  t.equal(result.name, 'output');
  t.equal(result.value, './dist');
});

t.test('parseFlag: double dash without value (--verbose)', async t => {
  const result = parseFlag('--verbose');
  t.equal(result.name, 'verbose');
  t.equal(result.value, true);
});

t.test('parseFlag: double dash with equals value (--output=./dist)', async t => {
  const result = parseFlag('--output=./dist');
  t.equal(result.name, 'output');
  t.equal(result.value, './dist');
});

t.test('parseFlag: value containing equals (--env=KEY=VALUE)', async t => {
  const result = parseFlag('--env=KEY=VALUE');
  t.equal(result.name, 'env');
  t.equal(result.value, 'KEY=VALUE');
});

t.test('parseFlag: value with multiple equals (--query=a=1&b=2)', async t => {
  const result = parseFlag('--query=a=1&b=2');
  t.equal(result.name, 'query');
  t.equal(result.value, 'a=1&b=2');
});

t.test('parseFlag: single character flag (-v)', async t => {
  const result = parseFlag('-v');
  t.equal(result.name, 'v');
  t.equal(result.value, true);
});

t.test('parseFlag: single character flag with value (-o=./dist)', async t => {
  const result = parseFlag('-o=./dist');
  t.equal(result.name, 'o');
  t.equal(result.value, './dist');
});

t.test('parseFlag: flag with dashes in name (--dry-run)', async t => {
  const result = parseFlag('--dry-run');
  t.equal(result.name, 'dry-run');
  t.equal(result.value, true);
});

t.test('parseFlag: flag with dashes and value (--dry-run=false)', async t => {
  const result = parseFlag('--dry-run=false');
  t.equal(result.name, 'dry-run');
  t.equal(result.value, 'false');
});

t.test('parseFlag: throws on non-flag input', async t => {
  t.throws(() => {
    parseFlag('notaflag');
  }, /invalid flag/);
});

t.test('parseFlag: throws on empty string', async t => {
  t.throws(() => {
    parseFlag('');
  }, /invalid flag/);
});

t.test('parseFlag: empty value with equals (-flag=)', async t => {
  const result = parseFlag('-flag=');
  t.equal(result.name, 'flag');
  t.equal(result.value, '');
});

t.test('parseFlag: value with spaces preserved (-msg=hello world)', async t => {
  const result = parseFlag('-msg=hello world');
  t.equal(result.name, 'msg');
  t.equal(result.value, 'hello world');
});

t.test('parseFlag: path value with dashes (--path=./my-path/to-file)', async t => {
  const result = parseFlag('--path=./my-path/to-file');
  t.equal(result.name, 'path');
  t.equal(result.value, './my-path/to-file');
});

// Quoted value tests (shell removes quotes, so we receive the unquoted string)
t.test('parseFlag: quoted value with spaces via equals (--msg="Hello World")', async t => {
  // Shell passes this as --msg=Hello World (quotes stripped by shell for equals syntax)
  // But if user does --msg="Hello World", shell keeps it as single arg
  const result = parseFlag('--msg=Hello World');
  t.equal(result.name, 'msg');
  t.equal(result.value, 'Hello World');
});

t.test('Quoted value: space-separated with quotes (--word "Hello World")', async t => {
  // Simulating how shell parses: --word "Hello World" becomes ['--word', 'Hello World']
  // The parsing loop handles this by lookahead

  class TestCommand implements ICommand {
    signature = 'test';
    description = 'Test command';
    result: any = {};

    compose() {
      const cmd = new CommandCompose(this.signature);
      cmd.flag({ name: 'word', default: '' });
      return cmd;
    }

    handle(ctx: CliContext) {
      this.result.word = ctx.flag('word');
    }
  }

  const cmd = new TestCommand();
  const compose = cmd.compose();

  // Simulate the result after parsing: value with spaces assigned to flag
  compose.flags[0].value = 'Hello World';

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(cmd.result.word, 'Hello World');
});

t.test('Quoted value: multiple words with special chars', async t => {
  class TestCommand implements ICommand {
    signature = 'test';
    description = 'Test command';
    result: any = {};

    compose() {
      const cmd = new CommandCompose(this.signature);
      cmd.flag({ name: 'message', alias: 'm', default: '' });
      return cmd;
    }

    handle(ctx: CliContext) {
      this.result.message = ctx.flag('message');
    }
  }

  const cmd = new TestCommand();
  const compose = cmd.compose();

  // Simulate: -m "Hello, World! How are you?"
  compose.flags[0].value = 'Hello, World! How are you?';

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(cmd.result.message, 'Hello, World! How are you?');
});

t.test('Quoted value: JSON string as value', async t => {
  class TestCommand implements ICommand {
    signature = 'test';
    description = 'Test command';
    result: any = {};

    compose() {
      const cmd = new CommandCompose(this.signature);
      cmd.flag({ name: 'data', default: '' });
      return cmd;
    }

    handle(ctx: CliContext) {
      this.result.data = ctx.flag('data');
    }
  }

  const cmd = new TestCommand();
  const compose = cmd.compose();

  // Simulate: --data '{"name": "John", "age": 30}'
  compose.flags[0].value = '{"name": "John", "age": 30}';

  const ctx = new CliContext('node', 'script.js', compose);
  cmd.handle(ctx);

  t.equal(cmd.result.data, '{"name": "John", "age": 30}');

  // Verify it can be parsed as JSON
  const parsed = JSON.parse(cmd.result.data);
  t.equal(parsed.name, 'John');
  t.equal(parsed.age, 30);
});

// hasHelpFlag tests
t.test('hasHelpFlag: returns true for -h flag', async t => {
  const args = [
    { arg: 'command', command: 'test' },
    { arg: '-h', flag: { name: 'h', value: true as const } },
  ];
  t.equal(hasHelpFlag(args), true);
});

t.test('hasHelpFlag: returns true for --help flag', async t => {
  const args = [
    { arg: 'command', command: 'test' },
    { arg: '--help', flag: { name: 'help', value: true as const } },
  ];
  t.equal(hasHelpFlag(args), true);
});

t.test('hasHelpFlag: returns false when no help flag', async t => {
  const args = [
    { arg: 'command', command: 'test' },
    { arg: '-v', flag: { name: 'v', value: true as const } },
  ];
  t.equal(hasHelpFlag(args), false);
});

t.test('hasHelpFlag: returns false for empty args', async t => {
  const args: any[] = [];
  t.equal(hasHelpFlag(args), false);
});

t.test('hasHelpFlag: returns true when help is among other flags', async t => {
  const args = [
    { arg: 'command', command: 'test' },
    { arg: '-v', flag: { name: 'v', value: true as const } },
    { arg: '--output', flag: { name: 'output', value: './dist' } },
    { arg: '-h', flag: { name: 'h', value: true as const } },
  ];
  t.equal(hasHelpFlag(args), true);
});

t.test('hasHelpFlag: help flag with value still recognized', async t => {
  // Edge case: --help=something (unusual but possible)
  const args = [
    { arg: 'command', command: 'test' },
    { arg: '--help=yes', flag: { name: 'help', value: 'yes' } },
  ];
  t.equal(hasHelpFlag(args), true);
});
