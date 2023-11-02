import t from 'tap';
import { HttpRouter } from './router.js';
import { HttpRoute } from './route.js';

t.test('HttpRouter::use', async t => {
  // auth routes
  const auth = new HttpRouter({ prefix: '/auth' });
  auth.post('/login', () => '/auth/login');
  t.type(auth.find('POST', '/auth/login'), HttpRoute);

  // parent api router
  const api = new HttpRouter({ prefix: '/api' });
  api.get('/', () => '/api');
  t.type(api.find('GET', '/api'), HttpRoute);

  // now use auth
  api.use(auth);
  // should have default route
  const handleApi = api.find('GET', '/api')
  t.type(handleApi, HttpRoute);
  if (handleApi) {
    t.equal(handleApi.getHandler()(), '/api');
  }

  // should have child route, given by use of auth
  const handleApiAuthLogin = api.find('POST', '/api/auth/login');
  t.type(handleApiAuthLogin, HttpRoute);
  if (handleApiAuthLogin) {
    t.equal(handleApiAuthLogin.getHandler()(), '/auth/login');
  }

  // another wrapper
  const router = new HttpRouter();
  router.get('/', () => '/');
  const routeDefault = router.find('GET', '/')
  t.type(routeDefault, HttpRoute);

  // now use api
  router.use(api);
  // should have default route
  t.type(router.find('GET', '/'), HttpRoute);
  // should have api default route
  t.type(router.find('GET', '/api'), HttpRoute);
  // should have auth login route
  t.type(router.find('POST', '/api/auth/login'), HttpRoute);
});

t.test('HttpRouter::prefix', async t => {
  const router = new HttpRouter();
  router.get('/', () => '/');
  const routeDefault = router.find('GET', '/')
  t.type(routeDefault, HttpRoute);

  const auth = router.prefix('/auth');
  auth.post('/login', () => '/auth/login');

  const handleAuthLogin = router.find('POST', '/auth/login')
  t.type(handleAuthLogin, HttpRoute);
  if (handleAuthLogin) {
    t.equal(handleAuthLogin.getHandler()(), '/auth/login');
  }
});

t.test('HttpRouter::middlewares', async t => {
  const router = new HttpRouter({
    middlewares: [
      async (ctx: any, next: any) => {
        ctx.body = { m: 1 };
        await next();
      },
    ]
  });
  router.get('/', (ctx: any) => ctx.body = { m: (ctx.body?.m || 0) + 1 });
  const routeDefault = router.find('GET', '/')
  t.type(routeDefault, HttpRoute);
  if (routeDefault) {
    t.type(routeDefault.getHandler(), 'function');
    const handle = routeDefault.getComposedHandler();
    const ctx: any = {};
    await handle(ctx, async () => { });
    t.type(ctx.body, 'object');
    t.equal(ctx.body.m, 2);
  }
});

t.test('HttpRouter::middlewares with use()', async t => {
  const router = new HttpRouter({
    middlewares: [
      async (ctx: any, next: any) => {
        ctx.body = { m: 1 };
        await next();
      },
    ]
  });
  router.get('/', (ctx: any) => ctx.body = { m: (ctx.body?.m || 0) + 1 });

  // parent router
  const parent = new HttpRouter({});
  parent.use(router);
  const routeDefault = parent.find('GET', '/');
  t.type(routeDefault, HttpRoute);
  if (routeDefault) {
    t.type(routeDefault.getHandler(), 'function');
    const handle = routeDefault.getComposedHandler();
    const ctx: any = {};
    await handle(ctx, async () => { });
    t.type(ctx.body, 'object');
    t.equal(ctx.body.m, 2);
  }
});

t.test('HttpRouter::middlewares with use(prefix)', async t => {
  const router = new HttpRouter({
    middlewares: [
      async (ctx: any, next: any) => {
        ctx.body = { m: 1 };
        await next();
      },
    ]
  });
  router.get('/', (ctx: any) => ctx.body = { m: (ctx.body?.m || 0) + 1 });

  // parent router
  const parent = new HttpRouter({ prefix: '/api' });
  parent.use(router);
  const routeDefault = parent.find('GET', '/api');
  t.type(routeDefault, HttpRoute);
  if (routeDefault) {
    t.type(routeDefault.getHandler(), 'function');
    const handle = routeDefault.getComposedHandler();
    const ctx: any = {};
    await handle(ctx, async () => { });
    t.type(ctx.body, 'object');
    t.equal(ctx.body.m, 2);
  }
});