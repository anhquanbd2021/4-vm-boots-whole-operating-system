// cgroup model — the resource leash. Budgets are enforced by the kernel,
// not requested politely: memory over-limit → OOM-killed, CPU over-quota →
// throttled (granted less than asked, so work stretches over more ticks).

export function createBudget({ memLimitMb = 256, cpuQuotaMsPerTick = 250 } = {}) {
  return { memLimitMb, cpuQuotaMsPerTick };
}
export const NO_LIMITS = { memLimitMb: Infinity, cpuQuotaMsPerTick: Infinity };

function memAtTick(workload, tickIndex) {
  const m = workload.memPerTickMb;
  return Array.isArray(m) ? (m[tickIndex] ?? m[m.length - 1]) : m;
}

// runWorkload(workload, budget) → tick-by-tick ledger + verdict.
// verdicts: 'completed' | 'throttled-completed' | 'oom-killed' | 'still-running'
export function runWorkload(workload, budget = createBudget()) {
  const events = [];
  let memMb = 0;
  let cpuDoneMs = 0;
  let throttled = false;
  let verdict = 'still-running';

  for (let tick = 1; tick <= workload.maxTicks; tick++) {
    memMb += memAtTick(workload, tick - 1);
    const wanted = workload.cpuWantedPerTickMs;
    const granted = Math.min(wanted, budget.cpuQuotaMsPerTick);
    if (granted < wanted) throttled = true;
    cpuDoneMs += granted;
    const over = memMb > budget.memLimitMb;
    events.push({ tick, memMb, cpuWantedMs: wanted, cpuGrantedMs: granted, cpuDoneMs, oom: over });
    if (over) { verdict = 'oom-killed'; break; }
    if (cpuDoneMs >= workload.cpuWorkMs) { verdict = throttled ? 'throttled-completed' : 'completed'; break; }
  }
  const idealTicks = Math.ceil(workload.cpuWorkMs / workload.cpuWantedPerTickMs);
  return {
    events,
    verdict,
    ticks: events.length,
    idealTicks,
    memPeakMb: memMb,
    throttled,
    slowdown: verdict === 'throttled-completed' ? events.length / idealTicks : 1,
  };
}
