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

/** Fetch a URL and return its readable text (rough HTML strip). */
async function readLink(url) {
  try {
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
