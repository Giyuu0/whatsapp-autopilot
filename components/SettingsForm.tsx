"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Toggle } from "@/components/ui";
import type { Settings, ModelStep, ModelsResult, VoicePreview } from "@/components/useWaSocket";

/* ------------------------------ small helpers ------------------------------ */

const CUSTOM = "__custom__";

/** A real <select> dropdown listing every model fetched from the API key,
 *  with a "Custom…" escape hatch to type any model id by hand. */
function ModelField({
  value,
  onChange,
  options,
  placeholder,
  className = "",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}) {
  const [custom, setCustom] = useState(false);

  if (custom) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          className={`input ${className}`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="btn-ghost shrink-0 !px-2.5 !py-1.5 text-xs"
          onClick={() => setCustom(false)}
          title="Back to the list"
        >
          List
        </button>
      </div>
    );
  }

  // Ensure the current value is always selectable, even if it isn't in the list.
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select
      className={`input ${className}`}
      value={value || ""}
      onChange={(e) => {
        const v = e.target.value;
        if (v === CUSTOM) setCustom(true);
        else onChange(v);
      }}
    >
      {!value && (
        <option value="" disabled>
          {placeholder || "Select a model…"}
        </option>
      )}
      {opts.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      <option value={CUSTOM}>✎ Custom…</option>
    </select>
  );
}

function ChainEditor({
  steps,
  onChange,
  groqOptions,
  geminiOptions,
  idBase,
}: {
  steps: ModelStep[];
  onChange: (s: ModelStep[]) => void;
  groqOptions: string[];
  geminiOptions: string[];
  idBase: string;
}) {
  const setStep = (i: number, patch: Partial<ModelStep>) =>
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const remove = (i: number) => onChange(steps.filter((_, j) => j !== i));
  const add = () => onChange([...steps, { provider: "groq", model: "" }]);

  return (
    <div>
      <div className="space-y-2">
        {steps.length === 0 && (
          <p className="text-xs text-fg/45">No fallbacks — only the primary model is used.</p>
        )}
        {steps.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="w-4 text-xs text-fg/45">{i + 1}.</span>
            <select
              className="input w-24 shrink-0"
              value={s.provider}
              onChange={(e) => setStep(i, { provider: e.target.value as ModelStep["provider"], model: "" })}
            >
              <option value="groq">Groq</option>
              <option value="gemini">Gemini</option>
            </select>
            <div className="min-w-[8rem] flex-1">
              <ModelField
                id={`${idBase}-${i}`}
                value={s.model}
                onChange={(v) => setStep(i, { model: v })}
                options={s.provider === "groq" ? groqOptions : geminiOptions}
                placeholder="model id"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="btn-ghost !px-2.5 !py-1.5 text-xs"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="btn-ghost mt-2 !py-1.5 text-xs">
        ＋ Add fallback
      </button>
    </div>
  );
}

const LANGS = [
  { value: "auto", label: "Auto-detect (match the sender)" },
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "hinglish", label: "Hinglish" },
  { value: "english-slang", label: "English + slang" },
];

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly (witty / roasty)" },
  { value: "flirty", label: "Flirty" },
];

/* --------------------------------- form ----------------------------------- */

export function SettingsForm({
  settings,
  onSave,
  onLock,
  onFetchModels,
  onPreviewVoice,
}: {
  settings: Settings;
  onSave: (patch: any) => Promise<void>;
  onLock: () => void;
  onFetchModels: () => Promise<ModelsResult>;
  onPreviewVoice: (voice: string, model: string) => Promise<VoicePreview>;
}) {
  const [groqKey, setGroqKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [chatChain, setChatChain] = useState<ModelStep[]>(settings.chatChain || []);
  const [visionChain, setVisionChain] = useState<ModelStep[]>(settings.visionChain || []);
  const [language, setLanguage] = useState(settings.language);
  const [tone, setTone] = useState(settings.tone);
  // Write-only fields: start empty; a non-empty value REPLACES what's stored.
  const [ownerProfile, setOwnerProfile] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [replyDelayMs, setReplyDelayMs] = useState(settings.replyDelayMs);
  const [replyToGroups, setReplyToGroups] = useState(settings.replyToGroups);
  const [manualReply, setManualReply] = useState(settings.manualReply);
  const [hideSensitive, setHideSensitive] = useState(settings.hideSensitive);
  const [typingIndicator, setTypingIndicator] = useState(settings.typingIndicator);
  const [contactMemoryEnabled, setContactMemoryEnabled] = useState(settings.contactMemoryEnabled);
  const [personaMode, setPersonaMode] = useState(settings.personaMode);
  const [testNumbers, setTestNumbers] = useState(settings.testNumbers || "");
  const [attentionAlerts, setAttentionAlerts] = useState(settings.attentionAlerts);
  const [attentionHold, setAttentionHold] = useState(settings.attentionHold);
  const [groqOnly, setGroqOnly] = useState(settings.groqOnly);
  const [voiceReplies, setVoiceReplies] = useState(settings.voiceReplies);
  const [whisperModel, setWhisperModel] = useState(settings.whisperModel);
  const [ttsModel, setTtsModel] = useState(settings.ttsModel);
  const [ttsVoice, setTtsVoice] = useState(settings.ttsVoice);
  const [accessKey, setAccessKey] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [previewing, setPreviewing] = useState(false);
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);

  async function playVoice() {
    setPreviewing(true);
    setPreviewMsg(null);
    try {
      const res = await onPreviewVoice(ttsVoice, ttsModel);
      if (res?.ok && res.base64) {
        const audio = new Audio(`data:${res.mimetype || "audio/wav"};base64,${res.base64}`);
        await audio.play();
      } else {
        setPreviewMsg(res?.error || "Couldn't generate a preview for this voice/model.");
      }
    } catch (e: any) {
      setPreviewMsg(e?.message || "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  const [models, setModels] = useState<ModelsResult | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsMsg, setModelsMsg] = useState<string | null>(null);

  // Re-seed when settings change from the server.
  useEffect(() => {
    setChatChain(settings.chatChain || []);
    setVisionChain(settings.visionChain || []);
    setLanguage(settings.language);
    setTone(settings.tone);
    setOwnerProfile(""); // write-only — cleared after save/refresh
    setSystemPrompt("");
    setReplyDelayMs(settings.replyDelayMs);
    setReplyToGroups(settings.replyToGroups);
    setManualReply(settings.manualReply);
    setHideSensitive(settings.hideSensitive);
    setTypingIndicator(settings.typingIndicator);
    setContactMemoryEnabled(settings.contactMemoryEnabled);
    setPersonaMode(settings.personaMode);
    setTestNumbers(settings.testNumbers || "");
    setAttentionAlerts(settings.attentionAlerts);
    setAttentionHold(settings.attentionHold);
    setGroqOnly(settings.groqOnly);
    setVoiceReplies(settings.voiceReplies);
    setWhisperModel(settings.whisperModel);
    setTtsModel(settings.ttsModel);
    setTtsVoice(settings.ttsVoice);
  }, [settings]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsMsg(null);
    try {
      const res = await onFetchModels();
      if (res?.ok) {
        setModels(res);
        let msg = `Loaded ${res.groq?.all?.length || 0} Groq · ${res.gemini?.all?.length || 0} Gemini models`;
        if (res.errors?.groq) msg += ` · Groq: ${res.errors.groq}`;
        if (res.errors?.gemini) msg += ` · Gemini: ${res.errors.gemini}`;
        setModelsMsg(msg);
      } else {
        setModelsMsg(res?.error || "Could not fetch models. Save your API keys first.");
      }
    } catch (e: any) {
      setModelsMsg(e?.message || "Failed to fetch models");
    } finally {
      setModelsLoading(false);
    }
  }, [onFetchModels]);

  // Auto-load discovered models on mount if at least one key is already saved.
  useEffect(() => {
    if (settings.hasGroqKey || settings.hasGeminiKey) loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groqChat = models?.groq?.chat || [];
  const groqVision = models?.groq?.vision || [];
  const groqWhisper = models?.groq?.whisper || [];
  const groqTts = models?.groq?.tts || [];
  const geminiChat = models?.gemini?.chat || [];
  const geminiVision = models?.gemini?.vision || [];
  const voices = models?.voices || [];

  async function save() {
    setSaving(true);
    const patch: any = {
      chatChain: chatChain.filter((s) => s.model && s.model.trim()),
      visionChain: visionChain.filter((s) => s.model && s.model.trim()),
      language,
      tone,
      ownerProfile,
      systemPrompt,
      replyDelayMs,
      replyToGroups,
      manualReply,
      hideSensitive,
      typingIndicator,
      contactMemoryEnabled,
      personaMode,
      testNumbers,
      attentionAlerts,
      attentionHold,
      groqOnly,
      voiceReplies,
      whisperModel,
      ttsModel,
      ttsVoice,
    };
    if (groqKey.trim()) patch.groqApiKey = groqKey.trim();
    if (geminiKey.trim()) patch.geminiApiKey = geminiKey.trim();
    if (accessKey.trim() && !settings.accessKeyLocked) patch.accessKey = accessKey.trim();

    await onSave(patch);
    setGroqKey("");
    setGeminiKey("");
    setAccessKey("");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    // Keys may have changed → refresh discovered models.
    loadModels();
  }

  return (
    <div className="space-y-5">
      {/* AI providers */}
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-fg/60">AI providers</h2>
          <button type="button" onClick={loadModels} className="btn-ghost !py-1.5 text-xs" disabled={modelsLoading}>
            {modelsLoading ? "Fetching…" : "↻ Refresh models from keys"}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">
              Groq API key(s){" "}
              {settings.hasGroqKey && (
                <span className="text-wa-green">
                  • {settings.groqKeyCount && settings.groqKeyCount > 1 ? `${settings.groqKeyCount} keys set` : "set"}
                </span>
              )}
            </label>
            <input
              type="password"
              className="input"
              placeholder={settings.hasGroqKey ? "•••••••• (leave blank to keep)" : "gsk_… , gsk_… (comma-separated)"}
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
            />
            <p className="mt-1 text-[11px] leading-relaxed text-fg/45">
              💡 Paste <b>multiple free keys separated by commas</b> (<code className="text-fg/60">key1,key2</code>) to multiply
              your daily limit — the app auto-rotates to the next key when one is rate-limited. Re-enter all keys together to change them.
            </p>
          </div>
          <div>
            <label className="label">
              Gemini API key {settings.hasGeminiKey && <span className="text-wa-green">• set</span>}
            </label>
            <input
              type="password"
              className="input"
              placeholder={settings.hasGeminiKey ? "•••••••• (leave blank to keep)" : "AIza…"}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
            />
          </div>
        </div>
        {modelsMsg && <p className="mt-2 text-xs text-fg/45">{modelsMsg}</p>}
        <p className="mt-1 text-xs text-fg/40">
          Models below are pulled live from your keys. Save a new key, then hit “Refresh models”.
        </p>
      </section>

      {/* Text / chat models */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-fg/60">
          Text reply models
        </h2>
        <p className="mb-4 text-xs text-fg/45">
          Tried top to bottom — the <b className="text-fg/75">first</b> is primary, the rest are fallbacks if one fails or is rate-limited. Reorder providers as you like.
        </p>
        <ChainEditor
          steps={chatChain}
          onChange={setChatChain}
          groqOptions={groqChat}
          geminiOptions={geminiChat}
          idBase="chat-chain"
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Global reply language</label>
            <select className="input" value={language} onChange={(e) => setLanguage(e.target.value as any)}>
              {LANGS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Global reply tone</label>
            <select className="input" value={tone} onChange={(e) => setTone(e.target.value as any)}>
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-1 text-xs text-fg/45">Tone is a per-chat default — override it per chat from the conversation header.</p>
      </section>

      {/* Vision models */}
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-fg/60">
          Image (vision) reply models
        </h2>
        <p className="mb-4 text-xs text-fg/45">
          For images. Groq (llama-4-scout) is first because free-tier Gemini vision is often rate-limited (429). Add/reorder as you like.
        </p>
        <ChainEditor
          steps={visionChain}
          onChange={setVisionChain}
          groqOptions={groqVision}
          geminiOptions={geminiVision}
          idBase="vision-chain"
        />
      </section>

      {/* Voice */}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-fg/60">Voice notes</h2>
        <div className="mb-3 flex items-center gap-3">
          <Toggle checked={voiceReplies} onChange={setVoiceReplies} />
          <span className="text-sm text-fg/90">Reply to voice notes with a voice note</span>
        </div>
        <p className="mb-4 text-xs text-fg/45">
          Best-effort — falls back to a text reply if TTS is unavailable for your account.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label">Transcription (Whisper)</label>
            <ModelField id="whisper" value={whisperModel} onChange={setWhisperModel} options={groqWhisper} placeholder="whisper-large-v3" />
          </div>
          <div>
            <label className="label">TTS model</label>
            <ModelField id="tts-model" value={ttsModel} onChange={setTtsModel} options={groqTts} placeholder="playai-tts" />
          </div>
          <div>
            <label className="label">Reply voice</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <ModelField id="tts-voice" value={ttsVoice} onChange={setTtsVoice} options={voices} placeholder="Fritz-PlayAI" />
              </div>
              <button
                type="button"
                onClick={playVoice}
                disabled={previewing}
                title="Play a sample of this voice"
                className="btn-primary shrink-0 !px-3"
              >
                {previewing ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-fg/10 border-t-ink-950" />
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Play
                  </>
                )}
              </button>
            </div>
            {previewMsg && <p className="mt-1 text-xs text-amber-300">{previewMsg}</p>}
          </div>
        </div>
      </section>

      {/* Behaviour */}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-fg/60">Behaviour</h2>
        <div className="mb-4">
          <label className="label">
            Global persona / system prompt{" "}
            {settings.hasSystemPrompt && <span className="chip bg-fg/5 !py-0.5 text-wa-green">set · hidden</span>}
          </label>
          <textarea
            className="input min-h-[90px] resize-y"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder={
              settings.hasSystemPrompt
                ? "Configured — contents stay on the server. Type here to REPLACE it; leave empty to keep it."
                : "How the bot should behave when replying on your behalf…"
            }
          />
        </div>
        <div className="mb-4">
          <label className="label">
            About you (owner profile){" "}
            {settings.hasOwnerProfile && <span className="chip bg-fg/5 !py-0.5 text-wa-green">set · hidden</span>}
          </label>
          <textarea
            className="input min-h-[90px] resize-y"
            value={ownerProfile}
            onChange={(e) => setOwnerProfile(e.target.value)}
            placeholder={
              settings.hasOwnerProfile
                ? "Configured — contents stay on the server. Type here to REPLACE it; leave empty to keep it."
                : "Who you are — so the bot can answer questions about you and always defends you."
            }
          />
          <p className="mt-1 text-xs text-fg/45">
            For privacy, these prompts are write-only: the dashboard never receives their contents — you can only replace them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <label className="label">Reply delay (ms)</label>
            <input
              type="number"
              className="input w-32"
              min={0}
              step={100}
              value={replyDelayMs}
              onChange={(e) => setReplyDelayMs(Number(e.target.value))}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-fg/75">
            <Toggle checked={replyToGroups} onChange={setReplyToGroups} />
            Also reply in groups
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Toggle checked={manualReply} onChange={setManualReply} />
          <div>
            <span className="text-sm text-fg/90">Manual mode (draft, don&apos;t auto-send)</span>
            <p className="text-xs text-fg/45">The AI writes a suggested reply for you to review and send yourself. Override per chat from the conversation header.</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Toggle checked={hideSensitive} onChange={setHideSensitive} />
          <div>
            <span className="text-sm text-fg/90">Hide &amp; never reply to sensitive messages</span>
            <p className="text-xs text-fg/45">OTPs, bank/transaction alerts and promotional messages are hidden from the dashboard and never auto-replied to.</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Toggle checked={typingIndicator} onChange={setTypingIndicator} />
          <div>
            <span className="text-sm text-fg/90">Show &ldquo;typing…&rdquo; before replying</span>
            <p className="text-xs text-fg/45">The recipient sees a typing indicator, so replies feel human.</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Toggle checked={contactMemoryEnabled} onChange={setContactMemoryEnabled} />
          <div>
            <span className="text-sm text-fg/90">Remember facts about contacts</span>
            <p className="text-xs text-fg/45">The bot learns durable facts about each person over time and uses them in replies. Edit or clear a chat&apos;s memory from its header.</p>
          </div>
        </div>
        <div className="mt-4">
          <label className="label">✨ Chatbot persona</label>
          <select className="input" value={personaMode} onChange={(e) => setPersonaMode(e.target.value as any)}>
            <option value="off">Off — use my normal reply style</option>
            <option value="flirty">Flirty — charming, playful, lightly flirty</option>
            <option value="friendly">Friendly — calm, witty, approachable</option>
          </select>
          <p className="mt-1 text-xs text-fg/45">
            When a persona is on, replies take on that personality and run on the <b>free persona chat service</b> — no Groq/Gemini
            tokens (falls back to your cheap 8B model if it&apos;s down). Images are described by vision once, then the persona replies.
            Everything else still applies: manual-draft vs auto-send, language, memory, guards, per-chat toggles and @bot/@yati.
            A per-chat custom persona still overrides this.
          </p>
        </div>
        <div className="mt-4">
          <label className="label">🧪 Testing number(s)</label>
          <input
            className="input"
            value={testNumbers}
            onChange={(e) => setTestNumbers(e.target.value)}
            placeholder="e.g. 919812345678, 447700900123"
            inputMode="tel"
          />
          <p className="mt-1 text-xs text-fg/45">
            Any chat matching one of these numbers auto-replies regardless of its per-chat toggle — so you can flip the persona
            above and test it instantly. Comma-separate multiple numbers; the country code is optional. Leave blank to disable.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Toggle checked={attentionAlerts} onChange={setAttentionAlerts} />
          <div>
            <span className="text-sm text-fg/90">🔔 Alert me when a message needs ME</span>
            <p className="text-xs text-fg/45">
              Pushes a notification when someone asks things only you can answer — &ldquo;when will you be free?&rdquo;, &ldquo;where are you?&rdquo;,
              duty/shift questions, urgent matters, money requests, meeting plans, or a decision/confirmation. Needs browser notifications enabled (bell icon in the header).
            </p>
          </div>
        </div>
        {attentionAlerts && (
          <div className="ml-2 mt-3 flex items-center gap-3 border-l-2 border-amber-400/30 pl-4">
            <Toggle checked={attentionHold} onChange={setAttentionHold} size="sm" />
            <div>
              <span className="text-sm text-fg/90">Hold the auto-reply for those messages</span>
              <p className="text-xs text-fg/45">Instead of auto-sending, the AI drafts a reply into the composer so YOU answer personally. Turn off to notify but still auto-reply.</p>
            </div>
          </div>
        )}
      </section>

      {/* Privacy */}
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-fg/60">Privacy &amp; data</h2>
        <p className="mb-4 text-xs leading-relaxed text-fg/45">
          Everything runs on your own machine — your chats and login never leave it except for the AI calls that generate replies.
          <b className="text-fg/75"> Groq</b> (your primary provider) does not use API inputs/outputs to train models.
          <b className="text-fg/75"> Google Gemini</b> free-tier <i>can</i> use data to improve its products — so for maximum privacy, keep everything on Groq.
        </p>
        <div className="flex items-center gap-3">
          <Toggle checked={groqOnly} onChange={setGroqOnly} />
          <div>
            <span className="text-sm text-fg/90">Groq only — never send anything to Google Gemini</span>
            <p className="text-xs text-fg/45">Skips all Gemini steps in the model chains, so no message data ever reaches Google.</p>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-fg/60">Security</h2>
        <label className="label flex items-center gap-2">
          Dashboard access key
          {settings.accessKeyLocked && <span className="chip bg-fg/5 !py-0.5 text-amber-300">managed by .env</span>}
        </label>
        <input
          type="password"
          className="input md:w-1/2"
          placeholder={settings.accessKeyLocked ? "Locked — change ACCESS_KEY in .env" : "Enter a new access key to change it…"}
          value={accessKey}
          disabled={settings.accessKeyLocked}
          onChange={(e) => setAccessKey(e.target.value)}
        />
        <p className="mt-1 text-xs text-fg/45">You&apos;ll need to unlock again with the new key.</p>
        <div className="mt-4">
          <button type="button" onClick={onLock} className="btn-danger">
            Lock dashboard
          </button>
        </div>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-fg/5 bg-surface-2/90 px-4 py-3 backdrop-blur">
        {saved && <span className="text-sm text-wa-green">Saved ✓</span>}
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
