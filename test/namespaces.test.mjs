import test from 'node:test';
import assert from 'node:assert/strict';
import { NAMESPACE_TYPES, ALL_NAMESPACES, NO_NAMESPACES, applyNamespaces, viewDiff } from '../public/namespaces.mjs';
import { HOST_WORLD } from '../public/examples.mjs';

test('all six namespace types are modelled', () => {
  assert.deepEqual(NAMESPACE_TYPES.map(n => n.id), ['pid', 'mnt', 'net', 'uts', 'ipc', 'user']);
});

test('no namespaces = the raw host view', () => {
  const view = applyNamespaces(HOST_WORLD, NO_NAMESPACES, 'web');
  assert.equal(view.processes.length, HOST_WORLD.processes.length);
  assert.equal(view.filesystem.length, HOST_WORLD.filesystem.length);
  assert.equal(view.hostname, 'prod-host-01');
  assert.ok(view.uid.rootIsHostRoot);
});

test('pid namespace: container init sees itself as PID 1', () => {
  const view = applyNamespaces(HOST_WORLD, { ...NO_NAMESPACES, pid: true }, 'web');
  assert.equal(view.processes.length, 2); // init + worker, not the other 8 host procs
  assert.equal(view.processes[0].pid, 1);
  assert.equal(view.processes[0].name, 'node /app/server.js');
  assert.equal(view.processes[1].ppid, 1);
  assert.ok(view.processes.every(p => p.pid <= 2));
});

test('mount namespace: image directory becomes /', () => {
  const view = applyNamespaces(HOST_WORLD, { ...NO_NAMESPACES, mnt: true }, 'web');
  assert.ok(view.filesystem.includes('/app.js'));
  assert.ok(!view.filesystem.some(p => p.includes('home/ops') || p.includes('postgres')));
});

test('net namespace: only loopback + own veth survive', () => {
  const view = applyNamespaces(HOST_WORLD, { ...NO_NAMESPACES, net: true }, 'web');
  assert.deepEqual(view.interfaces.map(i => i.name).sort(), ['lo', 'veth-a1b2']);
});

test('uts + ipc namespaces: own hostname, own segments only', () => {
  const view = applyNamespaces(HOST_WORLD, { ...NO_NAMESPACES, uts: true, ipc: true }, 'web');
  assert.equal(view.hostname, 'web-ctr');
  assert.deepEqual(view.ipcSegments.map(s => s.id), ['shm-c1']);
});

test('user namespace: container root maps to an unprivileged host uid', () => {
  const on = applyNamespaces(HOST_WORLD, { ...NO_NAMESPACES, user: true }, 'web');
  assert.equal(on.uid.inside, 0);
  assert.equal(on.uid.onHost, 100000);
  assert.equal(on.uid.rootIsHostRoot, false);
  const off = applyNamespaces(HOST_WORLD, ALL_NAMESPACES, 'web');
  assert.equal(off.uid.rootIsHostRoot, false);
  const dangerous = applyNamespaces(HOST_WORLD, { ...ALL_NAMESPACES, user: false }, 'web');
  assert.ok(dangerous.uid.rootIsHostRoot);
});

test('viewDiff counts the masked objects', () => {
  const view = applyNamespaces(HOST_WORLD, ALL_NAMESPACES, 'web');
  const diff = viewDiff(HOST_WORLD, view);
  assert.equal(diff.processes, HOST_WORLD.processes.length - 2);
  assert.equal(diff.files, HOST_WORLD.filesystem.length - 3);
  assert.ok(diff.hostnameChanged);
  assert.ok(diff.rootDemoted);
});
