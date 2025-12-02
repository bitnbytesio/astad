import t from 'tap';
import { Conf } from './conf.js';

t.test('Conf::constructor with defaults', async t => {
  const conf = new Conf();
  t.ok(conf);
});

t.test('Conf::constructor with custom env', async t => {
  const conf = new Conf({ env: { KEY: 'value' }, mergeEnv: false });
  t.equal(conf.var('KEY'), 'value');
});

t.test('Conf::env() reads from process.env', async t => {
  process.env.TEST_CONF_KEY = 'test_value';
  const conf = new Conf();
  t.equal(conf.env('TEST_CONF_KEY'), 'test_value');
  delete process.env.TEST_CONF_KEY;
});

t.test('Conf::env() returns undefined for missing key', async t => {
  const conf = new Conf();
  t.equal(conf.env('NONEXISTENT_KEY_12345'), undefined);
});

t.test('Conf::var() returns local env value', async t => {
  const conf = new Conf({ env: { LOCAL_KEY: 'local_value' }, mergeEnv: false });
  t.equal(conf.var('LOCAL_KEY'), 'local_value');
});

t.test('Conf::var() falls back to process.env', async t => {
  process.env.FALLBACK_KEY = 'fallback_value';
  const conf = new Conf({ env: {}, mergeEnv: false });
  t.equal(conf.var('FALLBACK_KEY'), 'fallback_value');
  delete process.env.FALLBACK_KEY;
});

t.test('Conf::var() local env takes priority over process.env', async t => {
  process.env.PRIORITY_KEY = 'process_value';
  const conf = new Conf({ env: { PRIORITY_KEY: 'local_value' }, mergeEnv: false });
  t.equal(conf.var('PRIORITY_KEY'), 'local_value');
  delete process.env.PRIORITY_KEY;
});

t.test('Conf::dvar() returns value when exists', async t => {
  const conf = new Conf({ env: { DVAR_KEY: 'dvar_value' }, mergeEnv: false });
  t.equal(conf.dvar('DVAR_KEY', 'default'), 'dvar_value');
});

t.test('Conf::dvar() returns default when key missing', async t => {
  const conf = new Conf({ env: {}, mergeEnv: false });
  t.equal(conf.dvar('MISSING_KEY', 'default_value'), 'default_value');
});

t.test('Conf::dvar() falls back to process.env before default', async t => {
  process.env.DVAR_FALLBACK = 'process_value';
  const conf = new Conf({ env: {}, mergeEnv: false });
  t.equal(conf.dvar('DVAR_FALLBACK', 'default'), 'process_value');
  delete process.env.DVAR_FALLBACK;
});

t.test('Conf::setVar() sets local env variable', async t => {
  const conf = new Conf({ env: {}, mergeEnv: false });
  conf.setVar('NEW_KEY', 'new_value');
  t.equal(conf.var('NEW_KEY'), 'new_value');
});

t.test('Conf::set() and get() with values', async t => {
  const conf = new Conf();
  conf.set('key', 'value');
  t.equal(conf.get('key'), 'value');
});

t.test('Conf::get() returns default for missing key', async t => {
  const conf = new Conf();
  t.equal(conf.get('missing', 'default'), 'default');
});

t.test('Conf::get() returns null as default', async t => {
  const conf = new Conf();
  t.equal(conf.get('missing'), null);
});

t.test('Conf::set() and get() with objects', async t => {
  const conf = new Conf();
  const obj = { nested: { value: 123 } };
  conf.set('obj', obj);
  t.same(conf.get('obj'), obj);
});

t.test('Conf::set() and get() with number', async t => {
  const conf = new Conf();
  conf.set('num', 42);
  t.equal(conf.get('num'), 42);
});

// Bug detection tests
t.test('BUG: Conf::get() with falsy value 0 returns default', async t => {
  const conf = new Conf();
  conf.set('zero', 0);
  // This test documents the bug - get() uses || instead of ??
  // Expected: 0, Actual: 'default' (bug)
  t.equal(conf.get('zero', 'default'), 'default', 'BUG: returns default instead of 0');
});

t.test('BUG: Conf::get() with empty string returns default', async t => {
  const conf = new Conf();
  conf.set('empty', '');
  // This test documents the bug - get() uses || instead of ??
  // Expected: '', Actual: 'default' (bug)
  t.equal(conf.get('empty', 'default'), 'default', 'BUG: returns default instead of empty string');
});

t.test('BUG: Conf::get() with false returns default', async t => {
  const conf = new Conf();
  conf.set('bool', false);
  // This test documents the bug - get() uses || instead of ??
  // Expected: false, Actual: 'default' (bug)
  t.equal(conf.get('bool', 'default'), 'default', 'BUG: returns default instead of false');
});
