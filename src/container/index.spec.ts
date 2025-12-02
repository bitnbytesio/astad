import t from 'tap';
import { Container, ContainerScope } from './index.js';

class TestService {
  readonly id: number
  constructor() {
    this.id = Math.random() + Math.random();
  }
}

class TestFactory {
  readonly id: number
  readonly args: Array<any>;
  constructor(readonly type: string, ...args: any) {
    this.args = args;
    this.id = Math.random() + Math.random();
  }

  first() {
    return this.args[0];
  }


  toArray() {
    return this.args;
  }

  toObject() {
    return this.args[0];
  }
}

t.test('container:value()', async t => {
  const container = new Container('default');
  container.set({
    id: 'user.id',
    scope: ContainerScope.Value,
    value: 1,
  });

  t.equal(container.value('user.id'), 1);
});


t.test('container:resolve()->value', async t => {
  const container = new Container('default');
  container.set({
    id: 'user.id',
    scope: ContainerScope.Value,
    value: 1,
  });

  t.ok(container.hasResolved('user.id'));
  t.equal(container.resolve('user.id'), 1);
});

t.test('container:resolve(Function)->singleton', async t => {
  const container = new Container('default');
  container.set({
    id: 'test',
    scope: ContainerScope.Singleton,
    value: () => Date.now() + Math.random(),
  });

  const value = container.resolve('test');
  t.ok(container.hasResolved('test'));
  t.type(value, 'number');
  for (let i = 0; i < 9; i++) {
    t.equal(container.resolve('test'), value);
  }
});

t.test('container:resolve(Function)->transient', async t => {
  const container = new Container('default');
  container.set({
    id: 'test',
    scope: ContainerScope.Transient,
    value: () => Date.now() + Math.random(),
  });

  const value = container.resolve('test');
  t.type(value, 'number');
  t.notOk(container.hasResolved('test'));

  for (let i = 0; i < 9; i++) {
    t.notSame(container.resolve('test'), value);
  }
});


t.test('container:resolve(TestService)->singleton', async t => {
  const container = new Container('default');
  container.set({
    id: 'test',
    scope: ContainerScope.Singleton,
    value: TestService,
  });

  const value = container.resolve<TestService>('test').id;
  t.type(value, 'number');
  t.ok(container.hasResolved('test'));
  for (let i = 0; i < 9; i++) {
    t.equal(container.resolve<TestService>('test').id, value);
  }
});


t.test('container:set(static value not allowed)->transient', async t => {
  const container = new Container('default');

  t.throws(() => {
    container.set({
      id: 'test',
      scope: ContainerScope.Transient,
      value: 1,
    });
  });

  t.throws(() => {
    container.set({
      id: 'test',
      scope: ContainerScope.Transient,
      value: {},
    });
  });

  t.throws(() => {
    container.set({
      id: 'test',
      scope: ContainerScope.Transient,
      value: new TestService,
    });
  });
});

class User {}

t.test('container:resolve(factory)->singleton', async t => {
  const container = new Container('default');
  container.set({
    id: User,
    scope: ContainerScope.Singleton,
    factory: () => new TestFactory('USER', { id: 'u1' }),
    deps: [],
  });

  container.set({
    id: 'product',
    scope: ContainerScope.Singleton,
    factory: () => new TestFactory('PRODUCTS', { id: 'p1' }, { id: 'p2' }),
    deps: [],
  });

  container.set({
    id: 'UserProduct',
    scope: ContainerScope.Singleton,
    factory: (user: TestFactory, product: TestFactory) => new TestFactory('UserProduct', { user: user.first(), products: product.toArray() }),
    deps: [User, 'product'],
  });

  const instance = container.resolve<TestFactory>('UserProduct');
  t.ok(container.hasResolved('UserProduct'));
  for (let i = 0; i < 9; i++) {
    t.equal(container.resolve<TestFactory>('UserProduct').id, instance.id);
  }

  t.type(instance.first().user, 'object');
  t.equal(instance.first().user.id, 'u1');
  t.type(instance.first().products, 'array');
  t.type(instance.first().products[0].id, 'p1');
  t.type(instance.first().products[1].id, 'p2');
});

t.test('container:resolve(factory)->transient', async t => {
  const container = new Container('default');
  container.set({
    id: 'user',
    scope: ContainerScope.Transient,
    factory: () => new TestFactory('USER', { id: 'u1' }),
    deps: [],
  });

  container.set({
    id: 'product',
    scope: ContainerScope.Singleton,
    factory: () => new TestFactory('PRODUCTS', { id: 'p1' }, { id: 'p2' }),
    deps: [],
  });

  container.set({
    id: 'UserProduct',
    scope: ContainerScope.Transient,
    factory: (user: TestFactory, product: TestFactory) => new TestFactory('UserProduct', { user: { id: user.id }, product: { id: product.id } }),
    deps: ['user', 'product'],
  });

  const instance = container.resolve<TestFactory>('UserProduct');
  t.notOk(container.hasResolved('UserProduct'));

  for (let i = 0; i < 9; i++) {
    const local = container.resolve<TestFactory>('UserProduct')
    t.notSame(local.id, instance.id);

    t.type(local.first().user, 'object');
    t.type(local.first().product, 'object');

    t.notSame(local.first().user.id, instance.first().user.id);
    t.equal(local.first().product.id, instance.first().product.id);
  }
});


t.test('container:resolveAsync()->singleton', async t => {
  const container = new Container('default');
  container.set({
    id: 'singleton',
    scope: ContainerScope.Singleton,
    value: () => new Promise(resolve => setTimeout(() => resolve(Math.random() + Math.random()), 1000)),
  });

  const [par1, par2] = await Promise.all([container.resolveAsync('singleton'), container.resolveAsync('singleton')]);
  t.equal(par1, par2);

  const instance1 = await container.resolveAsync('singleton');
  t.type(instance1, 'number');
  const instance2 = await container.resolveAsync('singleton');
  t.equal(instance1, instance2);
});

t.test('container:resolveAsync()->transient', async t => {
  const container = new Container('default');
  container.set({
    id: 'transient',
    scope: ContainerScope.Transient,
    value: () => new Promise(resolve => setTimeout(() => resolve(Math.random() + Math.random()), 1000)),
  });

  const instance0 = container.resolve('transient');
  t.type(instance0, Promise);

  for (let i = 0; i < 4; i++) {
    const instance1 = await container.resolveAsync('transient');
    const instance2 = await container.resolveAsync('transient');
    t.type(instance1, 'number');
    t.notSame(instance1, instance2);
    const [instance3, instance4] = await Promise.all([container.resolveAsync('transient'), container.resolveAsync('transient')]);
    t.notSame(instance3, instance4);
  }
});


t.test('container:resolve(factory)->contextual', async t => {
  const container = new Container('default');
  container.set({
    id: 'user',
    scope: ContainerScope.Contextual,
    factory: () => new TestFactory('USER', { id: 'u1' }),
    deps: [],
  });

  t.throws(() => { // context not available
    container.resolve('user');
  });

  let pair1: any = [], pair2: any = [];

  container.asyncLocalRun({}, () => {
    t.notOk(container.hasResolved('user'));
    pair1[0] = container.resolve<TestFactory>('user');
    t.ok(container.hasResolved('user'));
    pair2[0] = container.resolve<TestFactory>('user');
  });

  container.asyncLocalRun({}, () => {
    t.notOk(container.hasResolved('user'));
    pair1[1] = container.resolve<TestFactory>('user');
    t.ok(container.hasResolved('user'));
    pair2[1] = container.resolve<TestFactory>('user');
  });

  t.ok(pair1.length == 2);
  t.ok(pair2.length == 2);

  t.equal(pair1[0].id, pair2[0].id);
  t.equal(pair1[1].id, pair2[1].id);

  t.notSame(pair1[0].id, pair1[1].id);
  t.notSame(pair2[0].id, pair2[1].id);
});

t.test('container:has() and delete()', async t => {
  const container = new Container('default');
  container.set({
    id: 'test',
    scope: ContainerScope.Value,
    value: 'hello',
  });

  t.ok(container.has('test'));
  t.notOk(container.has('nonexistent'));

  container.delete('test');
  t.notOk(container.has('test'));
});

t.test('container:put() replaces existing', async t => {
  const container = new Container('default');
  container.set({
    id: 'test',
    scope: ContainerScope.Value,
    value: 'first',
  });

  t.equal(container.value('test'), 'first');

  container.put({
    id: 'test',
    scope: ContainerScope.Value,
    value: 'second',
  });

  t.equal(container.value('test'), 'second');
});

t.test('container:fresh() always returns new instance', async t => {
  const container = new Container('default');
  container.set({
    id: 'singleton',
    scope: ContainerScope.Singleton,
    value: () => Math.random(),
  });

  const resolved1 = container.resolve('singleton');
  const resolved2 = container.resolve('singleton');
  t.equal(resolved1, resolved2);

  const fresh1 = container.fresh('singleton');
  const fresh2 = container.fresh('singleton');
  t.notSame(fresh1, resolved1);
  t.notSame(fresh1, fresh2);
});

t.test('container:call() invokes function with deps', async t => {
  const container = new Container('default');
  container.set({
    id: 'multiplier',
    scope: ContainerScope.Value,
    value: 10,
  });
  container.set({
    id: 'addend',
    scope: ContainerScope.Value,
    value: 5,
  });

  const result = container.call(
    (m: number, a: number) => m * 2 + a,
    ['multiplier', 'addend']
  );

  t.equal(result, 25);
});

t.test('container:callAsync() invokes async function with deps', async t => {
  const container = new Container('default');
  container.set({
    id: 'asyncValue',
    scope: ContainerScope.Singleton,
    value: () => Promise.resolve(42),
  });

  const result = await container.callAsync(
    async (val: number) => val * 2,
    ['asyncValue']
  );

  t.equal(result, 84);
});

t.test('container:preresolve() resolves all singletons', async t => {
  const container = new Container('default');
  let singletonCalled = false;
  let transientCalled = false;

  container.set({
    id: 'singleton',
    scope: ContainerScope.Singleton,
    value: () => { singletonCalled = true; return 'singleton'; },
  });

  container.set({
    id: 'transient',
    scope: ContainerScope.Transient,
    value: () => { transientCalled = true; return 'transient'; },
  });

  t.notOk(singletonCalled);
  t.notOk(transientCalled);

  container.preresolve();

  t.ok(singletonCalled);
  t.notOk(transientCalled);
});

t.test('container:cloneWith() creates new container with selected services', async t => {
  const container = new Container('original');
  container.set({
    id: 'service1',
    scope: ContainerScope.Value,
    value: 'value1',
  });
  container.set({
    id: 'service2',
    scope: ContainerScope.Value,
    value: 'value2',
  });
  container.set({
    id: 'service3',
    scope: ContainerScope.Value,
    value: 'value3',
  });

  const cloned = container.cloneWith('cloned', 'service1', 'service3');

  t.equal(cloned.id, 'cloned');
  t.ok(cloned.has('service1'));
  t.notOk(cloned.has('service2'));
  t.ok(cloned.has('service3'));
  t.equal(cloned.value('service1'), 'value1');
  t.equal(cloned.value('service3'), 'value3');
});

t.test('container:cloneWith() throws on nonexistent service', async t => {
  const container = new Container('original');
  container.set({
    id: 'service1',
    scope: ContainerScope.Value,
    value: 'value1',
  });

  t.throws(() => {
    container.cloneWith('cloned', 'service1', 'nonexistent');
  });
});

t.test('container:contextStoreSet() and contextStoreGet()', async t => {
  const container = new Container('default');

  t.throws(() => {
    container.contextStoreGet('key');
  });

  container.asyncLocalRun(new Map(), () => {
    container.contextStoreSet('myKey', 'myValue');
    t.equal(container.contextStoreGet('myKey'), 'myValue');
    t.equal(container.contextStoreGet('nonexistent'), undefined);
  });
});

t.test('container:resolve() throws on unregistered identifier', async t => {
  const container = new Container('default');

  t.throws(() => {
    container.resolve('nonexistent');
  });
});

t.test('container:value() throws on non-value scope', async t => {
  const container = new Container('default');
  container.set({
    id: 'singleton',
    scope: ContainerScope.Singleton,
    value: () => 'test',
  });

  t.throws(() => {
    container.value('singleton');
  });
});

t.test('container:register() throws on duplicate', async t => {
  const container = new Container('default');
  container.set({
    id: 'test',
    scope: ContainerScope.Value,
    value: 'first',
  });

  t.throws(() => {
    container.set({
      id: 'test',
      scope: ContainerScope.Value,
      value: 'second',
    });
  });
});

t.test('container:symbol identifier', async t => {
  const container = new Container('default');
  const MY_SERVICE = Symbol('myService');

  container.set({
    id: MY_SERVICE,
    scope: ContainerScope.Value,
    value: 'symbol value',
  });

  t.equal(container.resolve(MY_SERVICE), 'symbol value');
  t.ok(container.has(MY_SERVICE));
});