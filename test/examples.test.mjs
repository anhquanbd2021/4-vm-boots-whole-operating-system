import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HOST_WORLD, WORKLOADS } from '../public/examples.mjs';

const read = name => JSON.parse(readFileSync(fileURLToPath(new URL(`../examples/${name}`, import.meta.url)), 'utf8'));

test('HOST_WORLD fixture matches examples/host-world.json', () => {
  assert.deepEqual(HOST_WORLD, read('host-world.json'));
});

test('workload fixtures match examples/*.json', () => {
  for (const name of Object.keys(WORKLOADS)) {
    assert.deepEqual(WORKLOADS[name], read(`${name}.json`));
  }
});
