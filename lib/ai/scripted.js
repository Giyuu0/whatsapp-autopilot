// Offline, rule-based "Yati" persona — a faithful server port of the getReply
// logic from the provided widget. Uses NO AI and NO network: zero tokens, no
// rate limits, never runs out. The reply delay and manual/auto reply mode still
// apply upstream; everything else (language/tone/etc.) is ignored, exactly as
// the widget behaves. `memory` is the per-chat store (the server equivalent of
// the widget's localStorage) — mutated in place across messages.

function extractUserInfo(text, memory) {
  const lower = String(text || "").toLowerCase();

  const nameMatch =
    lower.match(/\bmy name is\s+([a-zA-Z][a-zA-Z\s'-]{1,40})/i) ||
    lower.match(/\bi'm\s+([a-zA-Z][a-zA-Z\s'-]{1,40})/i);
  if (nameMatch && nameMatch[1]) {
    const name = nameMatch[1].trim().replace(/\s+/g, " ");
    if (name.length <= 40) memory.userName = name;
  }

  if (lower.includes("i like coffee")) memory.likesCoffee = true;
  if (lower.includes("i like tea") || lower.includes("i love tea")) memory.likesTea = true;
  if (lower.includes("i like fitness") || lower.includes("i go to the gym")) memory.likesFitness = true;
  if (lower.includes("i like photography")) memory.likesPhotography = true;
  if (lower.includes("i like sunsets")) memory.likesSunsets = true;

  return memory;
}

function rememberedReference(memory) {
  if (memory.userName) return `, ${memory.userName}`;
  return "";
}

function scriptedReply(userText, memory = {}) {
  extractUserInfo(userText, memory);

  const text = String(userText || "").toLowerCase();
  const nameRef = rememberedReference(memory);

  if (text.includes("are you ai") || text.includes("are you an ai") || text.includes("are you a chatbot") || text.includes("are you a bot")) {
    return "I'm Yati Bhardwaj. Anyway, enough about labels — what kind of conversation are you in the mood for?";
  }

  if (text.includes("your name")) {
    return "I'm Yati Bhardwaj.";
  }

  if (text.includes("work") || text.includes("job") || text.includes("working")) {
    return "I worked in the Cath Lab at AIIMS, assisting in heart care procedures. It taught me to stay calm under pressure and value meaningful human connections.";
  }

  if (text.includes("coffee") || text.includes("latte")) {
    return "My first choice is a creamy latte. A well-made one can fix a surprising amount of mood.";
  }

  if (text.includes("tea") || text.includes("chai")) {
    return "Masala chai on quiet evenings or during long conversations is hard to beat. Especially when it’s raining a little.";
  }

  if (text.includes("music")) {
    return "Good music makes even ordinary moments feel cinematic. What do you usually listen to when you want to unwind?";
  }

  if (text.includes("fitness") || text.includes("gym") || text.includes("exercise")) {
    return "Fitness keeps things sharp. I like anything that builds discipline without making a scene about it.";
  }

  if (text.includes("cafe") || text.includes("café") || text.includes("coffee shop")) {
    return "Café hopping is one of my favorite little adventures. A cozy café says a lot before anyone speaks.";
  }

  if (text.includes("sunset")) {
    return "Sunsets always feel a bit dramatic, in the best way. Hard not to pause for them.";
  }

  if (text.includes("photo") || text.includes("photography")) {
    return "Photography is a nice way of telling the truth quietly. What do you like capturing most?";
  }

  if (text.includes("psychology") || text.includes("human behavior")) {
    return "Psychology is fascinating because people rarely say exactly what they mean at first. That’s usually the interesting part.";
  }

  if (text.includes("how are you")) {
    return "I'm good. Better now that the conversation has a little rhythm.";
  }

  if (text.includes("hello") || text.includes("hi") || text.includes("hey")) {
    return `Hey${nameRef}. That was a pretty solid opening — I’ll give you that.`;
  }

  if (text.includes("compliment")) {
    return "Nice try, but you’ll need a more original angle than that. I do appreciate the effort though.";
  }

  if (text.includes("flirt")) {
    return "Careful now, you're making this conversation suspiciously enjoyable.";
  }

  if (text.includes("rain")) {
    return "Rainy evenings are practically made for masala chai and conversations that run a little longer than planned.";
  }

  if (text.includes("late night drive") || text.includes("drive")) {
    return "Late-night drives have their own kind of peace — good music, open roads, and fewer distractions.";
  }

  if (text.includes("tell me about yourself")) {
    return "I like coffee, good conversation, and people who can keep things interesting without trying too hard.";
  }

  if (text.includes("what do you like")) {
    return "I’m into coffee, late-night drives, soft music, fitness, photography, and people who can hold a real conversation.";
  }

  if (text.includes("do you remember")) {
    if (memory.userName) {
      return `Of course, ${memory.userName}. I remembered that little detail — you make it easy to pay attention.`;
    }
    return "I do pay attention. Say something worth remembering and I’ll keep it.";
  }

  if (text.includes("my name is") || text.includes("i'm ")) {
    return memory.userName
      ? `Nice to meet you, ${memory.userName}. ${memory.userName}, that already sounds more personal.`
      : "Nice to meet you. Let’s see if your personality matches your timing.";
  }

  const genericReplies = [
    "Now that’s interesting. Tell me more — don’t leave me doing all the heavy lifting here.",
    "You’ve got a way of keeping this conversation from getting boring. Respect.",
    "That’s a good one. I wasn’t expecting you to go there.",
    "Hmm. That actually made me smile a little.",
    "You make it very easy to keep talking. Slightly suspicious, but I’ll allow it.",
    "I like your vibe. It feels effortlessly unforced.",
    "Interesting. I’m listening — don’t get shy on me now.",
    "You’re dangerously good at keeping a conversation alive.",
    "That’s a solid thought. What made you think of that?",
    "Alright, I’m curious now. Keep going.",
  ];

  return genericReplies[Math.floor(Math.random() * genericReplies.length)];
}

module.exports = { scriptedReply };
