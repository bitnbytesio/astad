# Astad

A lightweight Node.js framework for building web applications and CLI tools.

## Features

- **HTTP Server** - Framework-agnostic HTTP application with routing, middleware, and CORS (supports Koa, Express, etc.)
- **Session Management** - File-based sessions with flash data support
- **Routing** - Flexible router with route groups, middleware, and parameter handling
- **View Engine** - Pluggable template engine support (EJS, etc.)
- **Static Assets** - Built-in static file serving with MIME type detection
- **CLI Application** - Command-line application framework with argument parsing
- **Container** - Dependency injection container with singleton, transient, and contextual scopes
- **Events** - Event dispatcher for decoupled application components
- **DAM** - Data access manager with MongoDB support
- **Testing Utilities** - Route testing and minimal context for unit tests
- **Support Utilities** - Collections, date helpers, file operations, path utilities, random generators

## Quick Start with Koajs
```ts
import { HttpApp, HttpKoa, HttpCors } from 'astad';
import Koa from 'koa';
import koaLogger from 'koa-logger';
import { koaBody } from 'koa-body';
// if required otherwise remove it
import ejs from 'ejs';

// config file
import { Config } from './config.js';

// main files
import web from './http/web/index.js';
import api from './http/api/index.js';

// koa instance
const app = new Koa();
// add middleware directly to koa
app.use(koaLogger());
app.use(koaBody({ multipart: true, formidable: { keepExtensions: true } }));

// create http app
const httpApp = new HttpApp({
  use: new HttpKoa(app),
  conf: Config,
});

// cors middleware
httpApp.use(new HttpCors());

// view engine if required
httpApp.viewEngine(new class {
  async render(ctx, template: string, data: Record<any, any> = {}) {
    return await ejs.renderFile(`./resources/views/${template}.ejs.html`, data);
  }
  async renderError(ctx, error) {
    return await ejs.renderFile(`./resources/views/error.ejs.html`, { error });
  }
});

// register routers
httpApp.router(web); // web router
httpApp.router('/api', api); // api router

// start server
httpApp.listen();

```

### Config file example
```ts
import { config } from 'dotenv';
import { Conf } from 'astad/conf';

config({
  path: '.env',
});

export const Config = new Conf();

```

### Router example
Web router file
```ts
import { HttpRouter } from 'astad/http';

const web = new HttpRouter();

web.get('/', async ctx => {
  await ctx.view('welcome');
});

export default web;

```

Below is api router file
```ts
import { HTTP_KEY_REQ_ID, HttpRouter } from 'astad/http';

const api = new HttpRouter();

api.get('/', async ctx => {
  ctx.json({
    name: 'Astad Example',
    ver: '0.1.0',
    reqid: ctx.value(HTTP_KEY_REQ_ID),
  });
});

export default api;

```

## CORS Middleware

The `HttpCors` class provides Cross-Origin Resource Sharing (CORS) support for handling preflight requests and setting appropriate headers.

### Basic Usage

```ts
import { HttpApp, HttpCors } from 'astad';

const httpApp = new HttpApp({ /* ... */ });

// Use default CORS settings (allows all origins)
httpApp.use(new HttpCors());

// Or use static middleware method
httpApp.use(HttpCors.middleware());
```

### Configuration Options

```ts
httpApp.use(new HttpCors({
  origin: '*',                    // Allowed origin(s)
  credentials: false,             // Allow credentials (cookies, auth headers)
  maxAge: 86400,                  // Preflight cache duration in seconds
  privateNetworkAccess: false,    // Allow private network access
  secureContext: false,           // Enable Cross-Origin isolation headers
  allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Authorization',
    'Accept',
    'Referer',
    'Content-Transfer-Encoding',
    'Content-Disposition',
    'Content-Type',
  ],
  exposeHeaders: [],              // Headers exposed to the browser
}));
```

### Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `origin` | `string` | `'*'` | Allowed origin for CORS requests |
| `credentials` | `boolean` | `false` | When true, sets `Access-Control-Allow-Credentials: true` |
| `maxAge` | `number` | `86400` | How long preflight results can be cached (seconds) |
| `privateNetworkAccess` | `boolean` | `false` | Allow requests from public to private networks |
| `secureContext` | `boolean` | `false` | Enables `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` for isolation |
| `allowMethods` | `string[]` | `['GET', 'HEAD', ...]` | HTTP methods allowed in CORS requests |
| `allowHeaders` | `string[]` | `['Authorization', ...]` | Headers allowed in CORS requests |
| `exposeHeaders` | `string[]` | `[]` | Headers exposed to the browser via `Access-Control-Expose-Headers` |

### Secure Context

Enable `secureContext` for features requiring cross-origin isolation (e.g., `SharedArrayBuffer`):

```ts
httpApp.use(new HttpCors({
  secureContext: true, // Sets COOP and COEP headers
}));
```

### Private Network Access

For requests from public websites to private network resources:

```ts
httpApp.use(new HttpCors({
  privateNetworkAccess: true,
}));
```

## Console Application (CLI)

The CLI module provides a framework for building command-line applications with argument parsing, flags, and middleware support.

### Basic Command

```ts
import { Astad, AstadContext, AstadCompose } from 'astad';

class HelloCommand {
  signature: string = "hello";
  description: string = "Say hello!";

  compose() {
    const command = new AstadCompose(this.signature);
    return command;
  }

  async handle(ctx: AstadContext) {
    ctx.info('Hello from Astad!');
  }
}

const app = new Astad();
app.register(new HelloCommand);
await app.handle();

// Usage: node cli.js hello
```

### Arguments

Arguments are positional parameters passed to commands.

```ts
import { Astad, AstadContext, AstadCompose } from 'astad';

class GreetCommand {
  signature: string = "greet";
  description: string = "Greet a user by name";

  compose() {
    const command = new AstadCompose(this.signature);
    // Define positional arguments
    command.arg(
      { name: 'name', default: 'World' },
      { name: 'title', default: '' },
    );
    return command;
  }

  async handle(ctx: AstadContext) {
    const name = ctx.arg('name');   // Get argument value
    const title = ctx.arg('title');

    if (title) {
      ctx.info(`Hello, ${title} ${name}!`);
    } else {
      ctx.info(`Hello, ${name}!`);
    }
  }
}

const app = new Astad();
app.register(new GreetCommand);
await app.handle();

// Usage: node cli.js greet John
// Usage: node cli.js greet John Mr
```

### Flags

Flags are named options that can be passed in any order.

```ts
import { Astad, AstadContext, AstadCompose } from 'astad';

class BuildCommand {
  signature: string = "build";
  description: string = "Build the project";

  compose() {
    const command = new AstadCompose(this.signature);
    // Define flags with name, alias, and default value
    command.flag(
      { name: 'output', alias: 'o', default: './dist' },
      { name: 'minify', alias: 'm', default: false },
      { name: 'watch', alias: 'w', default: false },
      { name: 'target', alias: 't', default: 'es2020', multiple: true },
    );
    return command;
  }

  async handle(ctx: AstadContext) {
    const output = ctx.flag('output');
    const minify = ctx.flag('minify');
    const watch = ctx.flag('watch');
    const targets = ctx.flag('target'); // Array when multiple: true

    ctx.info(`Building to: ${output}`);
    ctx.info(`Minify: ${minify}`);
    ctx.info(`Watch mode: ${watch}`);
    ctx.json({ targets });
  }
}

const app = new Astad();
app.register(new BuildCommand);
await app.handle();

// Usage: node cli.js build -o=./out -m -w
// Usage: node cli.js build --output=./out --minify --watch
// Usage: node cli.js build -t=es2020 -t=es2021  (multiple values)
```

### Combined Args and Flags

```ts
import { Astad, AstadContext, AstadCompose } from 'astad';

class DeployCommand {
  signature: string = "deploy";
  description: string = "Deploy to environment";

  compose() {
    const command = new AstadCompose(this.signature);
    // Positional argument
    command.arg({ name: 'environment', default: 'staging' });
    // Flags
    command.flag(
      { name: 'force', alias: 'f', default: false },
      { name: 'dry-run', alias: 'd', default: false },
    );
    return command;
  }

  async handle(ctx: AstadContext) {
    const env = ctx.arg('environment');
    const force = ctx.flag('force');
    const dryRun = ctx.flag('dry-run');

    if (dryRun) {
      ctx.info(`[DRY RUN] Would deploy to: ${env}`);
    } else {
      ctx.info(`Deploying to: ${env}${force ? ' (forced)' : ''}`);
    }
  }
}

// Usage: node cli.js deploy production -f
// Usage: node cli.js deploy staging --dry-run
```

### Context Methods

The `AstadContext` provides utility methods for CLI interaction:

```ts
async handle(ctx: AstadContext) {
  // Output methods
  ctx.log('Normal message');           // Standard output
  ctx.info('Info message');            // Yellow colored
  ctx.error('Error message');          // Red colored
  ctx.infof('Formatted: %s', value);   // Printf-style formatting
  ctx.json({ key: 'value' });          // Pretty-printed JSON

  // User interaction
  const answer = await ctx.prompt('Enter value: ');
  const confirmed = await ctx.confirm('Are you sure? (y/n) ');

  // State management
  ctx.set('myKey', someValue);
  const value = ctx.value('myKey');
}
```

### Middleware

Add middleware for cross-cutting concerns like logging or authentication:

```ts
const app = new Astad();

// Function middleware
app.use(async (ctx, next) => {
  console.log('Before command');
  await next();
  console.log('After command');
});

// Class middleware
class LoggerMiddleware {
  async handle(ctx: AstadContext, next: () => Promise<any>) {
    const start = Date.now();
    await next();
    ctx.infof('Command completed in %dms', Date.now() - start);
  }
}

app.use(new LoggerMiddleware());
app.register(new MyCommand);
await app.handle();
```

### Fallback Command

Set a default command when no command is specified:

```ts
const app = new Astad();
app.register(new HelpCommand);
app.fallback(new HelpCommand); // Runs when no command matches
await app.handle();
```

## Container (Dependency Injection)

The Container provides dependency injection with four scope types for managing service lifecycles.

### Scopes

| Scope | Description |
|-------|-------------|
| `Value` | Static value, returned as-is |
| `Singleton` | Single instance, created once and cached |
| `Transient` | New instance created on every resolve |
| `Contextual` | Single instance per async context (request-scoped) |

### Basic Usage

```ts
import { Container, ContainerScope } from 'astad/container';

const container = new Container('app');

// Value scope - static values
container.set({
  id: 'config.apiUrl',
  scope: ContainerScope.Value,
  value: 'https://api.example.com',
});

// Singleton scope - created once, reused forever
container.set({
  id: 'database',
  scope: ContainerScope.Singleton,
  value: () => new DatabaseConnection(),
});

// Transient scope - new instance each time
container.set({
  id: 'uuid',
  scope: ContainerScope.Transient,
  value: () => crypto.randomUUID(),
});

// Resolve services
const apiUrl = container.resolve<string>('config.apiUrl');
const db = container.resolve<DatabaseConnection>('database');
```

### Using Classes

```ts
class UserService {
  constructor() {
    // initialized once for singleton
  }
}

container.set({
  id: UserService,
  scope: ContainerScope.Singleton,
  value: UserService, // class is auto-instantiated
});

const userService = container.resolve<UserService>(UserService);
```

### Using Symbols as Identifiers

```ts
const DATABASE = Symbol('database');
const LOGGER = Symbol('logger');

container.set({
  id: DATABASE,
  scope: ContainerScope.Singleton,
  value: () => new Database(),
});

const db = container.resolve(DATABASE);
```

### Factory with Dependencies

```ts
container.set({
  id: 'userRepo',
  scope: ContainerScope.Singleton,
  factory: () => new UserRepository(),
  deps: [],
});

container.set({
  id: 'orderRepo',
  scope: ContainerScope.Singleton,
  factory: () => new OrderRepository(),
  deps: [],
});

// Factory receives resolved dependencies as arguments
container.set({
  id: 'orderService',
  scope: ContainerScope.Singleton,
  factory: (userRepo, orderRepo) => new OrderService(userRepo, orderRepo),
  deps: ['userRepo', 'orderRepo'],
});

const orderService = container.resolve('orderService');
```

### Contextual Scope (Request-Scoped)

Contextual scope provides the same instance within an async context (e.g., HTTP request) but different instances across contexts.

```ts
container.set({
  id: 'requestId',
  scope: ContainerScope.Contextual,
  factory: () => crypto.randomUUID(),
  deps: [],
});

// In HTTP middleware or request handler
container.asyncLocalRun({}, () => {
  const id1 = container.resolve('requestId'); // e.g., "abc-123"
  const id2 = container.resolve('requestId'); // same: "abc-123"
});

container.asyncLocalRun({}, () => {
  const id3 = container.resolve('requestId'); // different: "xyz-789"
});
```

### Container Methods

```ts
// Check if service exists
container.has('myService'); // boolean

// Delete a service
container.delete('myService');

// Replace existing service (put allows replacement, set throws)
container.put({ id: 'myService', scope: ContainerScope.Value, value: 'new' });

// Get fresh instance (ignores singleton cache)
const fresh = container.fresh('myService');

// Pre-resolve all singletons (useful at app startup)
container.preresolve();

// Clone container with selected services
const childContainer = container.cloneWith('child', 'service1', 'service2');
```

### Calling Functions with Dependencies

```ts
// Sync call
const result = container.call(
  (db, logger) => db.query('SELECT * FROM users'),
  ['database', 'logger']
);

// Async call (resolves async dependencies)
const result = await container.callAsync(
  async (db) => await db.query('SELECT * FROM users'),
  ['database']
);
```

### Context Store (within asyncLocalRun)

```ts
container.asyncLocalRun(new Map(), () => {
  // Store arbitrary data in context
  container.contextStoreSet('userId', 123);

  // Retrieve from context
  const userId = container.contextStoreGet<number>('userId');
});
```

### Async Dependencies

```ts
container.set({
  id: 'asyncConfig',
  scope: ContainerScope.Singleton,
  value: () => fetch('/config').then(r => r.json()),
});

// Use resolveAsync for async values
const config = await container.resolveAsync<Config>('asyncConfig');
```

## Testing
Testing routes, can use with any testing tool
```ts
import t from 'tap';
import { TestHttpRouter } from 'astad/testing';

import routes from './api.js';

const testroute = TestHttpRouter(routes);

function createRequest(
  method: string,
  path: string,
  body?: Record<string, any>,
) {
  const req: any = {
    method: method,
    path: `/api${path}`,
    body,
    headers: { accept: 'application/json' },
  };

  if (body) {
    req.headers['content-type'] = 'application/json';
  }

  return testroute.req(req);
}

t.test('route', async t => {
  const res = await createRequest('GET', '/').exec();
  t.equal(res.status, 200);
  const data = res.json();
  t.hasOwnProp(data, 'name');
});

```

**Testing services**
```ts
import t from 'tap';
import { TestMinimalContext } from 'astad/testing';
import Service from './service.js';

// depends on service, if your service need context or your are using contextual container scope
const ctx = new TestMinimalContext();

t.test('service', async t => {
  await ctx.run(async () => {
    const service = new Service();
    const data = await service.test();
    t.ok(data);
  })
});

```

## TODO
- http: should consider accept header
- http: should compose or translate error to response
- http: improve throw in context, should accept error and custom inputs
- http/cors: should allow vary header configuration, for asset caching
- docs: automate documentation

## In-progress
- events handler
- background queue
- data mapper
- templating
- testing

## Bugs
- handle duplicate middlewares in router, should only have unique middlewares

## Issue Notes
Node.js[https://nodejs.org/api/stream.html#class-streamreadable]
One important caveat is that if the Readable stream emits an error during processing, the Writable destination is not closed automatically. If an error occurs, it will be necessary to manually close each stream in order to prevent memory leaks.

The process.stderr and process.stdout Writable streams are never closed until the Node.js process exits, regardless of the specified options.

## Doc Notes
- use "Deprecated since: version"
- use "Added: version"