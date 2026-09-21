/**
 * Builds the public demo served from https://ys941.github.io/whatsapp-autopilot/.
 *
 * The demo is a static export: the dashboard runs against fictional chats in
 * the browser (components/demoSocket.ts), so the one API route is taken out of
 * the build and restored from git afterwards, even if the build fails.
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

const SERVER_ONLY = ["app/api"];
const git = (args) => execFileSync("git", args, { encoding: "utf8" });

const dirty = git(["status", "--porcelain", "--", ...SERVER_ONLY]).trim();
if (dirty) {
  console.error("Uncommitted changes in files this build removes and restores:\n" + dirty);
  process.exit(1);
}

for (const path of SERVER_ONLY) rmSync(path, { recursive: true, force: true });
try {
  execFileSync("npx", ["next", "build"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NEXT_PUBLIC_DEMO: "1", NEXT_PUBLIC_BASE_PATH: "/whatsapp-autopilot" },
  });
} finally {
  for (const path of SERVER_ONLY) if (!existsSync(path)) git(["checkout", "--", path]);
}
