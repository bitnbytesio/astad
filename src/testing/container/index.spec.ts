import t from 'tap';
import { Container, ContainerScope } from '../../container/index.js';
import { TestContainer } from './index.js';

// Test service classes
class UserService {
  name = 'UserService';
  findById(id: number) {
    return { id, name: 'Real User' };
  }
}

class DatabaseService {
  name = 'DatabaseService';
  query(sql: string) {
    return [{ sql }];
  }
}

// Mock services
const mockUserService = {
  name: 'MockUserService',
  findById: (id: number) => ({ id, name: 'Mock User' }),
};

t.test('TestContainer:mock() replaces service with value', async t => {
  const container = new Container('test');
  container.set({
    id: 'userService',
    scope: ContainerScope.Singleton,
    value: UserService,
  });

  const testContainer = new TestContainer(container);
  testContainer.mock('userService', mockUserService);

  const service = container.resolve<typeof mockUserService>('userService');
  t.equal(service.name, 'MockUserService');
  t.same(service.findById(1), { id: 1, name: 'Mock User' });
});

t.test('TestContainer:mock() saves original for restore', async t => {
  const container = new Container('test');
  container.set({
    id: 'userService',
    scope: ContainerScope.Singleton,
    value: UserService,
  });

  const testContainer = new TestContainer(container);
  testContainer.mock('userService', mockUserService);

  t.equal(testContainer.isMocked('userService'), true);
  t.same(testContainer.getMockedIds(), ['userService']);
});

t.test('TestContainer:restore() restores original service', async t => {
  const container = new Container('test');
  container.set({
    id: 'userService',
    scope: ContainerScope.Singleton,
    value: UserService,
  });

  const testContainer = new TestContainer(container);
  testContainer.mock('userService', mockUserService);

  // Verify mock is in place
  let service = container.resolve<any>('userService');
  t.equal(service.name, 'MockUserService');

  // Restore
  testContainer.restore();

  // Verify original is back
  service = container.resolve<UserService>('userService');
  t.equal(service.name, 'UserService');
  t.equal(testContainer.isMocked('userService'), false);
});

t.test('TestContainer:restoreOne() restores single service', async t => {
  const container = new Container('test');
  container.set({
    id: 'userService',
    scope: ContainerScope.Singleton,
    value: UserService,
  });
  container.set({
    id: 'dbService',
    scope: ContainerScope.Singleton,
    value: DatabaseService,
  });

  const testContainer = new TestContainer(container);
  testContainer.mock('userService', mockUserService);
  testContainer.mock('dbService', { name: 'MockDB' });

  // Restore only userService
  testContainer.restoreOne('userService');

  t.equal(testContainer.isMocked('userService'), false);
  t.equal(testContainer.isMocked('dbService'), true);

  const userService = container.resolve<UserService>('userService');
  t.equal(userService.name, 'UserService');
});

t.test('TestContainer:mockFactory() mocks with factory', async t => {
  const container = new Container('test');
  container.set({
    id: 'counter',
    scope: ContainerScope.Singleton,
    value: () => 0,
  });

  const testContainer = new TestContainer(container);
  let count = 0;
  testContainer.mockFactory('counter', () => ++count, []);

  // Each resolve should call factory (transient by default)
  t.equal(container.resolve('counter'), 1);
  t.equal(container.resolve('counter'), 2);
  t.equal(container.resolve('counter'), 3);
});

t.test('TestContainer:mockSingleton() mocks as singleton', async t => {
  const container = new Container('test');
  container.set({
    id: 'random',
    scope: ContainerScope.Transient,
    value: () => Math.random(),
  });

  const testContainer = new TestContainer(container);
  testContainer.mockSingleton('random', 42);

  // Should always return same value
  t.equal(container.resolve('random'), 42);
  t.equal(container.resolve('random'), 42);
});

t.test('TestContainer:mockContextual() mocks contextual service', async t => {
  const container = new Container('test');

  const testContainer = new TestContainer(container);
  let contextCount = 0;
  testContainer.mockContextual('requestId', () => `req-${++contextCount}`, []);

  // Run in context
  await testContainer.runInContext(async () => {
    const id1 = container.resolve('requestId');
    const id2 = container.resolve('requestId');
    t.equal(id1, id2, 'Same ID within context');
    t.equal(id1, 'req-1');
  });

  // Run in new context
  await testContainer.runInContext(async () => {
    const id = container.resolve('requestId');
    t.equal(id, 'req-2', 'Different ID in new context');
  });
});

t.test('TestContainer:mock() chains fluently', async t => {
  const container = new Container('test');
  container.set({ id: 'a', scope: ContainerScope.Value, value: 1 });
  container.set({ id: 'b', scope: ContainerScope.Value, value: 2 });

  const testContainer = new TestContainer(container);
  const result = testContainer
    .mock('a', 10)
    .mock('b', 20);

  t.equal(result, testContainer);
  t.equal(container.resolve('a'), 10);
  t.equal(container.resolve('b'), 20);
});

t.test('TestContainer:mock() can mock non-existent service', async t => {
  const container = new Container('test');
  const testContainer = new TestContainer(container);

  testContainer.mock('newService', { name: 'new' });

  t.equal(container.has('newService'), true);
  t.same(container.resolve('newService'), { name: 'new' });

  // Restore should remove it since it didn't exist originally
  testContainer.restore();
  t.equal(container.has('newService'), false);
});

t.test('TestContainer:spy() tracks method calls', async t => {
  const container = new Container('test');
  container.set({
    id: 'userService',
    scope: ContainerScope.Singleton,
    value: UserService,
  });

  const testContainer = new TestContainer(container);
  const spy = testContainer.spy<UserService>('userService');

  // Call the method
  const result = spy.service.findById(42);

  t.same(result, { id: 42, name: 'Real User' });
  t.equal(spy.wasCalled(), true);
  t.equal(spy.wasCalled('findById'), true);
  t.equal(spy.getCallCount(), 1);
  t.equal(spy.getCallCount('findById'), 1);

  const calls = spy.getCallsFor('findById');
  t.equal(calls.length, 1);
  t.same(calls[0].args, [42]);
  t.same(calls[0].result, { id: 42, name: 'Real User' });
});

t.test('TestContainer:spy() tracks multiple calls', async t => {
  const container = new Container('test');
  container.set({
    id: 'userService',
    scope: ContainerScope.Singleton,
    value: UserService,
  });

  const testContainer = new TestContainer(container);
  const spy = testContainer.spy<UserService>('userService');

  spy.service.findById(1);
  spy.service.findById(2);
  spy.service.findById(3);

  t.equal(spy.getCallCount('findById'), 3);

  spy.reset();
  t.equal(spy.getCallCount(), 0);
});

t.test('TestContainer:runInContext() provides async context', async t => {
  const container = new Container('test');

  const testContainer = new TestContainer(container);
  testContainer.mockContextual('contextValue', () => 'created-in-context', []);

  let capturedValue: any;
  await testContainer.runInContext(async () => {
    capturedValue = container.resolve('contextValue');
  });

  t.equal(capturedValue, 'created-in-context');
});

t.test('TestContainer:getMockedIds() returns all mocked ids', async t => {
  const container = new Container('test');
  container.set({ id: 'a', scope: ContainerScope.Value, value: 1 });
  container.set({ id: 'b', scope: ContainerScope.Value, value: 2 });
  container.set({ id: 'c', scope: ContainerScope.Value, value: 3 });

  const testContainer = new TestContainer(container);
  testContainer.mock('a', 10);
  testContainer.mock('c', 30);

  const ids = testContainer.getMockedIds();
  t.equal(ids.length, 2);
  t.ok(ids.includes('a'));
  t.ok(ids.includes('c'));
  t.notOk(ids.includes('b'));
});
