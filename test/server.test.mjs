import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticServer } from '../app/server.js';
import { once } from 'node:events';

async function withServer(fn) {
  const server = createStaticServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

test('/health and /version respond; static allowlist served; unknown paths 404', async () => {
  await withServer(async base => {
    assert.equal(await (await fetch(`${base}/health`)).text(), 'ok');
    const ver = await (await fetch(`${base}/version`)).json();
    assert.ok(ver.name.includes('isolation'));
    for (const p of ['/', '/guide.html', '/app.js', '/namespaces.mjs', '/cgroups.mjs', '/startup.mjs', '/examples.mjs']) {
      assert.equal((await fetch(base + p)).status, 200, p);
    }
    for (const p of ['/package.json', '/../app/server.js', '/examples/host-world.json', '/nope']) {
      assert.equal((await fetch(encodeURI(base + p))).status, 404, p);
    }
  });
});

test('security headers are set on every response', async () => {
  await withServer(async base => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('content-security-policy').includes("default-src 'self'"));
  });
});
