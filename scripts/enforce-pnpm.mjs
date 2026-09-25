import { existsSync, rmSync } from "node:fs";

for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  if (existsSync(lockfile)) rmSync(lockfile, { force: true });
}

const userAgent = process.env.npm_config_user_agent || "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("This repository uses pnpm. Run commands with pnpm instead of npm or yarn.");
  process.exit(1);
}
