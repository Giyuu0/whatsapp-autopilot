/**
 * Read extra content so replies can be about it: PDFs (extract text) and
 * links (fetch the page and strip to readable text). Best-effort — returns
 * "" on failure so the caller can just proceed without it.
 */
const MAX_CHARS = 6000;

/** Extract text from a base64 PDF. */
async function readPdf(base64) {
  try {
    const pdfParse = require("pdf-parse");
    const buf = Buffer.from(base64, "base64");
    const data = await pdfParse(buf);
    return String(data.text || "").replace(/\s+\n/g, "\n").trim().slice(0, MAX_CHARS);
  } catch (e) {
    console.warn("[reader] pdf parse failed:", e.message);
    return "";
  }
}

/** First URL in a string, if any. */
function firstUrl(text = "") {
  const m = String(text).match(/https?:\/\/[^\s]+/i);
  return m ? m[0].replace(/[)\].,]+$/, "") : null;
}

/**
 * SSRF guard: contacts can send arbitrary URLs, and this fetch runs on the
 * OWNER's machine — so block anything that resolves to a private/internal
 * address (router admin pages, localhost services, cloud metadata, etc.).
 */
const dns = require("dns").promises;
const net = require("net");
function isPrivateIp(ip) {
  // IPv6 (and v4-mapped v6).
  if (ip.includes(":")) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::") return true; // loopback / unspecified
    if (/^f[cd]/.test(low)) return true; // ULA fc00::/7
    if (/^fe[89ab]/.test(low)) return true; // link-local fe80::/10
    if (low.startsWith("::ffff:")) return isPrivateIp(low.slice(7)); // v4-mapped
    return false;
  }
  // IPv4 — parse numerically so no textual-prefix trick can dodge the check.
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // malformed → treat as private
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10 (incl. Tailscale)
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && (b === 0 || b === 168)) return true; // 192.168/16 + 192.0.0/24 special
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking 198.18/15
  if (a >= 224) return true; // multicast + reserved 224.0.0.0/3
  return false;
}
/** Encoded IPv4 forms (octal "0177.0.0.1", decimal "2130706433", hex
 *  "0x7f000001") fail net.isIP but the OS still connects them as IPs — so any
 *  purely-numeric host that ISN'T a canonical IP is blocked outright. */
function looksLikeEncodedIp(host) {
  return /^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+)){0,3}$/i.test(host);
}
async function isSafeUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(u.protocol)) return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // Literal IP in the URL (canonical form).
  if (net.isIP(host) !== 0) return !isPrivateIp(host);
  // Numeric-but-not-canonical → an encoded-IP trick, never a real domain.
  if (looksLikeEncodedIp(host)) return false;
  // Resolve the name and check every address it maps to.
  try {
    const addrs = await dns.lookup(host, { all: true });
    if (!addrs.length) return false;
    return addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

/** Fetch a URL and return its readable text (rough HTML strip). */
async function readLink(url) {
  try {
    // Follow redirects MANUALLY and re-run the SSRF guard on every hop — with
    // redirect:"follow" only the first URL was checked, so a harmless public
    // page could 302 to localhost / cloud metadata and we'd fetch it.
    const MAX_REDIRECTS = 5;
    let current = url;
    let res = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isSafeUrl(current))) {
        console.warn("[reader] blocked unsafe/private URL:", current);
        return "";
      }
      res = await fetch(current, {
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WhatsAppAutoPilot/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      if (![301, 302, 303, 307, 308].includes(res.status)) break;
      const loc = res.headers.get("location");
      if (!loc) return "";
      current = new URL(loc, current).href; // resolve relative Location too
      res = null; // ran out of hops → treat as failure below
    }
    if (!res || !res.ok) return "";
    const ct = res.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(ct)) return "";
    let html = await res.text();
    // Grab <title> + strip tags/scripts to plain-ish text.
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return `${title ? "Title: " + title + "\n" : ""}${text}`.slice(0, MAX_CHARS);
  } catch (e) {
    console.warn("[reader] link fetch failed:", e.message);
    return "";
  }
}

module.exports = { readPdf, readLink, firstUrl };
