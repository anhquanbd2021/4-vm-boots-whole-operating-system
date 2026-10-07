# Isolation Under Glass — companion demo

Interactive lab for the article *A Container Isn't a Small VM — It's a
Process With Two Kernel Switches Flipped*. A toy kernel model that lets you
flip the two controls one at a time: **namespaces** mask what a process can
see, **cgroups** leash what it can use, and the **shared kernel** is why
there is nothing to boot.

Zero dependencies — Node 20+ only. The namespace, cgroup, and startup
models are plain ES modules shared by the browser UI, the CLI report, and
the test suite.

## Three labs

| Lab | What it proves |
|---|---|
| **Namespace mask** | Toggle six namespace types against a host world fixture and watch the process's view shrink: pid → its own tree renumbered to PID 1, mnt → its slice of disk as `/`, net → loopback + one veth, uts → its own hostname, ipc → its own segments, user → container root demoted to an unprivileged host uid. Switch `user` off and the lab warns: root inside is root outside. |
| **cgroup leash** | Run a workload under a memory/CPU budget. `leaky-app` is OOM-killed the tick it crosses the limit; `cpu-hog` completes but throttled (granted less than it asked, stretched over more ticks). Flip "no limits" and the leak runs free — the host default. |
| **Boot race** | Side-by-side timelines: VM (firmware → bootloader → kernel → init → app ≈ 7.4 s) vs container (`clone()` → mount layers → `execve()` ≈ 50 ms), plus a density estimate — ~56 containers where ~11 VMs fit on a 16 GB host. |

## Run it

```text
npm start        # serve the lab on :3000 (PORT env overrides)
npm test         # namespaces + cgroups + startup + server + fixture sync
npm run report   # side-by-side CLI report with hard assertions
npm run check    # both
```

## Examples

- `examples/host-world.json` — the unmasked host: 10 processes, 12 paths,
  5 interfaces, 3 IPC segments, 2 containers (`web`, `cache`).
- `examples/polite-app.json` — fits the default budget; completes in 8 ticks.
- `examples/leaky-app.json` — cumulative memory crosses 256 MB at tick 4 →
  OOM-killed there.
- `examples/cpu-hog.json` — wants 400 ms/tick against a 250 ms quota →
  throttled, finishes in 8 ticks instead of the ideal 5.

## Honest limits

- This is a teaching model. Nothing here calls `clone()`, creates real
  namespaces, or touches real cgroups — the "kernel" is a few pure
  functions over fixtures.
- Timings are illustrative, not measured: real VM boots vary wildly
  (cloud images boot in ~1 s; the shape of the gap is what matters).
- The six namespace types are real; their interaction is simplified (e.g.
  `user` also gates the others' privilege in the real kernel).
- cgroup v2 details (io, pids, memory.high vs memory.max) are reduced to
  one memory limit and one CPU quota.
- Density math ignores CPU, daemons-per-VM, and image sharing — it's a
  memory-tax sketch, not capacity planning.

This is an educational demo, not production infrastructure.
