import net from "net";
import fs from "fs";
import app from "./app";
import { logger } from "./lib/logger";
import { validateEnv } from "./lib/validateEnv";

validateEnv();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const desiredPort = Number(rawPort);

if (Number.isNaN(desiredPort) || desiredPort <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => tester.close(() => resolve(true)));
    tester.listen(port, "0.0.0.0");
  });
}

// ── Stale-process port recovery ────────────────────────────────────────────
// If a previous run of this same server didn't shut down cleanly (e.g. an
// abrupt workflow restart), its process can keep holding the desired PORT.
// The server would otherwise silently fall back to a different port, which
// breaks the frontend (it's hardcoded to talk to the configured PORT). This
// detects that specific situation — a leftover instance of *this* server —
// and terminates it so the correct port can be reused. It never touches
// processes it can't positively identify as a stale copy of this app.

function hexPort(port: number): string {
  return port.toString(16).toUpperCase().padStart(4, "0");
}

function findInodeForPort(port: number): string | null {
  const target = hexPort(port);
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    try {
      const lines = fs.readFileSync(file, "utf8").split("\n").slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) continue;
        const localAddr = parts[1];
        const state = parts[3]; // "0A" = LISTEN
        const inode = parts[9];
        if (!localAddr || state !== "0A") continue;
        if (localAddr.split(":")[1] === target) return inode;
      }
    } catch {
      // e.g. no IPv6 support in this container — ignore and try the next file
    }
  }
  return null;
}

function findPidForInode(inode: string): number | null {
  try {
    for (const pid of fs.readdirSync("/proc").filter((p) => /^\d+$/.test(p))) {
      try {
        const fdDir = `/proc/${pid}/fd`;
        for (const fd of fs.readdirSync(fdDir)) {
          try {
            if (fs.readlinkSync(`${fdDir}/${fd}`) === `socket:[${inode}]`) {
              return Number(pid);
            }
          } catch {
            // fd disappeared mid-scan — ignore
          }
        }
      } catch {
        // no permission / process exited between readdir and read — ignore
      }
    }
  } catch {
    // /proc unavailable on this platform — ignore
  }
  return null;
}

function isLikelyThisServer(pid: number): boolean {
  try {
    const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8");
    return cmdline.includes("index.mjs") || cmdline.includes("api-server");
  } catch {
    return false;
  }
}

async function freeStalePort(port: number): Promise<void> {
  if (await isPortAvailable(port)) return;

  const inode = findInodeForPort(port);
  const pid = inode ? findPidForInode(inode) : null;
  if (!pid || pid === process.pid) return;

  if (!isLikelyThisServer(pid)) {
    logger.warn(
      { port, pid },
      `Port ${port} is held by an unrecognized process (pid ${pid}) — leaving it alone`,
    );
    return;
  }

  logger.warn(
    { port, pid },
    `Port ${port} is held by a stale copy of this server (pid ${pid}) — terminating it so this run can bind the correct port`,
  );
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return; // already gone
  }

  for (let i = 0; i < 20; i++) {
    if (await isPortAvailable(port)) return;
    await new Promise((r) => setTimeout(r, 150));
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch {
    return; // already gone
  }
  for (let i = 0; i < 10; i++) {
    if (await isPortAvailable(port)) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function findAvailablePort(start: number, maxAttempts = 20): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = start + i;
    if (await isPortAvailable(candidate)) {
      if (i > 0) {
        logger.warn(
          { desiredPort: start, selectedPort: candidate },
          `Port ${start} was in use — automatically selected port ${candidate}`,
        );
      }
      return candidate;
    }
  }
  throw new Error(
    `No available port found in range ${start}–${start + maxAttempts - 1}`,
  );
}

await freeStalePort(desiredPort);

const port = await findAvailablePort(desiredPort);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info(
    {
      port,
      env: process.env["NODE_ENV"] ?? "development",
      service: "api-server",
    },
    `API Server listening on port ${port}`,
  );
});
