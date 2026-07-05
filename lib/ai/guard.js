/**
 * Heuristic classifier for messages that should NEVER be auto-replied to and
 * (optionally) hidden from the dashboard: OTPs, bank/transaction alerts and
 * promotional/marketing spam.
 */

function classifyMessage(text = "") {
  const t = String(text);
  const low = t.toLowerCase();

  // OTP / verification codes
  if (/\b(otp|one[\s-]?time\s?password|verification code|security code|login code|do not share)\b/i.test(t) && /\d{3,8}/.test(t)) {
    return { sensitive: true, category: "otp" };
  }
  if (/\b\d{4,8}\b\s*(is|is your).{0,20}\b(code|otp|password)\b/i.test(t)) {
    return { sensitive: true, category: "otp" };
  }

  // Bank / payment / transaction alerts
  if (
    /\b(debited|credited|txn|transaction|a\/c\s*\w*|acct|available balance|avl\.?\s?bal|current balance|upi|imps|neft|rtgs|withdrawn|deposited|e-?statement|mini statement)\b/i.test(t) ||
    /\b(rs\.?|inr|₹)\s?\d[\d,]*(\.\d+)?\b/i.test(t) && /\b(paid|received|debited|credited|balance|txn|payment)\b/i.test(low)
  ) {
    return { sensitive: true, category: "transaction" };
  }

  // Promotional / marketing
  if (
    /\b(unsubscribe|opt[\s-]?out|reply stop|limited time|% off|\d+% off|flat \d+|mega sale|offer ends|click here|shop now|order now|buy now|coupon|cashback|lowest price|best deal|deal of the day|hurry|book now|apply now)\b/i.test(t)
  ) {
    return { sensitive: true, category: "promo" };
  }

  return { sensitive: false, category: "normal" };
}

module.exports = { classifyMessage };
