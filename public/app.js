import { NAMESPACE_TYPES, ALL_NAMESPACES, applyNamespaces, viewDiff } from '/namespaces.mjs';
import { createBudget, NO_LIMITS, runWorkload } from '/cgroups.mjs';
import { bootVm, startContainer, densityEstimate } from '/startup.mjs';
import { HOST_WORLD, WORKLOADS } from '/examples.mjs';

const $ = id => document.getElementById(id);
const flags = { ...ALL_NAMESPACES };

function log(msg) {
  const li = document.createElement('li');
  li.innerHTML = msg;
  $('log').prepend(li);
}

/* ---------- Lab 1: namespace mask ---------- */

function renderToggles() {
  const host = $('ns-toggles');
  host.innerHTML = '';
  for (const ns of NAMESPACE_TYPES) {
    const label = document.createElement('label');
    label.className = 'check';
    label.innerHTML = `<input type="checkbox" data-ns="${ns.id}" ${flags[ns.id] ? 'checked' : ''}> <strong>${ns.label}</strong> <span class="muted">— hides ${ns.hides}</span>`;
    host.append(label);
  }
  host.onchange = e => {
    const ns = e.target.dataset.ns;
    if (!ns) return;
    flags[ns] = e.target.checked;
    renderView();
    log(`<code>${ns}</code> namespace ${flags[ns] ? '<strong>on</strong> — mask applied' : '<strong>off</strong> — that part of the host is visible'}`);
  };
}

function fillList(el, items, fmt) {
  el.innerHTML = '';
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = fmt(item);
    el.append(li);
  }
}

function renderView() {
  const view = applyNamespaces(HOST_WORLD, flags, 'web');
  const diff = viewDiff(HOST_WORLD, view);
  $('v-hostname').textContent = view.hostname;
  $('v-uid').textContent = `uid ${view.uid.inside} inside → uid ${view.uid.onHost} on host`;
  $('ns-warning').hidden = !view.uid.rootIsHostRoot;
  $('c-pid').textContent = `${view.processes.length} visible`;
  $('c-mnt').textContent = `${view.filesystem.length} paths`;
  $('c-net').textContent = `${view.interfaces.length} ifaces`;
  $('c-ipc').textContent = `${view.ipcSegments.length} segs`;
  const hiddenTotal = diff.processes + diff.files + diff.interfaces + diff.ipcSegments;
  $('ns-hidden').textContent = hiddenTotal ? `${hiddenTotal} host objects masked` : 'nothing masked — this is the host view';
  fillList($('v-procs'), view.processes, p => `pid ${p.pid} ← ${p.ppid}  ${p.name} (uid ${p.uid})`);
  fillList($('v-fs'), view.filesystem, p => p);
  fillList($('v-net'), view.interfaces, i => `${i.name}  ${i.addr}`);
  fillList($('v-ipc'), view.ipcSegments, s => `${s.id} (${s.owner})`);
}

/* ---------- Lab 2: cgroup leash ---------- */

function renderWorkloads() {
  const sel = $('workload');
  for (const name of Object.keys(WORKLOADS)) {
    const opt = document.createElement('option');
    opt.value = opt.textContent = name;
    sel.append(opt);
  }
}

function runCgroupLab() {
  const wl = WORKLOADS[$('workload').value];
  const budget = $('no-limits').checked
    ? NO_LIMITS
    : createBudget({ memLimitMb: Number($('mem-limit').value), cpuQuotaMsPerTick: Number($('cpu-quota').value) });
  const result = runWorkload(wl, budget);
  const body = $('cg-body');
  body.innerHTML = '';
  for (const e of result.events) {
    const tr = document.createElement('tr');
    const note = e.oom ? 'OOM-killed' : (e.cpuGrantedMs < e.cpuWantedMs ? 'throttled' : '');
    if (e.oom) tr.className = 'danger-row';
    tr.innerHTML = `<td>${e.tick}</td><td>${e.memMb}</td><td>${e.cpuWantedMs} ms</td><td>${e.cpuGrantedMs} ms</td><td>${note}</td>`;
    body.append(tr);
  }
  const badge = $('cg-verdict');
  badge.className = 'badge ' + (result.verdict === 'oom-killed' ? 'warn' : result.throttled ? 'info' : 'pass');
  badge.textContent = result.verdict;
  $('cg-summary').textContent =
    `${wl.name}: ${result.verdict} after ${result.ticks} tick(s) — ideal ${result.idealTicks}, peak memory ${result.memPeakMb} MB` +
    (result.throttled && result.slowdown > 1 ? `, CPU throttled (took ${result.slowdown.toFixed(1)}× longer)` : '');
  log(`<code>${wl.name}</code> → <strong>${result.verdict}</strong> in ${result.ticks} tick(s)`);
}

/* ---------- Lab 3: boot race + density ---------- */

function renderStages(el, timeline, total) {
  el.innerHTML = '';
  for (const s of timeline) {
    const li = document.createElement('li');
    li.innerHTML = `<div class="stage-bar" style="width:${Math.max(4, (s.ms / total) * 100)}%"></div><span>${s.stage} — ${s.ms} ms</span>`;
    el.append(li);
  }
}

function renderRace() {
  const vm = bootVm();
  const ctr = startContainer();
  renderStages($('vm-stages'), vm.timeline, vm.totalMs);
  renderStages($('ctr-stages'), ctr.timeline, vm.totalMs); // same scale = the point
  $('vm-total').textContent = `${(vm.totalMs / 1000).toFixed(1)} s`;
  $('ctr-total').textContent = `${ctr.totalMs} ms`;
  const d = densityEstimate();
  $('density-vms').textContent = d.vms;
  $('density-ctrs').textContent = d.containers;
  $('density-badge').textContent = `${d.ratio.toFixed(0)}× denser`;
  $('density-note').textContent = `Usable ${d.usableMb} MB after the host OS. Each VM carries a 1 GB guest kernel; each container carries only its ~256 MB app.`;
}

/* ---------- boot ---------- */

renderToggles();
renderView();
renderWorkloads();
renderRace();
$('run-workload').onclick = runCgroupLab;
$('no-limits').onchange = e => { $('mem-limit').disabled = $('cpu-quota').disabled = e.target.checked; };
log('lab ready — a container is a process with two kernel switches flipped');
