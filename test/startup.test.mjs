import test from 'node:test';
import assert from 'node:assert/strict';
import { bootVm, startContainer, densityEstimate } from '../public/startup.mjs';

test('VM boot pays for an entire OS lifecycle', () => {
  const vm = bootVm();
  assert.ok(vm.timeline.length >= 5);
  assert.ok(vm.totalMs > 1000);
  // stages are contiguous: each starts where the previous ended
  vm.timeline.reduce((t, s) => { assert.equal(s.startsAt, t); return t + s.ms; }, 0);
});

test('container start is ~50 ms — clone + mount + exec, no boot', () => {
  const ctr = startContainer();
  assert.ok(ctr.totalMs <= 60);
  assert.equal(ctr.timeline[0].stage.includes('clone'), true);
  assert.equal(ctr.timeline.at(-1).stage.includes('execve'), true);
});

test('the container beats the VM by orders of magnitude, same timeline shape', () => {
  const vm = bootVm();
  const ctr = startContainer();
  assert.ok(vm.totalMs / ctr.totalMs >= 100);
});

test('density: containers fit ~4x more than VMs on the same host', () => {
  const d = densityEstimate();
  assert.equal(d.vms, 11); // 14336 / (1024+256)
  assert.equal(d.containers, 56); // 14336 / 256
  assert.ok(d.ratio > 4);
});
