import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudget, NO_LIMITS, runWorkload } from '../public/cgroups.mjs';
import { WORKLOADS } from '../public/examples.mjs';

const BUDGET = createBudget(); // 256 MB, 250 ms/tick

test('polite-app completes inside the budget, unthrottled', () => {
  const r = runWorkload(WORKLOADS['polite-app'], BUDGET);
  assert.equal(r.verdict, 'completed');
  assert.equal(r.ticks, 8);
  assert.equal(r.memPeakMb, 240);
  assert.equal(r.throttled, false);
});

test('leaky-app is OOM-killed the tick its memory crosses the limit', () => {
  const r = runWorkload(WORKLOADS['leaky-app'], BUDGET);
  assert.equal(r.verdict, 'oom-killed');
  assert.equal(r.ticks, 4); // 40+60+80+100 = 280 > 256
  assert.equal(r.memPeakMb, 280);
  assert.ok(r.events.at(-1).oom);
});

test('cpu-hog is throttled: granted the quota, stretched over more ticks', () => {
  const r = runWorkload(WORKLOADS['cpu-hog'], BUDGET);
  assert.equal(r.verdict, 'throttled-completed');
  assert.equal(r.idealTicks, 5); // 2000 ms at the 400 ms/tick it wanted
  assert.equal(r.ticks, 8); // kernel grants 250 ms/tick
  assert.ok(r.events.every(e => e.cpuGrantedMs === 250));
  assert.ok(r.slowdown > 1);
});

test('no limits = host default: the leak is never stopped', () => {
  const r = runWorkload(WORKLOADS['leaky-app'], NO_LIMITS);
  assert.equal(r.verdict, 'completed'); // finishes its work, memory be damned
  assert.ok(r.memPeakMb > 256);
});

test('a bigger budget rescues the leak', () => {
  const r = runWorkload(WORKLOADS['leaky-app'], createBudget({ memLimitMb: 2048, cpuQuotaMsPerTick: 500 }));
  assert.notEqual(r.verdict, 'oom-killed');
});

test('workload that outruns maxTicks reports still-running', () => {
  const r = runWorkload({ name: 'endless', cpuWorkMs: 99999, cpuWantedPerTickMs: 100, memPerTickMb: 1, maxTicks: 5 }, NO_LIMITS);
  assert.equal(r.verdict, 'still-running');
  assert.equal(r.ticks, 5);
});
