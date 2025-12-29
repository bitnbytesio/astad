import t from 'tap';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';

import { HttpAsset, HttpAssetMiddleware, GuessMimeFn } from './asset.js';
import { GuessMime } from './mime.js';

// Test fixtures directory
const FIXTURES_DIR = path.join(os.tmpdir(), 'astad-asset-test-' + Date.now());

// Mock context for testing
function createMockContext(overrides: Partial<{
  path: string;
  method: string;
  requestHeaders: Record<string, string>;
}> = {}) {
  const responseHeaders: Record<string, string> = {};
  const requestHeaders = overrides.requestHeaders || {};
  let response: any = { status: 404, body: '', headers: {} };

  return {
    path: overrides.path || '/',
    method: overrides.method || 'GET',
    headers: {
      get: (key: string) => requestHeaders[key.toLowerCase()] || responseHeaders[key.toLowerCase()],
      set: (key: string, value: string) => { responseHeaders[key.toLowerCase()] = value; },
    },
    response,
    reply: (res: any) => {
      response = res;
      return res;
    },
    abort: (status: number) => {
      response = { status, body: '' };
    },
    getResponse: () => response,
    getResponseHeaders: () => responseHeaders,
  };
}

// Setup and teardown
t.before(async () => {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });
  await fs.writeFile(path.join(FIXTURES_DIR, 'test.txt'), 'Hello, World!');
  await fs.writeFile(path.join(FIXTURES_DIR, 'style.css'), 'body { color: red; }');
  await fs.writeFile(path.join(FIXTURES_DIR, 'app.js'), 'console.log("hello");');
  await fs.writeFile(path.join(FIXTURES_DIR, 'app.mjs'), 'export default {};');
  await fs.writeFile(path.join(FIXTURES_DIR, 'data.json'), '{"key": "value"}');
  await fs.writeFile(path.join(FIXTURES_DIR, 'image.png'), Buffer.from([0x89, 0x50, 0x4E, 0x47]));
  await fs.mkdir(path.join(FIXTURES_DIR, 'subdir'), { recursive: true });
  await fs.writeFile(path.join(FIXTURES_DIR, 'subdir', 'nested.txt'), 'Nested file');
});

t.teardown(async () => {
  await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
});

// ============================================================================
// GuessMime Tests
// ============================================================================

t.test('GuessMime returns correct MIME types', async t => {
  t.equal(GuessMime('file.js'), 'text/javascript');
  t.equal(GuessMime('file.mjs'), 'text/javascript');
  t.equal(GuessMime('file.css'), 'text/css');
  t.equal(GuessMime('file.html'), 'text/html');
  t.equal(GuessMime('file.json'), 'application/json');
  t.equal(GuessMime('file.png'), 'image/png');
  t.equal(GuessMime('file.jpg'), 'image/jpeg');
  t.equal(GuessMime('file.svg'), 'image/svg+xml');
  t.equal(GuessMime('file.pdf'), 'application/pdf');
  t.equal(GuessMime('file.woff2'), 'font/woff2');
});

t.test('GuessMime returns default for unknown extensions', async t => {
  t.equal(GuessMime('file.unknown'), 'application/octet-stream');
  t.equal(GuessMime('file.xyz'), 'application/octet-stream');
  t.equal(GuessMime('noextension'), 'application/octet-stream');
});

t.test('GuessMime uses custom map when provided', async t => {
  const customMap = { '.custom': 'application/custom' };
  t.equal(GuessMime('file.custom', customMap), 'application/custom');
  // Custom map takes precedence
  t.equal(GuessMime('file.js', { '.js': 'custom/js' }), 'custom/js');
});

// ============================================================================
// HttpAsset Tests
// ============================================================================

t.test('HttpAsset::constructor validates prefix', async t => {
  // Valid prefix
  t.doesNotThrow(() => {
    new HttpAsset({
      root: FIXTURES_DIR,
      files: [],
      prefix: '/assets',
      cache: false,
      debug: false,
    });
  });

  // Missing leading slash
  t.throws(() => {
    new HttpAsset({
      root: FIXTURES_DIR,
      files: [],
      prefix: 'assets',
      cache: false,
      debug: false,
    });
  }, /should start with/);

  // Trailing slash
  t.throws(() => {
    new HttpAsset({
      root: FIXTURES_DIR,
      files: [],
      prefix: '/assets/',
      cache: false,
      debug: false,
    });
  }, /should not have trailing/);
});

t.test('HttpAsset::info returns file info', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: false,
  });

  const info = await asset.info(path.join(FIXTURES_DIR, 'test.txt'));
  t.ok(info);
  t.equal(info!.mime, 'text/plain');
  t.equal(info!.size, 13); // "Hello, World!" = 13 bytes
  t.type(info!.modified, Date);
  t.type(info!.checksome, 'string');
});

t.test('HttpAsset::info returns null for non-existent file', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: false,
  });

  const info = await asset.info(path.join(FIXTURES_DIR, 'nonexistent.txt'));
  t.equal(info, null);
});

t.test('HttpAsset::info caches file info', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: false,
  });

  const filePath = path.join(FIXTURES_DIR, 'test.txt');
  const info1 = await asset.info(filePath);
  const info2 = await asset.info(filePath);

  // Should be the same reference (cached)
  t.equal(info1, info2);
});

t.test('HttpAsset::info uses custom guessMime function', async t => {
  const customMime: GuessMimeFn = (source) => {
    if (source.endsWith('.txt')) return 'custom/text';
    return GuessMime(source);
  };

  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: false,
    guessMime: customMime,
  });

  const info = await asset.info(path.join(FIXTURES_DIR, 'test.txt'));
  t.ok(info);
  t.equal(info!.mime, 'custom/text');
});

t.test('HttpAsset::file serves file with correct MIME type', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: true,
  });

  const ctx = createMockContext({ path: '/assets/test.txt' });
  await asset.file(ctx as any, { path: 'test.txt' });

  const response = ctx.getResponse();
  t.equal(response.status, 200);
  t.equal(response.headers['content-type'], 'text/plain');
});

t.test('HttpAsset::file returns 404 for non-existent file', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: false,
  });

  const ctx = createMockContext({ path: '/assets/nonexistent.txt' });
  await asset.file(ctx as any, { path: 'nonexistent.txt' });

  const response = ctx.getResponse();
  t.equal(response.status, 404);
});

t.test('HttpAsset::file respects custom mime in file object', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: true,
  });

  const ctx = createMockContext({ path: '/assets/test.txt' });
  await asset.file(ctx as any, { path: 'test.txt', mime: 'custom/mime' });

  const response = ctx.getResponse();
  t.equal(response.headers['content-type'], 'custom/mime');
});

t.test('HttpAsset::file sets ETag when not in debug mode', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: false,
  });

  const ctx = createMockContext({ path: '/assets/test.txt' });
  await asset.file(ctx as any, { path: 'test.txt' });

  const headers = ctx.getResponseHeaders();
  t.ok(headers['etag']);
  t.ok(headers['content-length']);
});

t.test('HttpAsset::file returns 304 when ETag matches', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: true,
    debug: false,
  });

  // First request to get ETag
  const ctx1 = createMockContext({ path: '/assets/test.txt' });
  await asset.file(ctx1 as any, { path: 'test.txt' });
  const etag = ctx1.getResponseHeaders()['etag'];

  // Second request with If-None-Match
  const ctx2 = createMockContext({
    path: '/assets/test.txt',
    requestHeaders: { 'if-none-match': etag },
  });
  await asset.file(ctx2 as any, { path: 'test.txt' });

  t.equal(ctx2.getResponse().status, 304);
});

t.test('HttpAsset::file sets Cache-Control when caching enabled', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: true,
    debug: false,
  });

  const ctx = createMockContext({ path: '/assets/test.txt' });
  await asset.file(ctx as any, { path: 'test.txt' });

  const headers = ctx.getResponseHeaders();
  t.ok(headers['cache-control']);
  t.match(headers['cache-control'], /max-age=/);
});

t.test('HttpAsset::file handles HEAD requests', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: true,
  });

  const ctx = createMockContext({ path: '/assets/test.txt', method: 'HEAD' });
  await asset.file(ctx as any, { path: 'test.txt' });

  const response = ctx.getResponse();
  t.equal(response.status, 200);
  t.equal(response.body, '');
});

t.test('HttpAsset::css sets correct MIME type', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: true,
  });

  const ctx = createMockContext();
  await asset.css(ctx as any, 'style.css');

  const response = ctx.getResponse();
  t.equal(response.headers['content-type'], 'text/css');
});

t.test('HttpAsset::js sets correct MIME type', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: true,
  });

  const ctx = createMockContext();
  await asset.js(ctx as any, 'app.js');

  const response = ctx.getResponse();
  t.equal(response.headers['content-type'], 'text/javascript');
});

t.test('HttpAsset::image sets correct MIME type', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: true,
  });

  const ctx = createMockContext();
  await asset.image(ctx as any, 'image.png', 'png');

  const response = ctx.getResponse();
  t.equal(response.headers['content-type'], 'image/png');
});

t.test('HttpAsset::hasAsset returns true for existing file', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: false,
  });

  t.equal(await asset.hasAsset('test.txt'), true);
  t.equal(await asset.hasAsset('nonexistent.txt'), false);
});

t.test('HttpAsset::streamOptions parses range header', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: false,
    allowRange: true,
  });

  // Test standard range: bytes=start-end
  const ctx1 = createMockContext({
    requestHeaders: { 'range': 'bytes=0-100' },
  });
  const options1 = asset.streamOptions(ctx1 as any);
  t.equal(options1.start, 0);
  t.equal(options1.end, 100);

  // Test range: bytes=200-999
  const ctx2 = createMockContext({
    requestHeaders: { 'range': 'bytes=200-999' },
  });
  const options2 = asset.streamOptions(ctx2 as any);
  t.equal(options2.start, 200);
  t.equal(options2.end, 999);

  // Test open-ended range: bytes=200- (from 200 to end of file)
  const ctx3 = createMockContext({
    requestHeaders: { 'range': 'bytes=200-' },
  });
  const options3 = asset.streamOptions(ctx3 as any);
  t.equal(options3.start, 200);
  t.equal(options3.end, undefined); // No end specified

  // Test suffix range: bytes=-500 (last 500 bytes)
  // Note: suffix ranges require file size calculation, not directly supported
  const ctx4 = createMockContext({
    requestHeaders: { 'range': 'bytes=-500' },
  });
  const options4 = asset.streamOptions(ctx4 as any);
  t.equal(options4.start, undefined); // Empty start
  t.equal(options4.end, 500); // End is set but semantically incorrect without file size
});

t.test('HttpAsset::streamOptions ignores range when not enabled', async t => {
  const asset = new HttpAsset({
    root: FIXTURES_DIR,
    files: [],
    prefix: '/assets',
    cache: false,
    debug: false,
    allowRange: false,
  });

  const ctx = createMockContext({
    requestHeaders: { 'range': 'bytes=0-100' },
  });
  const options = asset.streamOptions(ctx as any);
  t.equal(options.start, undefined);
  t.equal(options.end, undefined);
});

// ============================================================================
// HttpAssetMiddleware Tests
// ============================================================================

t.test('HttpAssetMiddleware::handle serves files on 404', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  const ctx = createMockContext({ path: '/test.txt' });
  let nextCalled = false;
  await middleware.handle(ctx as any, async () => { nextCalled = true; });

  t.equal(nextCalled, true);
  const response = ctx.getResponse();
  t.equal(response.status, 200);
  t.equal(response.headers['content-type'], 'text/plain');
});

t.test('HttpAssetMiddleware::handle respects prefix', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/static/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  // Request with matching prefix
  const ctx1 = createMockContext({ path: '/static/test.txt' });
  await middleware.handle(ctx1 as any, async () => { });
  t.equal(ctx1.getResponse().status, 200);

  // Request without matching prefix (should stay 404)
  const ctx2 = createMockContext({ path: '/other/test.txt' });
  await middleware.handle(ctx2 as any, async () => { });
  t.equal(ctx2.getResponse().status, 404);
});

t.test('HttpAssetMiddleware::handle serves index file', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    index: 'test.txt',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  const ctx = createMockContext({ path: '/' });
  await middleware.handle(ctx as any, async () => { });

  t.equal(ctx.getResponse().status, 200);
});

t.test('HttpAssetMiddleware::handle skips non-GET/HEAD requests', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  const ctx = createMockContext({ path: '/test.txt', method: 'POST' });
  await middleware.handle(ctx as any, async () => { });

  // Should remain 404 since POST is not handled
  t.equal(ctx.getResponse().status, 404);
});

t.test('HttpAssetMiddleware::handle skips if response is not 404', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  const ctx = createMockContext({ path: '/test.txt' });
  ctx.response.status = 200; // Simulate already handled
  await middleware.handle(ctx as any, async () => { });

  // Should not change the response
  t.equal(ctx.response.status, 200);
});

t.test('HttpAssetMiddleware uses custom guessMime function', async t => {
  const customMime: GuessMimeFn = (source) => {
    if (source.endsWith('.txt')) return 'custom/text';
    return GuessMime(source);
  };

  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
    guessMime: customMime,
  });

  const ctx = createMockContext({ path: '/test.txt' });
  await middleware.handle(ctx as any, async () => { });

  t.equal(ctx.getResponse().headers['content-type'], 'custom/text');
});

// ============================================================================
// Security Tests
// ============================================================================

t.test('HttpAssetMiddleware blocks path traversal with ../', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  const ctx = createMockContext({ path: '/../../../etc/passwd' });
  await middleware.handle(ctx as any, async () => { });

  // Should not serve the file
  t.equal(ctx.getResponse().status, 404);
});

t.test('HttpAssetMiddleware blocks path traversal with encoded ../', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  // URL-encoded ../
  const ctx = createMockContext({ path: '/%2e%2e/%2e%2e/etc/passwd' });
  await middleware.handle(ctx as any, async () => { });

  t.equal(ctx.getResponse().status, 404);
});

t.test('HttpAssetMiddleware blocks absolute paths', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  const ctx = createMockContext({ path: '/etc/passwd' });
  await middleware.handle(ctx as any, async () => { });

  // This file doesn't exist in FIXTURES_DIR, so 404
  t.equal(ctx.getResponse().status, 404);
});

t.test('HttpAssetMiddleware blocks null byte injection', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  const ctx = createMockContext({ path: '/test.txt\0.jpg' });
  await middleware.handle(ctx as any, async () => { });

  // pathsafe should reject null bytes
  t.equal(ctx.getResponse().status, 404);
});

t.test('HttpAssetMiddleware serves nested files safely', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  const ctx = createMockContext({ path: '/subdir/nested.txt' });
  await middleware.handle(ctx as any, async () => { });

  t.equal(ctx.getResponse().status, 200);
  t.equal(ctx.getResponse().headers['content-type'], 'text/plain');
});

// ============================================================================
// Static Method Tests
// ============================================================================

t.test('HttpAssetMiddleware.middleware returns bound handler', async t => {
  const handler = HttpAssetMiddleware.middleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  t.type(handler, 'function');
});

// ============================================================================
// Cache Limit Tests
// ============================================================================

t.test('HttpAssetMiddleware uses default maxCacheEntries', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  t.equal(middleware.opts.maxCacheEntries, 1000);
});

t.test('HttpAssetMiddleware respects custom maxCacheEntries', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
    maxCacheEntries: 50,
  });

  t.equal(middleware.opts.maxCacheEntries, 50);
});

t.test('HttpAssetMiddleware cache evicts oldest entries when limit reached', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
    maxCacheEntries: 3,
  });

  // Request 3 different files to fill cache
  const files = ['test.txt', 'style.css', 'app.js'];
  for (const file of files) {
    const ctx = createMockContext({ path: `/${file}` });
    await middleware.handle(ctx as any, async () => { });
    t.equal(ctx.getResponse().status, 200);
  }

  // All 3 should be in cache
  t.equal(Object.keys(middleware.store).length, 3);

  // Request a 4th file - should evict the oldest (test.txt)
  const ctx4 = createMockContext({ path: '/data.json' });
  await middleware.handle(ctx4 as any, async () => { });
  t.equal(ctx4.getResponse().status, 200);

  // Cache should still have 3 entries
  t.equal(Object.keys(middleware.store).length, 3);

  // The oldest entry (test.txt) should be evicted
  const testTxtPath = path.join(FIXTURES_DIR, 'test.txt');
  t.equal(middleware.store[testTxtPath], undefined);
});

t.test('HttpAssetMiddleware cache does not evict when accessing same file', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
    maxCacheEntries: 2,
  });

  // Request same file multiple times
  for (let i = 0; i < 5; i++) {
    const ctx = createMockContext({ path: '/test.txt' });
    await middleware.handle(ctx as any, async () => { });
    t.equal(ctx.getResponse().status, 200);
  }

  // Should only have 1 entry in cache
  t.equal(Object.keys(middleware.store).length, 1);
});

t.test('HttpAssetMiddleware cache returns cached info on subsequent requests', async t => {
  const middleware = new HttpAssetMiddleware({
    root: FIXTURES_DIR,
    prefix: '/',
    debug: true,
    cache: false,
    maxAgeSeconds: 60,
  });

  // First request - populates cache
  const ctx1 = createMockContext({ path: '/test.txt' });
  await middleware.handle(ctx1 as any, async () => { });
  t.equal(ctx1.getResponse().status, 200);

  const testTxtPath = path.join(FIXTURES_DIR, 'test.txt');
  const cachedInfo = middleware.store[testTxtPath];
  t.ok(cachedInfo);
  t.equal(cachedInfo.mime, 'text/plain');

  // Second request - should use cache
  const ctx2 = createMockContext({ path: '/test.txt' });
  await middleware.handle(ctx2 as any, async () => { });
  t.equal(ctx2.getResponse().status, 200);

  // Should be same cached object
  t.equal(middleware.store[testTxtPath], cachedInfo);
});
