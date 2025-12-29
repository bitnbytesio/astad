import t from 'tap';
import { IHttpContext } from '../../http/context.js';
import {
  TestMiddleware,
  chainMiddleware,
  createPassthroughMiddleware,
  createContextSetterMiddleware,
  createAbortMiddleware,
} from './middleware.js';

// Test middlewares
const authMiddleware = async (ctx: IHttpContext, next: () => Promise<void>) => {
  const token = ctx.headers.get('authorization');
  if (!token || !token.startsWith('Bearer ')) {
    ctx.abort(401, 'Unauthorized');
    return;
  }
  ctx.put('userId', 'user-123');
  await next();
};

const loggerMiddleware = async (ctx: IHttpContext, next: () => Promise<void>) => {
  ctx.put('logStart', Date.now());
  await next();
  ctx.put('logEnd', Date.now());
};

const errorMiddleware = async (_ctx: IHttpContext, _next: () => Promise<void>) => {
  throw new Error('Middleware error');
};

class ClassMiddleware {
  async handle(ctx: IHttpContext, next: () => Promise<void>) {
    ctx.put('classMiddleware', true);
    await next();
  }
}

// Tests
t.test('TestMiddleware:run() executes middleware', async t => {
  const tester = new TestMiddleware(loggerMiddleware);

  const result = await tester.run({ path: '/test' });

  t.equal(result.success, true);
  t.equal(result.nextCalled, true);
  t.ok(result.value('logStart'));
  t.ok(result.value('logEnd'));
});

t.test('TestMiddleware:run() with auth success', async t => {
  const tester = new TestMiddleware(authMiddleware);

  const result = await tester.run({
    path: '/api/users',
    headers: { authorization: 'Bearer valid-token' },
  });

  t.equal(result.success, true);
  t.equal(result.nextCalled, true);
  t.equal(result.value('userId'), 'user-123');
});

t.test('TestMiddleware:run() with auth failure', async t => {
  const tester = new TestMiddleware(authMiddleware);

  const result = await tester.run({
    path: '/api/users',
    headers: {},
  });

  t.equal(result.nextCalled, false);
  t.equal(result.aborted, true);
  t.equal(result.response.status, 401);
});

t.test('TestMiddleware:run() captures errors', async t => {
  const tester = new TestMiddleware(errorMiddleware);

  const result = await tester.run({ path: '/test' });

  t.equal(result.success, false);
  t.ok(result.error);
  t.equal(result.error?.message, 'Middleware error');
});

t.test('TestMiddleware:run() with class middleware', async t => {
  const tester = new TestMiddleware(new ClassMiddleware());

  const result = await tester.run({ path: '/test' });

  t.equal(result.success, true);
  t.equal(result.value('classMiddleware'), true);
});

t.test('TestMiddleware:run() with context values', async t => {
  const middleware = async (ctx: IHttpContext, next: () => Promise<void>) => {
    ctx.put('combined', ctx.value('preset') + '-added');
    await next();
  };

  const tester = new TestMiddleware(middleware);

  const result = await tester.run(
    { path: '/test' },
    { contextValues: { preset: 'value' } }
  );

  t.equal(result.value('combined'), 'value-added');
});

t.test('TestMiddleware:run() with next throwing', async t => {
  const middleware = async (ctx: IHttpContext, next: () => Promise<void>) => {
    try {
      await next();
    } catch (err: any) {
      ctx.put('caughtError', err.message);
    }
  };

  const tester = new TestMiddleware(middleware);

  const result = await tester.run(
    { path: '/test' },
    {
      nextBehavior: 'throw',
      nextError: new Error('Next error'),
    }
  );

  t.equal(result.value('caughtError'), 'Next error');
});

t.test('TestMiddleware:runExpectNext() passes when next called', async t => {
  const tester = new TestMiddleware(loggerMiddleware);

  const result = await tester.runExpectNext({ path: '/test' });
  t.equal(result.nextCalled, true);
});

t.test('TestMiddleware:runExpectNext() throws when next not called', async t => {
  const tester = new TestMiddleware(authMiddleware);

  await t.rejects(
    tester.runExpectNext({ path: '/test', headers: {} }),
    /Expected next\(\) to be called/
  );
});

t.test('TestMiddleware:runExpectAbort() passes when aborted', async t => {
  const tester = new TestMiddleware(authMiddleware);

  const result = await tester.runExpectAbort({
    path: '/test',
    headers: {},
  });

  t.equal(result.nextCalled, false);
});

t.test('TestMiddleware:runExpectAbort() throws when next called', async t => {
  const tester = new TestMiddleware(loggerMiddleware);

  await t.rejects(
    tester.runExpectAbort({ path: '/test' }),
    /Expected middleware to abort/
  );
});

t.test('TestMiddleware:runExpectError() passes on error', async t => {
  const tester = new TestMiddleware(errorMiddleware);

  const result = await tester.runExpectError({ path: '/test' });
  t.ok(result.error);
});

t.test('TestMiddleware:runExpectError() throws on success', async t => {
  const tester = new TestMiddleware(loggerMiddleware);

  await t.rejects(
    tester.runExpectError({ path: '/test' }),
    /Expected middleware to throw/
  );
});

t.test('TestMiddleware:getHeader() returns response header', async t => {
  const middleware = async (ctx: IHttpContext, next: () => Promise<void>) => {
    ctx.headers.set('x-custom', 'value');
    await next();
  };

  const tester = new TestMiddleware(middleware);
  const result = await tester.run({ path: '/test' });

  t.equal(result.getHeader('x-custom'), 'value');
});

// chainMiddleware tests
t.test('chainMiddleware() chains multiple middlewares', async t => {
  const order: string[] = [];

  const m1 = async (_ctx: IHttpContext, next: () => Promise<void>) => {
    order.push('m1-before');
    await next();
    order.push('m1-after');
  };

  const m2 = async (_ctx: IHttpContext, next: () => Promise<void>) => {
    order.push('m2-before');
    await next();
    order.push('m2-after');
  };

  const chained = chainMiddleware(m1, m2);
  const tester = new TestMiddleware(chained);

  await tester.run({ path: '/test' });

  t.same(order, ['m1-before', 'm2-before', 'm2-after', 'm1-after']);
});

t.test('chainMiddleware() with class middleware', async t => {
  const fn = async (ctx: IHttpContext, next: () => Promise<void>) => {
    ctx.put('fn', true);
    await next();
  };

  const chained = chainMiddleware(fn, new ClassMiddleware());
  const tester = new TestMiddleware(chained);

  const result = await tester.run({ path: '/test' });

  t.equal(result.value('fn'), true);
  t.equal(result.value('classMiddleware'), true);
});

t.test('chainMiddleware() stops on abort when middleware returns', async t => {
  const order: string[] = [];

  const m1 = async (ctx: IHttpContext, next: () => Promise<void>) => {
    order.push('m1');
    ctx.abort(403);
    // Middleware must return after abort to stop chain
    return;
  };

  const m2 = async (_ctx: IHttpContext, next: () => Promise<void>) => {
    order.push('m2');
    await next();
  };

  const chained = chainMiddleware(m1, m2);
  const tester = new TestMiddleware(chained);

  const result = await tester.run({ path: '/test' });

  t.same(order, ['m1']);
  t.equal(result.response.status, 403);
});

// Helper function tests
t.test('createPassthroughMiddleware() just calls next', async t => {
  const middleware = createPassthroughMiddleware();
  const tester = new TestMiddleware(middleware);

  const result = await tester.run({ path: '/test' });

  t.equal(result.nextCalled, true);
});

t.test('createContextSetterMiddleware() sets values', async t => {
  const middleware = createContextSetterMiddleware({
    key1: 'value1',
    key2: 42,
  });
  const tester = new TestMiddleware(middleware);

  const result = await tester.run({ path: '/test' });

  t.equal(result.value('key1'), 'value1');
  t.equal(result.value('key2'), 42);
  t.equal(result.nextCalled, true);
});

t.test('createAbortMiddleware() aborts with status', async t => {
  const middleware = createAbortMiddleware(404, 'Not Found');
  const tester = new TestMiddleware(middleware);

  const result = await tester.run({ path: '/test' });

  t.equal(result.response.status, 404);
  t.equal(result.nextCalled, false);
  t.equal(result.aborted, true);
});

t.test('TestMiddleware with different HTTP methods', async t => {
  const methodMiddleware = async (ctx: IHttpContext, next: () => Promise<void>) => {
    ctx.put('method', ctx.method);
    await next();
  };

  const tester = new TestMiddleware(methodMiddleware);

  const getResult = await tester.run({ path: '/test', method: 'GET' });
  t.equal(getResult.value('method'), 'GET');

  const postResult = await tester.run({ path: '/test', method: 'POST' });
  t.equal(postResult.value('method'), 'POST');
});

t.test('TestMiddleware with body', async t => {
  const bodyMiddleware = async (ctx: IHttpContext, next: () => Promise<void>) => {
    ctx.put('body', ctx.body);
    await next();
  };

  const tester = new TestMiddleware(bodyMiddleware);

  const result = await tester.run({
    path: '/test',
    method: 'POST',
    body: { name: 'test', value: 123 },
  });

  t.same(result.value('body'), { name: 'test', value: 123 });
});

t.test('TestMiddleware with query params', async t => {
  const queryMiddleware = async (ctx: IHttpContext, next: () => Promise<void>) => {
    ctx.put('page', ctx.query.get('page'));
    ctx.put('limit', ctx.query.get('limit'));
    await next();
  };

  const tester = new TestMiddleware(queryMiddleware);

  const result = await tester.run({
    path: '/test',
    query: { page: '1', limit: '10' },
  });

  t.equal(result.value('page'), '1');
  t.equal(result.value('limit'), '10');
});
