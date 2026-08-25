/**
 * lib/attribution.js
 *
 * Attribution enforcement (CommonJS — required by server.js at start-up).
 *
 * The project's attribution requirement (see COPYRIGHT.md) asks that any
 * deployment other people can see displays visible credit to the original
 * author. Two checks run once, when the server starts:
 *
 *   1. ACKNOWLEDGEMENT — ATTRIBUTION_ACK must be set to the author's profile.
 *   2. VISIBLE CREDIT  — the dashboard footer must still render that credit.
 *
 * The second check fails only on *positive evidence* that the credit was
 * removed. If it cannot inspect anything (an unusual deployment layout, a
 * standalone bundle, a read-only filesystem) it warns and lets the app start,
 * so a legitimate deployment is never broken by a check that simply could not
 * see the file.
 *
 * Removing these checks does not remove the ask — see COPYRIGHT.md.
 */

const fs = require("node:fs");
const path = require("node:path");

const AUTHOR = {
  name: "Yati Bhardwaj",
  handle: "ys941",
  url: "https://github.com/ys941",
};

const ACCEPTED = new Set([
  "https://github.com/ys941",
  "http://github.com/ys941",
  "github.com/ys941",
  "@ys941",
  "ys941",
]);

const normalise = (v) => String(v).trim().replace(/\/+$/, "").toLowerCase();

/** True when the operator has acknowledged the attribution requirement. */
function hasAttributionAck() {
  const raw = process.env.ATTRIBUTION_ACK;
  return typeof raw === "string" && ACCEPTED.has(normalise(raw));
}

/** Files expected to carry the visible credit, in priority order. */
const CREDIT_FILES = [
  path.join("components", "Footer.tsx"),
  path.join("src", "components", "Footer.tsx"),
];

/** Looks for the author URL inside the built output (bounded scan). */
function creditInBuild(root) {
  const buildDir = path.join(root, ".next", "server");
  if (!fs.existsSync(buildDir)) return null;

  let filesRead = 0;
  const MAX_FILES = 400;

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (filesRead >= MAX_FILES) return false;
      const full = path.join(dir, entry);
      let s;
      try {
        s = fs.statSync(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        if (walk(full)) return true;
        continue;
      }
      if (!/\.(js|mjs|cjs)$/.test(entry) || s.size > 4_000_000) continue;
      filesRead++;
      try {
        if (fs.readFileSync(full, "utf8").includes(AUTHOR.url)) return true;
      } catch {
        /* unreadable, keep going */
      }
    }
    return false;
  };

  return walk(buildDir);
}

/**
 * Verifies the dashboard still credits the author.
 * @returns {{status: "ok"|"missing"|"unverifiable", detail: string}}
 */
function checkVisibleCredit(root = process.cwd()) {
  for (const rel of CREDIT_FILES) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) continue;
    let src;
    try {
      src = fs.readFileSync(full, "utf8");
    } catch {
      return { status: "unverifiable", detail: `${rel} could not be read` };
    }
    return src.includes(AUTHOR.url)
      ? { status: "ok", detail: rel }
      : { status: "missing", detail: rel };
  }

  const inBuild = creditInBuild(root);
  if (inBuild === true) return { status: "ok", detail: ".next build output" };
  if (inBuild === false) return { status: "missing", detail: ".next build output" };

  return { status: "unverifiable", detail: "no footer source or build output found" };
}

const ackFailure = `
────────────────────────────────────────────────────────────────────────
  WhatsApp AutoPilot will not start without attribution.

  It is MIT-licensed — free to use, fork, rebrand and sell. The one
  thing asked in return is that credit to the original author stays
  visible. See COPYRIGHT.md.

  Add this to your .env.local (or your host's environment):

      ATTRIBUTION_ACK="${AUTHOR.url}"

  Nothing is transmitted. No network call is made, no telemetry is
  collected, no licence server is contacted — the value is compared to a
  string in this file and that is all.

  Built by ${AUTHOR.name} · ${AUTHOR.url}
────────────────────────────────────────────────────────────────────────
`;

const creditFailure = (where) => `
────────────────────────────────────────────────────────────────────────
  The author credit has been removed from ${where}.

  This project's attribution requirement (COPYRIGHT.md) asks any
  deployment other people can see to display visible credit:

      Designed & developed by ${AUTHOR.name} - ${AUTHOR.url}

  Restore the credit in the dashboard footer and the app will start.

  Everything around it is still yours: rename it, restyle it, change the
  personas and the tones. Just leave the one line that says who built it.
────────────────────────────────────────────────────────────────────────
`;

/**
 * Runs both attribution checks. Called once from server.js.
 * Throws if attribution is missing; warns if it cannot be verified.
 */
function assertAttribution() {
  if (!hasAttributionAck()) {
    console.error(ackFailure);
    throw new Error(
      `Attribution required: set ATTRIBUTION_ACK="${AUTHOR.url}" to start this app. See COPYRIGHT.md.`,
    );
  }

  const credit = checkVisibleCredit();

  if (credit.status === "missing") {
    console.error(creditFailure(credit.detail));
    throw new Error(
      `Attribution: the author credit is missing from ${credit.detail}. See COPYRIGHT.md.`,
    );
  }

  if (credit.status === "unverifiable") {
    console.warn(
      `[attribution] Could not verify the visible credit (${credit.detail}). ` +
        `The author asks that it stays displayed — see COPYRIGHT.md.`,
    );
  }
}

module.exports = { AUTHOR, hasAttributionAck, checkVisibleCredit, assertAttribution };
