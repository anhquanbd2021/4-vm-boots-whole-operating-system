// Startup model — why "nothing to boot" wins. A VM pays for an entire OS
// lifecycle before the app runs; a container pays for clone() + execve() on
// a kernel that is already running.

export const VM_STAGES = [
  { stage: 'firmware / POST', ms: 1200 },
  { stage: 'bootloader', ms: 800 },
  { stage: 'kernel decompress + hardware init', ms: 2200 },
  { stage: 'init system → userspace', ms: 2500 },
  { stage: 'app start', ms: 700 },
];

export const CONTAINER_STAGES = [
  { stage: 'clone() — namespaces + cgroups flipped', ms: 15 },
  { stage: 'mount image layers (shared, already on disk)', ms: 20 },
  { stage: 'execve() — app is PID 1', ms: 15 },
];

export function bootVm(stages = VM_STAGES) {
  const timeline = [];
  let t = 0;
  for (const s of stages) { timeline.push({ ...s, startsAt: t }); t += s.ms; }
  return { timeline, totalMs: t };
}

export function startContainer(stages = CONTAINER_STAGES) {
  return bootVm(stages); // same shape, radically smaller numbers
}

// Density: a VM carries a whole guest OS per app; a container carries only
// the app. hostMemMb minus host OS, divided by the per-instance tax.
export function densityEstimate({ hostMemMb = 16384, hostOsMb = 2048, vmGuestOsMb = 1024, appMb = 256 } = {}) {
  const usable = hostMemMb - hostOsMb;
  const vms = Math.floor(usable / (vmGuestOsMb + appMb));
  const containers = Math.floor(usable / appMb);
  return { usableMb: usable, vms, containers, ratio: containers / vms };
}
