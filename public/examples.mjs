// Fixtures mirrored from examples/*.json — kept in sync by
// test/examples.test.mjs so the browser lab and the files never drift.

export const HOST_WORLD = {
  hostname: 'prod-host-01',
  uidBase: 100000,
  processes: [
    { pid: 1, ppid: 0, name: 'systemd', uid: 0 },
    { pid: 214, ppid: 1, name: 'sshd', uid: 0 },
    { pid: 380, ppid: 1, name: 'postgres', uid: 999 },
    { pid: 512, ppid: 1, name: 'cron', uid: 0 },
    { pid: 700, ppid: 1, name: 'containerd', uid: 0 },
    { pid: 901, ppid: 1, name: 'node /srv/legacy/app.js', uid: 33 },
    { pid: 940, ppid: 901, name: 'node helper', uid: 33 },
    { pid: 2401, ppid: 700, name: 'node /app/server.js', uid: 1000, container: 'web' },
    { pid: 2440, ppid: 2401, name: 'node worker', uid: 1000, container: 'web' },
    { pid: 2600, ppid: 700, name: 'redis-server', uid: 998, container: 'cache' },
  ],
  filesystem: [
    '/bin/sh', '/etc/hostname', '/etc/hosts', '/home/ops/.ssh/id_ed25519',
    '/srv/legacy/app.js', '/srv/legacy/config.yml', '/var/lib/postgres/data',
    '/var/log/auth.log', '/srv/containers/web/app.js',
    '/srv/containers/web/package.json',
    '/srv/containers/web/node_modules/left-pad/index.js',
    '/srv/containers/cache/dump.rdb',
  ],
  interfaces: [
    { name: 'lo', addr: '127.0.0.1' },
    { name: 'eth0', addr: '203.0.113.10' },
    { name: 'docker0', addr: '172.17.0.1' },
    { name: 'veth-a1b2', addr: '172.17.0.4', container: 'web' },
    { name: 'veth-c3d4', addr: '172.17.0.9', container: 'cache' },
  ],
  ipcSegments: [
    { id: 'shm-7', owner: 'postgres' },
    { id: 'shm-9', owner: 'legacy app' },
    { id: 'shm-c1', owner: 'web app', container: 'web' },
  ],
  containers: {
    web: { initPid: 2401, root: '/srv/containers/web', hostname: 'web-ctr', veth: 'veth-a1b2', uidBase: 100000 },
    cache: { initPid: 2600, root: '/srv/containers/cache', hostname: 'cache-ctr', veth: 'veth-c3d4', uidBase: 200000 },
  },
};

export const WORKLOADS = {
  'polite-app': { name: 'polite-app', cpuWorkMs: 1600, cpuWantedPerTickMs: 200, memPerTickMb: 30, maxTicks: 20 },
  'leaky-app': { name: 'leaky-app', cpuWorkMs: 4000, cpuWantedPerTickMs: 300, memPerTickMb: [40, 60, 80, 100, 120, 140, 160, 180], maxTicks: 20 },
  'cpu-hog': { name: 'cpu-hog', cpuWorkMs: 2000, cpuWantedPerTickMs: 400, memPerTickMb: 20, maxTicks: 20 },
};
