"use client";

import { useEffect, useRef, useState } from "react";

type Lang = "en" | "hi" | "mr";
type State = "idle" | "listening-wake" | "listening-question" | "thinking" | "speaking";

const LANG_LABELS: Record<Lang, { name: string; flag: string; voice: string }> = {
  en: { name: "English",  flag: "🇬🇧", voice: "en-IN" },
  hi: { name: "हिन्दी",    flag: "🇮🇳", voice: "hi-IN" },
  mr: { name: "मराठी",     flag: "🇮🇳", voice: "mr-IN" },
};

const GREETINGS: Record<Lang, string> = {
  en: "Namaste. I'm Maya, your FINMIND AI assistant. Say 'Hey Maya' anytime to ask me a question. I can help with revenue, EBITDA, profit, vertical performance, and AOP.",
  hi: "नमस्ते। मैं Maya हूँ, आपकी FINMIND AI सहायक। कुछ भी पूछने के लिए 'Hey Maya' कहें। मैं Revenue, EBITDA, profit, vertical प्रदर्शन और AOP में सहायता कर सकती हूँ।",
  mr: "नमस्कार. मी Maya, तुमची FINMIND AI सहायक आहे. काहीही विचारण्यासाठी 'Hey Maya' म्हणा. मी Revenue, EBITDA, profit, vertical कामगिरी आणि AOP बाबत मदत करू शकते.",
};

const WAKE_ACK: Record<Lang, string> = {
  en: "Yes, I'm listening.",
  hi: "हाँ, मैं सुन रही हूँ।",
  mr: "होय, मी ऐकत आहे.",
};

const QUICK_PROMPTS: Record<Lang, string[]> = {
  en: ["Tell me the profit", "What is our revenue?", "How is EBITDA?", "Show worst vertical"],
  hi: ["Profit बताओ", "Revenue क्या है?", "EBITDA कैसा है?", "सबसे कम vertical दिखाओ"],
  mr: ["Profit सांगा", "Revenue किती आहे?", "EBITDA कशी आहे?", "सर्वात कमी vertical दाखवा"],
};

// Wake-word variants (case-insensitive substring match)
const WAKE_WORDS = ["hey maya", "hi maya", "ok maya", "he maya", "हे माया", "हाय माया", "अरे माया"];

type Message = { role: "user" | "maya"; text: string };

export default function MayaPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [lang, setLang] = useState<Lang>("en");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<State>("idle");
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wakeActiveRef = useRef(false);
  const questionModeRef = useRef(false);

  // Initial greeting
  useEffect(() => {
    if (open && messages.length === 0) {
      const greet: Message = { role: "maya", text: GREETINGS[lang] };
      setMessages([greet]);
      speak(GREETINGS[lang]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Stop wake listening when panel closes
  useEffect(() => {
    if (!open && wakeActiveRef.current) {
      stopWakeListening();
    }
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG_LABELS[lang].voice;
    u.rate = 0.95;
    u.pitch = 1.05;
    u.onstart = () => setState("speaking");
    u.onend = () => {
      setState(wakeActiveRef.current ? "listening-wake" : "idle");
      // After Maya finishes speaking, resume wake listening
      if (wakeActiveRef.current) setTimeout(() => startWakeListening(true), 200);
    };
    u.onerror = () => setState("idle");
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
  }

  function getSR() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    return SR;
  }

  function startWakeListening(silent = false) {
    if (typeof window === "undefined") return;
    const SR = getSR();
    if (!SR) {
      if (!silent) alert("Voice not supported in this browser. Try Chrome or Edge.");
      return;
    }
    // Cancel any prior recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    const rec = new SR();
    rec.lang = LANG_LABELS[lang].voice;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const lower = transcript.toLowerCase().trim();
      setLiveTranscript(lower);

      // Wake-word detection
      if (!questionModeRef.current) {
        const matched = WAKE_WORDS.find((w) => lower.includes(w));
        if (matched) {
          // Extract anything after the wake word as the immediate question
          const tail = lower.split(matched).pop()?.trim() ?? "";
          if (tail.length > 3) {
            // Wake word + question in same utterance — process immediately
            try { rec.stop(); } catch {}
            handleSend(tail);
          } else {
            // Just the wake word — acknowledge and listen for follow-up
            questionModeRef.current = true;
            try { rec.stop(); } catch {}
            speak(WAKE_ACK[lang]);
            setTimeout(() => startQuestionListening(), 1200);
          }
        }
      }
    };

    rec.onerror = (e: any) => {
      // Most errors are silent; just restart
      if (wakeActiveRef.current && e?.error !== "aborted") {
        setTimeout(() => startWakeListening(true), 500);
      }
    };

    rec.onend = () => {
      // Auto-restart wake listening if still enabled
      if (wakeActiveRef.current && !questionModeRef.current) {
        setTimeout(() => startWakeListening(true), 300);
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      wakeActiveRef.current = true;
      setWakeEnabled(true);
      setState("listening-wake");
    } catch (e) {
      // Recognition already started — ignore
    }
  }

  function stopWakeListening() {
    wakeActiveRef.current = false;
    questionModeRef.current = false;
    setWakeEnabled(false);
    setState("idle");
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    setLiveTranscript("");
  }

  function startQuestionListening() {
    const SR = getSR();
    if (!SR) return;
    const rec = new SR();
    rec.lang = LANG_LABELS[lang].voice;
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      questionModeRef.current = false;
      handleSend(transcript);
    };
    rec.onerror = () => {
      questionModeRef.current = false;
      if (wakeActiveRef.current) startWakeListening(true);
    };
    rec.onend = () => {
      questionModeRef.current = false;
    };

    try {
      rec.start();
      setState("listening-question");
    } catch {}
  }

  function triggerSingleListen() {
    const SR = getSR();
    if (!SR) {
      alert("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    const rec = new SR();
    rec.lang = LANG_LABELS[lang].voice;
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event: any) => {
      handleSend(event.results[0][0].transcript);
    };
    rec.onend = () => setState(wakeActiveRef.current ? "listening-wake" : "idle");
    try {
      rec.start();
      setState("listening-question");
    } catch {}
  }

  /** Rule-based response engine. */
  function getResponse(question: string): string {
    const q = question.toLowerCase();
    const R: Record<string, Record<Lang, string>> = {
      revenue: {
        en: "Revenue this month is ₹342 Lakhs — 0.4% above AOP. Brokerage Income leads at ₹209L.",
        hi: "इस महीने Revenue ₹342 Lakhs है — AOP से 0.4% अधिक। Brokerage Income ₹209L के साथ सबसे आगे है।",
        mr: "या महिन्याचा Revenue ₹342 Lakhs आहे — AOP पेक्षा 0.4% जास्त. Brokerage Income ₹209L सह आघाडीवर आहे.",
      },
      profit: {
        en: "Net profit this month is ₹574 Lakhs. EBITDA stands at ₹851 Lakhs with a 28.2% margin. Year-to-date profit is up 12.3% versus last year.",
        hi: "इस महीने का Net Profit ₹574 Lakhs है। EBITDA ₹851 Lakhs है 28.2% margin के साथ। साल-दर-साल profit पिछले साल से 12.3% बढ़ा है।",
        mr: "या महिन्याचा Net Profit ₹574 Lakhs आहे. EBITDA ₹851 Lakhs आहे 28.2% margin सह. वर्ष-दर-वर्ष profit मागील वर्षाच्या तुलनेत 12.3% वाढला आहे.",
      },
      ebitda: {
        en: "EBITDA for the month is ₹851 Lakhs — 28.2% margin. Slightly below last year's 27.6% — watch overhead.",
        hi: "इस महीने EBITDA ₹851 Lakhs है — 28.2% margin। पिछले साल के 27.6% से थोड़ा कम — Overhead पर ध्यान दें।",
        mr: "या महिन्याचा EBITDA ₹851 Lakhs आहे — 28.2% margin. गेल्या वर्षीच्या 27.6% पेक्षा थोडा कमी — Overhead वर लक्ष ठेवा.",
      },
      vertical: {
        en: "Lowest-performing vertical is Asheesh Handa's SME team at ₹2.37L — 5.7% below AOP. They need pipeline support.",
        hi: "सबसे कम performing vertical Asheesh Handa की SME team है ₹2.37L पर — AOP से 5.7% कम। Pipeline support की जरूरत है।",
        mr: "सर्वात कमी performing vertical Asheesh Handa ची SME team आहे ₹2.37L वर — AOP पेक्षा 5.7% कमी. Pipeline support हवी आहे.",
      },
      aop: {
        en: "AOP achievement is 105.6% in April and 104.5% in September. 9 of 15 verticals are above target.",
        hi: "AOP achievement अप्रैल में 105.6% और सितंबर में 104.5% है। 15 में से 9 verticals target से ऊपर हैं।",
        mr: "AOP achievement एप्रिलमध्ये 105.6% आणि सप्टेंबरमध्ये 104.5% आहे. 15 पैकी 9 verticals target च्या वर आहेत.",
      },
      forecast: {
        en: "Full-year LE projects ₹3887 Lakhs revenue — 5.5% above AOP. EBITDA LE is ₹2414 Lakhs.",
        hi: "Full Year LE ₹3887 Lakhs revenue का अनुमान है — AOP से 5.5% अधिक। EBITDA LE ₹2414 Lakhs है।",
        mr: "Full Year LE ₹3887 Lakhs revenue चा अंदाज आहे — AOP पेक्षा 5.5% जास्त. EBITDA LE ₹2414 Lakhs आहे.",
      },
      vpb: {
        en: "VPB pool is ₹107 Lakhs at 84% — 9 of 15 verticals qualifying. 2 BHs below threshold need attention.",
        hi: "VPB pool ₹107 Lakhs 84% पर है — 15 में से 9 verticals qualify कर रहे हैं। 2 BHs below threshold पर ध्यान चाहिए।",
        mr: "VPB pool ₹107 Lakhs 84% वर आहे — 15 पैकी 9 verticals qualify होत आहेत. 2 BHs below threshold वर लक्ष द्यावे.",
      },
      cashflow: {
        en: "Operating cash flow is ₹892 Lakhs, investing outflow is ₹245 Lakhs, financing is negative ₹128 Lakhs. Net cash position: ₹519 Lakhs — strong.",
        hi: "Operating cash flow ₹892 Lakhs है, Investing outflow ₹245 Lakhs, Financing negative ₹128 Lakhs। Net cash position ₹519 Lakhs — मज़बूत।",
        mr: "Operating cash flow ₹892 Lakhs आहे, Investing outflow ₹245 Lakhs, Financing negative ₹128 Lakhs. Net cash position ₹519 Lakhs — मजबूत.",
      },
    };

    if (/profit|pat|प्रॉफिट|प्रोफ़िट|नफा|लाभ/.test(q)) return R.profit[lang];
    if (/revenue|brokerage|रेवेन्यू|राजस्व|उत्पन्न/.test(q)) return R.revenue[lang];
    if (/ebitda|एबिटडा|मार्जिन/.test(q)) return R.ebitda[lang];
    if (/vertical|worst|low|कम|कमी|वर्टिकल/.test(q)) return R.vertical[lang];
    if (/aop|achievement|एओपी|बजट/.test(q)) return R.aop[lang];
    if (/forecast|le |latest estimate|अनुमान/.test(q)) return R.forecast[lang];
    if (/vpb|variable pay|incentive|प्रोत्साहन/.test(q)) return R.vpb[lang];
    if (/cash|cashflow|कैश|रोख/.test(q)) return R.cashflow[lang];

    const fallback = {
      en: "I can help with revenue, profit, EBITDA, EBITDA margin, vertical performance, AOP, LE/forecast, VPB, and cash flow. Could you rephrase?",
      hi: "मैं Revenue, Profit, EBITDA, Margin, Vertical performance, AOP, LE/Forecast, VPB और Cash Flow में सहायता कर सकती हूँ। दोबारा कहें?",
      mr: "मी Revenue, Profit, EBITDA, Margin, Vertical performance, AOP, LE/Forecast, VPB आणि Cash Flow मध्ये मदत करू शकते. कृपया पुन्हा सांगा.",
    };
    return fallback[lang];
  }

  async function handleSend(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text) return;
    setLiveTranscript("");
    const userMsg: Message = { role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setState("thinking");

    // Try Claude API first; fall back to rule-based on error/no-key
    let reply: string;
    try {
      const history = messages
        .slice(-6)
        .map((m) => ({ role: m.role === "maya" ? "assistant" : "user", content: m.text }));
      const res = await fetch("/api/maya", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, lang, history }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        reply = data.text;
      } else {
        // 503 (no API key) or 500 — silent fallback to rule-based
        reply = getResponse(text);
      }
    } catch {
      reply = getResponse(text);
    }

    const replyMsg: Message = { role: "maya", text: reply };
    setMessages((m) => [...m, replyMsg]);
    setTimeout(() => speak(reply), 200);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-stretch justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white shadow-deep flex flex-col h-screen animate-fade-up"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] bg-gradient-to-br from-navy to-navy-800 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-edred to-edred-600 flex items-center justify-center text-[16px] font-bold relative">
              M
              {(state === "listening-wake" || state === "listening-question") && (
                <span className="absolute inset-0 rounded-full border-2 border-edgreen animate-ping" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-serif text-[18px] font-bold leading-none">Maya</div>
              <div className="text-[11px] text-white/70 mt-1 flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    state === "speaking"
                      ? "bg-gold animate-blink"
                      : state === "listening-wake"
                      ? "bg-edgreen animate-blink"
                      : state === "listening-question"
                      ? "bg-edred animate-blink"
                      : state === "thinking"
                      ? "bg-edpurple animate-blink"
                      : "bg-white/40"
                  }`}
                />
                {state === "listening-wake"
                  ? "Listening for 'Hey Maya'…"
                  : state === "listening-question"
                  ? "Listening to your question…"
                  : state === "speaking"
                  ? "Speaking…"
                  : state === "thinking"
                  ? "Thinking…"
                  : "Ready"}
              </div>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-[18px] px-2">
              ✕
            </button>
          </div>

          {/* Wake-word toggle */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-white/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[15px]">👂</span>
              <div>
                <div className="text-[12px] font-semibold">Wake word: Hey Maya</div>
                <div className="text-[10px] text-white/55">
                  Say &quot;Hey Maya&quot; anywhere on the page
                </div>
              </div>
            </div>
            <button
              onClick={() => (wakeEnabled ? stopWakeListening() : startWakeListening())}
              className={`relative w-11 h-6 rounded-full transition ${
                wakeEnabled ? "bg-edgreen" : "bg-white/20"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${
                  wakeEnabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {/* Language picker */}
          <div className="mt-2.5 flex gap-1.5 p-0.5 rounded-lg bg-white/10">
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLang(l);
                  if (wakeActiveRef.current) {
                    stopWakeListening();
                    setTimeout(() => startWakeListening(), 200);
                  }
                }}
                className={`flex-1 py-1.5 rounded-md text-[11.5px] font-semibold transition ${
                  lang === l ? "bg-white text-navy" : "text-white/70 hover:text-white"
                }`}
              >
                {LANG_LABELS[l].flag} {LANG_LABELS[l].name}
              </button>
            ))}
          </div>
        </div>

        {/* Live transcript (during wake listening) */}
        {wakeEnabled && liveTranscript && (
          <div className="px-4 py-2 bg-edgreen-50/50 border-b border-edgreen/20 text-[11px] text-edgreen italic font-mono">
            heard: {liveTranscript}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-bg">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-navy text-white rounded-br-sm"
                    : "bg-white border border-[var(--border)] text-ink rounded-bl-sm shadow-soft"
                }`}
              >
                {m.text}
                {m.role === "maya" && i === messages.length - 1 && state !== "speaking" && (
                  <button
                    onClick={() => speak(m.text)}
                    className="ml-2 text-navy hover:text-edred"
                    title="Replay"
                  >
                    🔊
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex gap-1.5 flex-wrap">
            {QUICK_PROMPTS[lang].map((p, i) => (
              <button
                key={i}
                onClick={() => handleSend(p)}
                className="px-3 py-1.5 rounded-full text-[11px] bg-bg-alt border border-[var(--border)] text-ink-muted hover:border-navy hover:text-navy transition"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-[var(--border)] bg-white flex items-center gap-2">
          <button
            onClick={triggerSingleListen}
            className={`w-10 h-10 rounded-full flex items-center justify-center text-[18px] flex-shrink-0 transition ${
              state === "listening-question"
                ? "bg-edred text-white animate-pulse"
                : "bg-navy text-white hover:bg-navy-800"
            }`}
            title="Tap to ask once"
          >
            🎤
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              lang === "en"
                ? "Type or say 'Hey Maya…'"
                : lang === "hi"
                ? "लिखें या कहें 'Hey Maya…'"
                : "लिहा किंवा म्हणा 'Hey Maya…'"
            }
            className="flex-1 rounded-full border border-[var(--border)] bg-bg-alt px-4 py-2 text-sm focus:border-navy focus:bg-white outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-edred to-edred-600 text-white flex items-center justify-center text-[18px] flex-shrink-0 hover:brightness-110 disabled:opacity-50"
            title="Send"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
