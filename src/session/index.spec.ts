import t from 'tap';

import { Session } from './index.js';
import { SessionFileDriver } from './file.js';

t.test('Session::init() creates new session', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();
  t.type(sess.id, 'string');
  t.equal(sess.id.length, 32); // hex string from 16 bytes
  t.equal(sess.opened, true);
  await sess.destroy();
});

t.test('Session::init() reopens existing session', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();
  const id = sess.id;
  await sess.close();

  await sess.init(id);
  t.equal(sess.id, id);
  await sess.destroy();
});

t.test('Session::set() and get() with primitives', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();

  sess.set('string', 'hello');
  sess.set('number', 42);
  sess.set('boolean', true);

  t.equal(sess.get('string'), 'hello');
  t.equal(sess.get('number'), 42);
  t.equal(sess.get('boolean'), true);

  await sess.destroy();
});

t.test('Session::set() and get() with objects', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();

  const obj = { name: 'test', nested: { value: 123 } };
  sess.set('object', obj);

  const retrieved = sess.get('object');
  t.same(retrieved, obj);
  // Verify it's a clone (not same reference)
  obj.name = 'modified';
  t.equal(sess.get('object').name, 'test');

  await sess.destroy();
});

t.test('Session::set() and get() with arrays', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();

  const arr = [1, 2, { key: 'value' }];
  sess.set('array', arr);

  t.same(sess.get('array'), arr);
  await sess.destroy();
});

t.test('Session::get() returns undefined for missing key', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();

  t.equal(sess.get('nonexistent'), undefined);
  await sess.destroy();
});

t.test('Session::has() checks key existence', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();

  t.equal(sess.has('key'), false);
  sess.set('key', 'value');
  t.equal(sess.has('key'), true);

  await sess.destroy();
});

t.test('Session::put() stores reference', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();

  const obj = { count: 0 };
  sess.put('ref', obj);

  // Changes to original should affect session
  obj.count = 5;
  t.equal(sess.get('ref').count, 5);

  await sess.destroy();
});

t.test('Session::pull() gets and removes value', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();

  sess.set('token', 'abc123');
  t.equal(sess.has('token'), true);

  const value = sess.pull('token');
  t.equal(value, 'abc123');
  t.equal(sess.has('token'), false);

  await sess.destroy();
});

t.test('Session::flush() persists data without closing', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();
  const id = sess.id;

  sess.set('key', 'flushed');
  await sess.flush();

  // Session should still be open
  t.equal(sess.opened, true);
  t.equal(sess.id, id);

  await sess.destroy();
});

t.test('Session::close() persists data and resets state', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();
  const id = sess.id;

  sess.set('persistent', 'data');
  await sess.close();

  t.equal(sess.opened, false);
  t.equal(sess._id, undefined);

  // Reopen and verify data persisted
  await sess.init(id);
  t.equal(sess.get('persistent'), 'data');
  await sess.destroy();
});

t.test('Session::destroy() removes session permanently', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();

  sess.set('key', 'value');
  await sess.destroy();

  t.equal(sess.opened, false);
  t.equal(sess._id, undefined);
});

t.test('Session::shouldBeOpened() throws when not opened', async t => {
  const sess = new Session(new SessionFileDriver);

  t.throws(() => {
    sess.shouldBeOpened();
  });
});

t.test('Session::shouldBeOpened() does not throw when opened', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();

  t.doesNotThrow(() => {
    sess.shouldBeOpened();
  });

  await sess.destroy();
});

t.test('Session::flash', async t => {
 // const staticID = 'sessidtest';
  const sess = new Session(new SessionFileDriver);
  await sess.init();
  t.type(sess.id, 'string');
  sess.flash('message', 'this is flash message!');
  t.notOk(sess.get('message'));


  const id = sess.id;
  await sess.close();
  await sess.init(id); // reopen
  t.equal(sess.get('message'), 'this is flash message!');

  const id2 = sess.id;
  await sess.close();
  await sess.init(id2); // reopen
  t.equal(sess.get('message'), undefined);
});