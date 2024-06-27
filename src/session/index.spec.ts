import t from 'tap';

import { Session } from './index.js';
import { SessionFileDriver } from './file.js';

t.test('Session::test', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();
  t.type(sess.id, 'string');
  sess.set('key', 'value');
  t.equal(sess.get('key'), 'value');

  sess.set('object', { value: 'value' });
  t.match(sess.get('object'), { value: 'value' });

  await sess.close();
  t.type(sess.id, 'undefined');
  await sess.init();
  t.type(sess.id, 'string');
  t.notOk(sess.get('key'));
  sess.set('key', 'value2');
  t.equal(sess.get('key'), 'value2');

  const id = sess.id;
  await sess.close();
  await sess.init(id); // reopen
  sess.set('key', 'value2');
  t.equal(sess.get('key'), 'value2');
});


t.test('Session::flash', async t => {
  const sess = new Session(new SessionFileDriver);
  await sess.init();
  t.type(sess.id, 'string');
  sess.flash('message', 'this is flash message!');
  t.notOk(sess.get('message'));


  const id = sess.id;
  await sess.close();
  await sess.init(id); // reopen
  t.equal(sess.get('message'), 'this is flash message!');
});