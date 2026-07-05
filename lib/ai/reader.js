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
function isPrivateIp(ip) {
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true; // 172.16.0.0/12
  if (ip === "::1" || /^f[cd]/i.test(ip) || /^fe80/i.test(ip)) return true; // v6 loopback/ULA/link-local
  if (/^::ffff:/i.test(ip)) return isPrivateIp(ip.slice(7)); // v4-mapped v6
  return false;
}
async function isSafeUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(u.protocol)) return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  // Literal IP in the URL.
  if (/^[\d.]+$/.test(host) || host.includes(":")) return !isPrivateIp(host.replace(/^\[|\]$/g, ""));
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
    if (!(await isSafeUrl(url))) {
      console.warn("[reader] blocked unsafe/private URL:", url);
      return "";
    }
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WhatsAppAutoPilot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
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
