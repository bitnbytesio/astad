import t from 'tap';
import { HttpRoute } from './route.js';

t.test('HttpRoute::static', async t => {
  const r = new HttpRoute(['GET'], '/id', () => 'static', { s: 'ok' });
  t.ok(r.matchMethod('GET'));
  t.ok(r.match('/id'));
  t.ok(r.isStatic());
  t.type(r.getHandler(), 'function');
  t.same(r.meta(), { s: 'ok' });
});

t.test('HttpRoute::dynamic', async t => {
  const r = new HttpRoute(['GET', 'POST'], '/:id', () => 'dynamic', { s: 'ok' });
  t.ok(r.matchMethod('GET'));
  t.ok(r.matchMethod('POST'));
  t.ok(r.match('/16'));
  t.ok(r.match('/ac'));
  t.notOk(r.isStatic());
  t.type(r.getHandler(), 'function');
  t.same(r.meta(), { s: 'ok' });
});

t.test('HttpRoute::middleware', async t => {
  const rout1 = new HttpRoute(['GET', 'POST'], '/:id', (ctx: any) => ctx.body = 'dynamic');
  rout1.middleware((ctx: any, next: any) => {
    ctx.body = { m: 1 };
    return next();
  });
  t.type(rout1.getHandler(), 'array');
  const handle1 = rout1.getComposedHandler();
  const ctx1: any = {};
  await handle1(ctx1, async () => { });
  t.equal(ctx1.body, 'dynamic');


  // abort in middleware
  // middleware will not handover control
  const rout2 = new HttpRoute(['GET', 'POST'], '/:id', (ctx: any) => ctx.body = 'dynamic');
  rout2.middleware((ctx: any, next: any) => {
    ctx.body = { m: 1 };
  });
  t.type(rout2.getHandler(), 'array');
  const handle2 = rout2.getComposedHandler();
  const ctx2: any = {};
  await handle2(ctx2, async () => { });
  t.same(ctx2.body, { m: 1 });

  // before middleware
  // middleware will not handover control, but will update respone
  const rout3 = new HttpRoute(['GET', 'POST'], '/:id', (ctx: any) => ctx.body = { ok: 1 });
  rout3.middleware(async (ctx: any, next: any) => {
    await next();
    ctx.body.ok += 1;
  });
  t.type(rout3.getHandler(), 'array');
  const handle3 = rout3.getComposedHandler();
  const ctx3: any = {};
  await handle3(ctx3, async () => { });
  t.same(ctx3.body, { ok: 2 });
});
