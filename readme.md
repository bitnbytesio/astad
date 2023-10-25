# Astad

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
  async render(template: string, data: Record<any, any> = {}) {
    return await ejs.renderFile(`./resources/views/${template}.ejs.html`, data);
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

## Console application
```ts
import { Astad, AstadContext, AstadCompose } from 'astad';

class TestCommand {
  signature: string = "test";

  description: string = "This is test command!";

  compose() {
    const command = new AstadCompose(this.signature);
    return command;
  }

  async handle(ctx: AstadContext) {
    ctx.info('This is test command!');
  }
}

const cmd = new Astad();
cmd.register(new TestCommand);
await cmd.handle();

```

## Container example
```ts
import { Container, ContainerScope } from 'astad/container';

const container = new Container('default');

container.register({
  id: 'static value',
  scope: ContainerScope.Value,
  value: 'Any static value',
});

container.register({
  id: 'static date',
  scope: ContainerScope.Singleton,
  value: () => new Date(),
});

container.register({
  id: 'current date',
  scope: ContainerScope.Transient,
  value: () => new Date(),
});

// only available within context
container.register({
  id: 'context date',
  scope: ContainerScope.Contextual,
  value: () => new Date(),
});

console.log(container.resolve('static value')); // will print "Any static value"
console.log(container.resolve('static date')); // will print same date not matter how many times you resolve
console.log(container.resolve('static date')); // will print same date not matter how many times you resolve
console.log(container.resolve('current date')); // always give current data
console.log(container.resolve('current date')); // always give current data

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
- container: improve guess identifier name in errors

## In-progress
- events handler
- background queue
- data mapper
- templating
- testing