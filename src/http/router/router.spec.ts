import t from 'tap';
import { HttpRouter } from './router.js';
import { HttpRoute } from './route.js';

t.test('HttpRoute::use', async t => {
  const auth = new HttpRouter({ prefix: '/auth' });
  auth.post('/login', () => '/auth/login');
  t.type(auth.find('POST', '/auth/login'), HttpRoute);

  const api = new HttpRouter({ prefix: '/api' });
  api.get('/', () => '/api');
  t.type(api.find('GET', '/api'), HttpRoute);

  // now use auth
  api.use(auth);
  const handleApi = api.find('GET', '/api')
  t.type(handleApi, HttpRoute);
  if (handleApi) {
    t.equal(handleApi.getHandler()(), '/api');
  }

  const handleApiAuthLogin = api.find('POST', '/api/auth/login');
  t.type(handleApiAuthLogin, HttpRoute);
  if (handleApiAuthLogin) {
    t.equal(handleApiAuthLogin.getHandler()(), '/auth/login');
  }

  const router = new HttpRouter();
  router.get('/', () => '/');
  const routeDefault = router.find('GET', '/')
  t.type(routeDefault, HttpRoute);

  // now use api
  router.use(api);
  t.type(router.find('GET', '/'), HttpRoute);
  t.type(router.find('GET', '/api'), HttpRoute);
  t.type(router.find('POST', '/api/auth/login'), HttpRoute);
});

t.test('HttpRoute::prefix', async t => {
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