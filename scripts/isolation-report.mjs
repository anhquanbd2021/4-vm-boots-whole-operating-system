// CLI side-by-side report: masked vs unmasked view, budgeted vs unlimited
// workload, VM boot vs container start. Hard asserts at the end.
import { ALL_NAMESPACES, NO_NAMESPACES, applyNamespaces, viewDiff } from '../public/namespaces.mjs';
import { createBudget, NO_LIMITS, runWorkload } from '../public/cgroups.mjs';
import { bootVm, startContainer, densityEstimate } from '../public/startup.mjs';
import { HOST_WORLD, WORKLOADS } from '../public/examples.mjs';

const line = (s = '') => console.log(s);

line('=== Isolation Under Glass — report ===');
line();

line('-- namespaces: view of container "web" --');
for (const [name, flags] of [['host (no namespaces)', NO_NAMESPACES], ['container (all six)', ALL_NAMESPACES]]) {
  const view = applyNamespaces(HOST_WORLD, flags, 'web');
  const diff = viewDiff(HOST_WORLD, view);
  const hidden = diff.processes + diff.files + diff.interfaces + diff.ipcSegments;
  line(`  ${name.padEnd(26)} procs=${view.processes.length} paths=${view.filesystem.length} ifaces=${view.interfaces.length} ipc=${view.ipcSegments.length} host=${view.hostname} uid0→${view.uid.onHost} masked=${hidden}`);
}
line();

line('-- cgroups: workloads under budget { memLimitMb: 256, cpuQuotaMsPerTick: 250 } --');
const budget = createBudget();
for (const wl of Object.values(WORKLOADS)) {
  const r = runWorkload(wl, budget);
  const free = runWorkload(wl, NO_LIMITS);
  line(`  ${wl.name.padEnd(12)} budgeted: ${r.verdict.padEnd(20)} ticks=${r.ticks} ideal=${r.idealTicks} peakMem=${r.memPeakMb}MB | unlimited: ${free.verdict}`);
}
line();

line('-- startup: VM vs container --');
const vm = bootVm();
const ctr = startContainer();
for (const s of vm.timeline) line(`  VM   ${s.stage.padEnd(44)} ${s.ms} ms`);
line(`  VM total: ${vm.totalMs} ms`);
for (const s of ctr.timeline) line(`  CTR  ${s.stage.padEnd(44)} ${s.ms} ms`);
line(`  CTR total: ${ctr.totalMs} ms (${(vm.totalMs / ctr.totalMs).toFixed(0)}× faster)`);
line();
const d = densityEstimate();
line(`-- density on 16 GB host: ${d.vms} VMs vs ${d.containers} containers (${d.ratio.toFixed(0)}×)`);

// hard asserts — the report fails loudly if the model regresses
const masked = applyNamespaces(HOST_WORLD, ALL_NAMESPACES, 'web');
const raw = applyNamespaces(HOST_WORLD, NO_NAMESPACES, 'web');
if (masked.processes[0].pid !== 1) throw new Error('pid ns: container init must see itself as PID 1');
if (raw.processes.length !== HOST_WORLD.processes.length) throw new Error('unmasked view must equal host');
if (!applyNamespaces(HOST_WORLD, { ...ALL_NAMESPACES, user: false }, 'web').uid.rootIsHostRoot)
  throw new Error('user ns off must leave root as host root');
if (runWorkload(WORKLOADS['leaky-app'], budget).verdict !== 'oom-killed') throw new Error('leaky-app must OOM');
if (runWorkload(WORKLOADS['cpu-hog'], budget).verdict !== 'throttled-completed') throw new Error('cpu-hog must throttle');
if (ctr.totalMs >= vm.totalMs) throw new Error('container must beat VM boot');
line();
line('all assertions passed');
