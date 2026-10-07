// Namespace model — what a process can SEE once each kernel mask is applied.
// A real container flips these in one clone() call; here each flag is a
// toggle so you can watch one mask at a time.

export const NAMESPACE_TYPES = [
  { id: 'pid', label: 'PID', hides: 'every process outside its own tree' },
  { id: 'mnt', label: 'Mount', hides: 'every file outside its own root' },
  { id: 'net', label: 'Net', hides: 'every interface but loopback + its veth' },
  { id: 'uts', label: 'UTS', hides: 'the host hostname' },
  { id: 'ipc', label: 'IPC', hides: 'shared memory owned by others' },
  { id: 'user', label: 'User', hides: 'real root — uid 0 maps to a nobody' },
];

export const ALL_NAMESPACES = Object.fromEntries(NAMESPACE_TYPES.map(n => [n.id, true]));
export const NO_NAMESPACES = Object.fromEntries(NAMESPACE_TYPES.map(n => [n.id, false]));

// Processes whose ancestry reaches the container init become the pid-ns tree.
function pidSubtree(processes, initPid) {
  const byParent = new Map();
  for (const p of processes) {
    if (!byParent.has(p.ppid)) byParent.set(p.ppid, []);
    byParent.get(p.ppid).push(p);
  }
  const out = [];
  const queue = [initPid];
  while (queue.length) {
    const pid = queue.shift();
    const proc = processes.find(p => p.pid === pid);
    if (!proc) continue;
    out.push(proc);
    for (const child of byParent.get(pid) || []) queue.push(child.pid);
  }
  return out;
}

// Renumber a subtree so the container init sees itself as PID 1.
function remapPids(subtree) {
  const map = new Map(subtree.map((p, i) => [p.pid, i + 1]));
  return subtree.map(p => ({
    ...p,
    pid: map.get(p.pid),
    ppid: p.pid === subtree[0].pid ? 0 : map.get(p.ppid),
  }));
}

// applyNamespaces(world, flags, containerId) → the world as the process
// sees it. With all flags off it sees the raw host — that is the point.
export function applyNamespaces(world, flags = ALL_NAMESPACES, containerId = 'web') {
  const spec = world.containers[containerId];
  if (!spec) throw new Error(`unknown container: ${containerId}`);
  const subtree = pidSubtree(world.processes, spec.initPid);

  const view = {
    hostname: flags.uts ? spec.hostname : world.hostname,
    processes: flags.pid ? remapPids(subtree) : world.processes,
    filesystem: flags.mnt
      ? world.filesystem
          .filter(p => p === spec.root || p.startsWith(spec.root + '/'))
          .map(p => p.slice(spec.root.length) || '/')
      : world.filesystem,
    interfaces: flags.net
      ? world.interfaces.filter(i => i.name === 'lo' || i.container === containerId)
      : world.interfaces,
    ipcSegments: flags.ipc
      ? world.ipcSegments.filter(s => s.container === containerId)
      : world.ipcSegments,
    uid: flags.user
      ? { inside: 0, onHost: spec.uidBase, rootIsHostRoot: false }
      : { inside: 0, onHost: 0, rootIsHostRoot: true },
  };
  return view;
}

// viewDiff → how much of each world the mask removed.
export function viewDiff(world, view) {
  return {
    processes: world.processes.length - view.processes.length,
    files: world.filesystem.length - view.filesystem.length,
    interfaces: world.interfaces.length - view.interfaces.length,
    ipcSegments: world.ipcSegments.length - view.ipcSegments.length,
    hostnameChanged: world.hostname !== view.hostname,
    rootDemoted: !view.uid.rootIsHostRoot,
  };
}
