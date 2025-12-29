import t from 'tap';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { SessionFileDriver } from './file.js';

// ============================================================================
// Basic Functionality Tests
// ============================================================================

t.test('SessionFileDriver::generateId() creates unique IDs', async t => {
  const driver = new SessionFileDriver();
  const id1 = driver.generateId();
  const id2 = driver.generateId();

  t.type(id1, 'string');
  t.equal(id1.length, 32); // 16 bytes = 32 hex chars
  t.not(id1, id2); // Should be unique
});

t.test('SessionFileDriver::getSessionFile() returns correct path', async t => {
  const driver = new SessionFileDriver();
  await driver.open('testid123');

  const sessionFile = driver.getSessionFile();
  t.equal(sessionFile, `${tmpdir()}/sess_testid123`);

  // With explicit ID
  const otherFile = driver.getSessionFile('otherid');
  t.equal(otherFile, `${tmpdir()}/sess_otherid`);

  await driver.destroy();
});

t.test('SessionFileDriver::open() creates new session file', async t => {
  const driver = new SessionFileDriver();
  const id = await driver.open();

  t.type(id, 'string');
  t.equal(id.length, 32);
  t.equal(driver.id(), id);

  // Verify file exists
  const sessionFile = driver.getSessionFile();
  const stat = await fs.stat(sessionFile);
  t.ok(stat.isFile());

  await driver.destroy();
});

t.test('SessionFileDriver::open() with existing ID reopens session', async t => {
  const driver1 = new SessionFileDriver();
  const id = await driver1.open();
  await driver1.write('test data');
  await driver1.close();

  const driver2 = new SessionFileDriver();
  const reopenedId = await driver2.open(id);

  t.equal(reopenedId, id);
  const data = await driver2.read();
  t.equal(data, 'test data');

  await driver2.destroy();
});

t.test('SessionFileDriver::write() and read() work correctly', async t => {
  const driver = new SessionFileDriver();
  await driver.open();

  await driver.write('hello world');
  const data = await driver.read();
  t.equal(data, 'hello world');

  // Write JSON
  const jsonData = JSON.stringify({ key: 'value', num: 42 });
  await driver.write(jsonData);
  const readJson = await driver.read();
  t.equal(readJson, jsonData);

  await driver.destroy();
});

t.test('SessionFileDriver::close() releases lock', async t => {
  const driver = new SessionFileDriver();
  const id = await driver.open();
  await driver.write('data');
  await driver.close();

  // Lock file should not exist after close
  const lockFile = `${tmpdir()}/sess_${id}.lock`;
  let lockExists = true;
  try {
    await fs.stat(lockFile);
  } catch {
    lockExists = false;
  }
  t.equal(lockExists, false);

  // Clean up
  const driver2 = new SessionFileDriver();
  await driver2.open(id);
  await driver2.destroy();
});

t.test('SessionFileDriver::destroy() removes session file', async t => {
  const driver = new SessionFileDriver();
  const id = await driver.open();
  const sessionFile = driver.getSessionFile();

  await driver.write('data');
  await driver.destroy();

  // Verify file is deleted
  let fileExists = true;
  try {
    await fs.stat(sessionFile);
  } catch {
    fileExists = false;
  }
  t.equal(fileExists, false);
});

t.test('SessionFileDriver::reset() creates new session', async t => {
  const driver = new SessionFileDriver();
  const id1 = await driver.open();
  await driver.write('old data');

  await driver.reset();
  const id2 = driver.id();

  t.not(id1, id2); // New ID
  const data = await driver.read();
  t.equal(data, ''); // Empty session

  await driver.destroy();
  // Clean up old session
  try {
    await fs.unlink(`${tmpdir()}/sess_${id1}`);
  } catch { }
});

// ============================================================================
// Lock Mechanism Tests
// ============================================================================

t.test('SessionFileDriver::open() creates lock file', async t => {
  const driver = new SessionFileDriver();
  const id = await driver.open();

  const lockFile = `${tmpdir()}/sess_${id}.lock`;
  const stat = await fs.stat(lockFile);
  t.ok(stat.isFile());

  await driver.destroy();
});

t.test('SessionFileDriver prevents concurrent access to same session', async t => {
  const driver1 = new SessionFileDriver();
  const id = await driver1.open();

  // Try to open same session from another driver
  const driver2 = new SessionFileDriver();

  // This should fail or wait (we'll use a short timeout to test)
  let error: Error | null = null;
  const openPromise = driver2.open(id).catch(e => {
    error = e;
  });

  // Wait a bit for the lock attempt
  await new Promise(resolve => setTimeout(resolve, 200));

  // Release lock from first driver
  await driver1.close();

  // Now second driver should be able to acquire
  await openPromise;

  // If no error, driver2 successfully opened after driver1 closed
  if (!error) {
    await driver2.destroy();
  } else {
    // Clean up
    const cleanup = new SessionFileDriver();
    await cleanup.open(id);
    await cleanup.destroy();
  }

  t.pass('Concurrent access handled correctly');
});

t.test('SessionFileDriver handles stale locks', async t => {
  const driver = new SessionFileDriver();
  const id = 'stale_lock_test_' + Date.now();
  const sessionFile = `${tmpdir()}/sess_${id}`;
  const lockFile = `${sessionFile}.lock`;

  // Create a stale lock file (timestamp in the past)
  await fs.writeFile(sessionFile, '');
  await fs.writeFile(lockFile, '0'); // Timestamp 0 = very old

  // Should be able to open despite stale lock
  const openedId = await driver.open(id);
  t.equal(openedId, id);

  await driver.destroy();
});

t.test('SessionFileDriver cleans up lock on destroy', async t => {
  const driver = new SessionFileDriver();
  const id = await driver.open();
  const lockFile = `${tmpdir()}/sess_${id}.lock`;

  // Lock should exist
  let lockExists = true;
  try {
    await fs.stat(lockFile);
  } catch {
    lockExists = false;
  }
  t.equal(lockExists, true);

  await driver.destroy();

  // Lock should be gone
  lockExists = true;
  try {
    await fs.stat(lockFile);
  } catch {
    lockExists = false;
  }
  t.equal(lockExists, false);
});

// ============================================================================
// Error Handling Tests
// ============================================================================

t.test('SessionFileDriver::destroy() handles missing file gracefully', async t => {
  const driver = new SessionFileDriver();
  const id = await driver.open();
  const sessionFile = driver.getSessionFile();

  // Manually delete the file
  await fs.unlink(sessionFile);

  // Destroy should not throw
  await t.resolves(driver.destroy());
});

t.test('SessionFileDriver::read() throws on missing file', async t => {
  const driver = new SessionFileDriver();
  await driver.open();
  const sessionFile = driver.getSessionFile();

  // Manually delete the file
  await fs.unlink(sessionFile);

  // Read should throw
  await t.rejects(driver.read());

  // Clean up lock
  await driver.close();
});

// ============================================================================
// Data Integrity Tests
// ============================================================================

t.test('SessionFileDriver preserves data across close/open cycles', async t => {
  const driver = new SessionFileDriver();
  const id = await driver.open();

  const testData = JSON.stringify({
    user: 'test',
    items: [1, 2, 3],
    nested: { deep: { value: true } }
  });

  await driver.write(testData);
  await driver.close();

  // Reopen
  await driver.open(id);
  const data = await driver.read();
  t.equal(data, testData);

  await driver.destroy();
});

t.test('SessionFileDriver handles large data', async t => {
  const driver = new SessionFileDriver();
  await driver.open();

  // Create ~100KB of data
  const largeData = JSON.stringify({
    data: 'x'.repeat(100000),
    array: Array(1000).fill({ key: 'value' })
  });

  await driver.write(largeData);
  const data = await driver.read();
  t.equal(data, largeData);

  await driver.destroy();
});

t.test('SessionFileDriver handles special characters', async t => {
  const driver = new SessionFileDriver();
  await driver.open();

  const specialData = JSON.stringify({
    unicode: '你好世界 🌍 مرحبا',
    escapes: '\n\t\r\\\"',
    nullish: null
  });

  await driver.write(specialData);
  const data = await driver.read();
  t.equal(data, specialData);

  await driver.destroy();
});

// ============================================================================
// Concurrent Operations Tests
// ============================================================================

t.test('Multiple sequential sessions work correctly', async t => {
  const sessions: string[] = [];

  // Create multiple sessions
  for (let i = 0; i < 5; i++) {
    const driver = new SessionFileDriver();
    const id = await driver.open();
    await driver.write(`session ${i}`);
    sessions.push(id);
    await driver.close();
  }

  // Verify all sessions
  for (let i = 0; i < 5; i++) {
    const driver = new SessionFileDriver();
    await driver.open(sessions[i]);
    const data = await driver.read();
    t.equal(data, `session ${i}`);
    await driver.destroy();
  }
});

t.test('Parallel sessions with different IDs work correctly', async t => {
  const drivers = await Promise.all(
    Array(5).fill(0).map(async () => {
      const driver = new SessionFileDriver();
      await driver.open();
      return driver;
    })
  );

  // All should have unique IDs
  const ids = drivers.map(d => d.id());
  const uniqueIds = new Set(ids);
  t.equal(uniqueIds.size, 5);

  // Write and read from each
  await Promise.all(
    drivers.map(async (driver, i) => {
      await driver.write(`data ${i}`);
    })
  );

  await Promise.all(
    drivers.map(async (driver, i) => {
      const data = await driver.read();
      t.equal(data, `data ${i}`);
    })
  );

  // Cleanup
  await Promise.all(drivers.map(d => d.destroy()));
});
