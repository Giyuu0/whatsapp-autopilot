/**
 * "Needs your attention" detector — flags incoming messages the OWNER should
 * personally see/answer (availability, whereabouts, duty/work questions,
 * urgency, money, meeting plans, direct requests). Pure heuristics: instant,
 * free, works in English + Hindi/Hinglish. Deliberately conservative — casual
 * chatter should NOT ping the owner.
 */

const RULES = [
  {
    reason: "asking when you're free",
    re: /\b(when (will|r|are) (you|u) (be )?free|free (kab|when|ho( kya)?)|kab (free|khali|milega|milegi|aaoge|aayega|aa raha|time (hai|milega))|khali (ho|kab)|time (kab )?(hai|milega|nikal)|kitne baje (free|aaoge|milega))\b/i,
  },
  {
    reason: "asking where you are",
    re: /\b(where (are|r) (you|u)|whats? (your|ur) location|kaha (ho|hai|pe|par)( ho)?|kahan (ho|hai|pe)|kidhar (ho|hai)|kls?p? (kaha|kahan)|location (bhej|send|share)|pahunch(e| gaye| gya)?( kya)?|reach (ho gaye|hue|kar)|ghar (pe|par) ho)\b/i,
  },
  {
    reason: "asking about your duty/work schedule",
    re: /\b(duty|shift|roster|posting|night duty|morning duty)\b.{0,30}\b(kal|tomorrow|aaj|today|kab|when|what|kya|kitne)\b|\b(kal|tomorrow|aaj|today)\b.{0,30}\b(duty|shift|office|kaam|work|job|clinic|hospital|lab)\b|\bwhats? (your|ur) duty\b/i,
  },
  {
    reason: "urgent / emergency",
    re: /\b(urgent|urgently|emergency|asap|jaldi (bata|reply|kar|bol|call)|abhi (call|phone|bata)|call (me|kar|karo|kr)( ?na)?( abhi)?|phone (utha|kar|karo|kr)|pick (up|the call)|important (baat|hai|thing)|zaroori (baat|hai|kaam)|jarur[i]? (baat|kaam)|help (chahiye|kar|karo|me)|madad (chahiye|kar)|problem (ho gayi|hai|aa gayi)|dikkat (hai|ho gayi)|tabiyat|hospital (aana|aa jao|jana)|accident)\b/i,
  },
  {
    reason: "asking for money / payment",
    re: /\b(paise (bhej|de|chahiye|transfer|wapas|dede|de de)|payment (kar|bhej|pending|due)|(bhej|send) (de |kar )?(paise|money|amount|rs|rupees|₹)|udhar (chahiye|de|dede)|gpay|phonepe|paytm (kar|pe bhej)|account (me|mein) (daal|bhej)|loan (chahiye|de))\b/i,
  },
  {
    reason: "meeting / plan proposal",
    re: /\b(milna (hai|tha|chahta|chahti)|mil (sakte|sakta|sakti) (hai|ho)|meet (kar|karna|up|me|today|tomorrow|kab)|milte (hai|hain) (kab|kal|aaj)|aa (ja|jao|jana|raha hai kya)|ghar (aa|aao|aana)|party (hai|me aana|de)|shaadi (hai|me aana)|function (hai|me aana)|plan (bana|banao|hai kya|kya hai)|chalein?g?e? (kya|kahin)|movie (chale|dekhne)|dinner|lunch (pe|par|chale))\b/i,
  },
  {
    reason: "needs a decision / confirmation from you",
    re: /\b(confirm (kar|karo|kr|please|plz)|final (kar|bata|answer)|haan ya (na|nahi)|yes (ya|or) no|bata (de|do|dena) (jaldi|pakka|confirm)|pakka (bata|aana|aaoge)|decide (kar|karo|fast)|approval|permission (chahiye|de)|allow (kar|karo)|sign (kar|chahiye)|document (bhej|chahiye|sign))\b/i,
  },
  {
    reason: "personal question for you",
    re: /\b(are (you|u) (ok(ay)?|alright|fine|coming|there)|tum (theek|thik|aa rahe) ho( na)?|tu (thik|theek) (hai|h)( na)?|sab (theek|thik) (hai|h)( na)?|naraz (ho|hai)( kya)?|gussa (ho|hai)( kya)?|ignore (kyu|kyon|kar rahe)|reply (kyu nahi|kar|karo|de)( rahe)?|busy (ho|hai) kya|kya kar rahe ho aajkal)\b/i,
  },
];

/**
 * @param {string} text incoming message text (or voice transcript)
 * @returns {{attention: boolean, reason: string|null}}
 */
function needsAttention(text = "") {
  const t = String(text || "").trim();
  if (!t || t.length < 2) return { attention: false, reason: null };
  for (const rule of RULES) {
    if (rule.re.test(t)) return { attention: true, reason: rule.reason };
  }
  return { attention: false, reason: null };
}

module.exports = { needsAttention };
