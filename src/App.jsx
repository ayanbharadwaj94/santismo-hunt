import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Santismo Christmas Horror Hunt (React + Vite)
 * - iPhone Safari friendly (audio needs a tap to unlock)
 * - Uses Web Speech API (speechSynthesis) for the "scary Santa" voice
 * - Saves progress to localStorage
 * - Reveal-only "Haunted House" map overlay after each successful unlock
 */

const STORAGE_KEY = "santismo_hunt_v2";

function normalize(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

function pickVoice(voices) {
  const preferred = [/santa/i, /daniel/i, /alex/i, /fred/i, /en-us/i, /english/i];
  for (const rx of preferred) {
    const v = voices.find((vv) => rx.test(`${vv.name} ${vv.lang}`));
    if (v) return v;
  }
  return voices[0] || null;
}

function speak(text, opts = {}) {
  if (typeof window === "undefined") return;
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;

  const { rate = 0.92, pitch = 0.72, volume = 1, voice = null } = opts;

  try {
    window.speechSynthesis.cancel();
  } catch {}

  const u = new window.SpeechSynthesisUtterance(text);
  u.rate = rate;
  u.pitch = pitch;
  u.volume = volume;
  if (voice) u.voice = voice;

  window.speechSynthesis.speak(u);
}

function useLocalStorageState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initialValue;
      return JSON.parse(raw);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);

  return [state, setState];
}

function useTypewriter(fullText, speed, deps = []) {
  const [shown, setShown] = useState("");
  const idxRef = useRef(0);

  useEffect(() => {
    idxRef.current = 0;
    setShown("");
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      idxRef.current += 1;
      setShown(fullText.slice(0, idxRef.current));
      if (idxRef.current < fullText.length) setTimeout(tick, speed);
    };

    setTimeout(tick, Math.max(10, speed));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, speed, ...deps]);

  return shown;
}

/**
 * Semi-abstract zone map for your house (reveal-only overlay).
 * No labels; just shapes + fog + pulse.
 */
const ZONES = {
  // Upstairs cluster
  up_corridor: { x: 52, y: 22, w: 86, h: 20 },
  up_bedroom_current: { x: 16, y: 10, w: 56, h: 28 },
  up_guest_bedroom: { x: 16, y: 44, w: 56, h: 30 },
  up_guest_closet: { x: 76, y: 48, w: 36, h: 18 },
  up_master_bedroom: { x: 116, y: 42, w: 66, h: 34 },
  up_master_bath: { x: 146, y: 78, w: 36, h: 22 },
  stairs_transition: { x: 96, y: 18, w: 18, h: 10 },

  // Downstairs cluster
  entry_spine: { x: 72, y: 122, w: 54, h: 20 },
  study: { x: 20, y: 112, w: 44, h: 30 },
  kitchen: { x: 84, y: 148, w: 66, h: 36 },
  christmas_room_fireplace: { x: 154, y: 146, w: 66, h: 38 },
  christmas_room_sofa: { x: 154, y: 188, w: 66, h: 28 },
  formal_living_empty: { x: 20, y: 150, w: 54, h: 40 },
  down_bath: { x: 64, y: 188, w: 32, h: 24 },
  laundry: { x: 20, y: 196, w: 44, h: 26 },
  back_door: { x: 110, y: 188, w: 38, h: 18 },

  // Outside
  yard_path: { x: 92, y: 226, w: 60, h: 12 },
  shed_final: { x: 168, y: 232, w: 44, h: 26 },
};

function zoneGroup(zoneId) {
  if (!zoneId) return "unknown";
  if (zoneId.startsWith("up_") || zoneId === "stairs_transition") return "up";
  if (zoneId === "yard_path" || zoneId === "shed_final") return "out";
  return "down";
}

function HauntedMapOverlay({ open, onClose, currentZone, visitedZones, shedUnlocked }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => onClose?.(), 3600);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  const visited = new Set(visitedZones || []);

  const zoneFill = (id) => {
    if (id === currentZone) return "rgba(220,38,38,0.28)";
    if (visited.has(id)) return "rgba(244,63,94,0.12)"; // dim red
    return "rgba(255,255,255,0.06)";
  };

  const zoneStroke = (id) => {
    if (id === currentZone) return "rgba(220,38,38,0.65)";
    if (visited.has(id)) return "rgba(244,63,94,0.25)";
    return "rgba(255,255,255,0.10)";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="text-xs tracking-widest text-zinc-400">THE HOUSE REMEMBERS</div>
          <button
            onClick={onClose}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs hover:bg-zinc-900/50"
          >
            Close
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-3xl border border-zinc-800 bg-black/30 p-3">
          <svg viewBox="0 0 240 270" className="h-[300px] w-full">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2.4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <radialGradient id="fog" cx="50%" cy="35%" r="70%">
                <stop offset="0%" stopColor="rgba(0,0,0,0.0)" />
                <stop offset="55%" stopColor="rgba(0,0,0,0.45)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.72)" />
              </radialGradient>
            </defs>

            {/* Subtle frame silhouettes */}
            <rect x="8" y="6" width="224" height="100" rx="18" fill="rgba(255,255,255,0.02)" />
            <rect x="8" y="108" width="224" height="120" rx="18" fill="rgba(255,255,255,0.02)" />
            <rect x="8" y="230" width="224" height="34" rx="18" fill="rgba(255,255,255,0.02)" />

            {/* Zones */}
            {Object.entries(ZONES).map(([id, r]) => {
              const isCurrent = id === currentZone;
              const isShed = id === "shed_final";

              const lockedShed = isShed && !shedUnlocked;
              const fill = lockedShed ? "rgba(59,130,246,0.08)" : zoneFill(id);
              const stroke = lockedShed ? "rgba(59,130,246,0.22)" : zoneStroke(id);

              const cls = isCurrent ? "zone zone-current" : visited.has(id) ? "zone zone-visited" : "zone zone-future";

              return (
                <g key={id} className={cls} filter={isCurrent ? "url(#glow)" : undefined}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="10" fill={fill} stroke={stroke} />
                  {/* Shed lock cross */}
                  {lockedShed && (
                    <g opacity="0.55">
                      <line x1={r.x + 6} y1={r.y + 6} x2={r.x + r.w - 6} y2={r.y + r.h - 6} stroke="rgba(59,130,246,0.35)" strokeWidth="3" />
                      <line x1={r.x + r.w - 6} y1={r.y + 6} x2={r.x + 6} y2={r.y + r.h - 6} stroke="rgba(59,130,246,0.35)" strokeWidth="3" />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Fog overlay */}
            <rect x="0" y="0" width="240" height="270" fill="url(#fog)" />

            {/* Outdoor path hint (only near end) */}
            {shedUnlocked && (
              <path
                d="M120 205 C130 210, 145 220, 170 235"
                fill="none"
                stroke="rgba(220,38,38,0.22)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}
          </svg>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          A faint glow is all you get. Santismo doesn’t like spoilers.
        </div>
      </div>

      <style>{`
        .zone-current { animation: pulse 1.8s ease-in-out infinite; }
        .zone-visited { opacity: 0.85; }
        .zone-future { opacity: 0.55; }
        @keyframes pulse {
          0% { opacity: 0.85; }
          50% { opacity: 1; }
          100% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

function mapRevealLine({ nextStepId, fromZone, toZone }) {
  // Special beats
  if (nextStepId === 7) {
    return "You’ve finished upstairs… good. Let’s see what waits below.";
  }
  if (nextStepId === 10) {
    return "Ah… warmth. Fire is comforting, isn’t it? It hides things so well.";
  }
  if (nextStepId === 16) {
    return "You’re leaving the house now… don’t worry. It’s still watching.";
  }
  if (nextStepId === 17) {
    return "I didn’t hide this far away… I hid it on purpose.";
  }
  if (nextStepId === 18) {
    return "You made it. The house accepts you… and so do I.";
  }

  // General pool, slightly aware of direction
  const fromG = zoneGroup(fromZone);
  const toG = zoneGroup(toZone);

  const pool = [
    "You were here… now you’re not.",
    "The house remembers your footsteps.",
    "Rooms change. So do people.",
    "You’re getting closer… I can feel it.",
    "Not that room anymore.",
  ];

  const directional = [];
  if (fromG === "up" && toG === "down") directional.push("Downstairs now… good choice.");
  if (fromG !== "out" && toG === "out") directional.push("Outside… where my laugh travels farther.");
  if (toG === "up") directional.push("Back upstairs? Brave.");

  const all = directional.length ? directional.concat(pool) : pool;
  return all[Math.floor(Math.random() * all.length)];
}

/**
 * FINAL STEPS (Santismo-coded answers)
 * Tip: Put a tiny note inside each gift: "CODE WORD: ____"
 */
const DEFAULT_STEPS = [
  {
    id: 1,
    zone: "up_corridor",
    title: "The Landing of Ominous Footsteps",
    riddle:
      "I am not a room, yet I know them all.\nI hear footsteps, whispers, late-night calls.\nChoices split beneath my stare…\nBegin with me, if you dare.",
    locationHint: "Upstairs corridor / landing",
    answer: "crossroads",
    santismoLine: "Ho… ho… holy matrimony. Type the code word. The house is listening.",
  },
  {
    id: 2,
    zone: "up_bedroom_current",
    title: "The Room You Actually Sleep In",
    riddle:
      "A kingdom of blankets faces the dawn,\nWhere nights are stolen and mornings are born.\nYou rest here now, safe from fright…\nBut Santismo watches every night.",
    locationHint: "Bedroom 1/2 (your current bedroom)",
    answer: "shared dreams",
    santismoLine: "New home. Same bed. Different fate. Code word… now.",
  },
  {
    id: 3,
    zone: "up_guest_bedroom",
    title: "Guest Chamber of Doom",
    riddle:
      "A lonely mattress sleeps on the ground,\nA lamp sits low without a sound.\nThis room is quiet… too quiet, I fear.\nSearch where visitors someday will be near.",
    locationHint: "Guest bedroom",
    answer: "spare soul",
    santismoLine: "Ah, the guest room. Where friends sleep… briefly. Code word.",
  },
  {
    id: 4,
    zone: "up_guest_closet",
    title: "Closet of a Thousand Sweaters",
    riddle:
      "Fabric hangs like skin on bone,\nOutfits waiting, all alone.\nI hide between the folds you wear…\nClothes remember who’s been there.",
    locationHint: "Guest closet",
    answer: "hidden threads",
    santismoLine: "I ate three socks to get here. Don’t ask which three. Code word.",
  },
  {
    id: 5,
    zone: "up_master_bedroom",
    title: "The Empty Master",
    riddle:
      "No bed. No chair. No laughter yet.\nA room untouched… but not forgotten.\nFind the gift where the little TV altar stands.\nTonight, the future stares back.",
    locationHint: "Master bedroom (empty; TV unit)",
    answer: "unwritten",
    santismoLine: "An empty room is perfect for haunting… and for beginnings. Code word.",
  },
  {
    id: 6,
    zone: "up_master_bath",
    title: "The Mirror’s Verdict",
    riddle:
      "Mirrors judge and water runs,\nSteam hides truths you can’t outrun.\nWash your hands… wash your past…\nSome reflections always last.",
    locationHint: "Master bathroom",
    answer: "clean sins",
    santismoLine: "I whisper into mirrors. They whisper back. Code word.",
  },
  {
    id: 7,
    zone: "stairs_transition",
    title: "Descend, Newlyweds",
    riddle:
      "Down the stairs you go…\nTo the spine of the house where arrivals and escapes are born.\nFind the next clue where the home gathers itself.",
    locationHint: "Downstairs entry spine / hallway",
    answer: "threshold",
    santismoLine: "Gravity pulls. So do I. Code word.",
  },
  {
    id: 8,
    zone: "study",
    title: "The Study of Sinister Plans",
    riddle:
      "A desk. A chair. A place to plot.\nWhere futures form in quiet thought.\nYou think you’re alone when you sit and write…\nI read over shoulders every night.",
    locationHint: "Study / office",
    answer: "ink pact",
    santismoLine: "Beware… the stapler. Code word.",
  },
  {
    id: 9,
    zone: "kitchen",
    title: "Kitchen — Heart of the House",
    riddle:
      "Counters gleam like icy lakes,\nAn island stands—lonely, proud.\nI haunt the place where snacks disappear…\nMidnight knows I’m always near.",
    locationHint: "Kitchen (island/cabinet/drawer)",
    answer: "midnight bite",
    santismoLine: "I can smell cookies through walls. Code word.",
  },
  {
    id: 10,
    zone: "christmas_room_fireplace",
    title: "The Christmas Hearth",
    riddle:
      "Fire burns but does not warn,\nLights glow bright, traditions born.\nStockings gape like hungry mouths…\nThis room remembers every oath.",
    locationHint: "Christmas living room (fireplace / tree area)",
    answer: "ember vow",
    santismoLine: "My laugh echoes in chimneys. Code word.",
  },
  {
    id: 11,
    zone: "christmas_room_sofa",
    title: "Sofa of Sudden Screams",
    riddle:
      "Cushions creak and secrets hide,\nBodies sink, realities slide.\nYou sit to watch… I sit to wait.\nComfort is how I infiltrate.",
    locationHint: "Christmas living room (sofa/TV zone)",
    answer: "soft trap",
    santismoLine: "If you hear creaking… that’s the sofa. Not me. Probably. Code word.",
  },
  {
    id: 12,
    zone: "formal_living_empty",
    title: "The Empty Living Room",
    riddle:
      "No furniture. No sound. No plan.\nA blank page waiting for your hand.\nEmpty rooms echo the loudest cries—\nPossibility never dies.",
    locationHint: "Formal living room (currently empty)",
    answer: "echo chamber",
    santismoLine: "Empty rooms are my favorite. More space for dramatic entrances. Code word.",
  },
  {
    id: 13,
    zone: "down_bath",
    title: "Bathroom Intermission",
    riddle:
      "Not for rest and not for play,\nYet visited every single day.\nSoap and mirrors know too much—\nI watch each hurried, human touch.",
    locationHint: "Downstairs bathroom",
    answer: "quick confession",
    santismoLine: "Wash your hands. Wash your soul. Code word.",
  },
  {
    id: 14,
    zone: "laundry",
    title: "Laundry Lab",
    riddle:
      "Round and round your garments scream,\nSacrificed for something clean.\nSocks vanish… don’t ask where they go.\nI need them. For reasons you don’t know.",
    locationHint: "Washer / utility room",
    answer: "spin cycle",
    santismoLine: "The dryer steals socks for my army. Code word.",
  },
  {
    id: 15,
    zone: "back_door",
    title: "Back Door Threshold",
    riddle:
      "Inside ends. Outside begins.\nCold air bites like sharpened sins.\nPause here once—breathe, then proceed.\nThe house lets go… reluctantly.",
    locationHint: "Back door area / shoe mat",
    answer: "last warmth",
    santismoLine: "Outside… I become more powerful. Code word.",
  },
  {
    id: 16,
    zone: "yard_path",
    title: "Backyard — The Quiet",
    riddle:
      "Grass remembers every step,\nSecrets buried, promises kept.\nAhead stands wood, quiet and small—\nThe final place that knows it all.",
    locationHint: "Backyard (path toward shed / near planter)",
    answer: "frozen ground",
    santismoLine: "Your breath is visible now. Good. Code word.",
  },
  {
    id: 17,
    zone: "shed_final",
    title: "Shed Door — Final Warning",
    riddle:
      "Hinges groan when truths are near,\nThis door separates love from fear.\nBefore you enter, say goodbye—\nSome endings change you. Some don’t lie.",
    locationHint: "Shed (at/near the door)",
    answer: "final knock",
    santismoLine: "I’m knocking from the inside. Just kidding. Mostly. Code word.",
  },
  {
    id: 18,
    zone: "shed_final",
    title: "THE TREASURE",
    riddle:
      "You made it to the end, brave soul.\nOpen the final gift and claim your blessing.\nThis house is yours now.\nSleep well… I’ll be watching.",
    locationHint: "Inside the shed (centerpiece)",
    answer: "homebound",
    santismoLine: "Merry Christmas… and congratulations. I’ll be watching. Always.",
  },
];

export default function SantismoHorrorHunt() {
  const [saved, setSaved] = useLocalStorageState(STORAGE_KEY, {
    stepIndex: 0,
    unlockedAudio: false,
  });

  const [answerInput, setAnswerInput] = useState("");
  const [shake, setShake] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Map overlay state (reveal-only)
  const [mapOpen, setMapOpen] = useState(false);
  const [mapZone, setMapZone] = useState(null);
  const [mapVisited, setMapVisited] = useState([]);

  const steps = useMemo(() => DEFAULT_STEPS, []);
  const step = steps[Math.min(saved.stepIndex, steps.length - 1)];
  const isLast = saved.stepIndex >= steps.length - 1;

  const [voices, setVoices] = useState([]);
  const voice = useMemo(() => pickVoice(voices), [voices]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.speechSynthesis) return;

    const load = () => {
      try {
        const v = window.speechSynthesis.getVoices() || [];
        setVoices(v);
      } catch {}
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      try {
        window.speechSynthesis.onvoiceschanged = null;
      } catch {}
    };
  }, []);

  const typedTitle = useTypewriter(step.title, 18, [saved.stepIndex]);
  const typedRiddle = useTypewriter(step.riddle, 10, [saved.stepIndex]);

  const onUnlockAudio = () => {
    setSaved((s) => ({ ...s, unlockedAudio: true }));
    speak("Ho ho ho... welcome, brave soul. Let the hunt begin.", {
      voice,
      pitch: 0.7,
      rate: 0.9,
    });
  };

  const whisper = () => {
    if (!saved.unlockedAudio) return;
    const variants = [
      step.santismoLine,
      "I can hear the wrapping paper breathe.",
      "Type the code word. The house is listening.",
      "If you cheat, I’ll replace your gift with socks.",
    ];
    const msg = variants[Math.floor(Math.random() * variants.length)];
    speak(msg, { voice, pitch: 0.62, rate: 0.92 });
  };

  const progressPct = Math.round(((saved.stepIndex + 1) / steps.length) * 100);

  const showMapForNextStep = (nextIndex) => {
    const next = steps[Math.min(nextIndex, steps.length - 1)];
    const current = steps[Math.min(nextIndex - 1, steps.length - 1)];

    const visitedZones = steps
      .slice(0, Math.min(nextIndex, steps.length))
      .map((s) => s.zone)
      .filter(Boolean);

    setMapVisited(visitedZones);
    setMapZone(next.zone);
    setMapOpen(true);

    if (saved.unlockedAudio) {
      const line = mapRevealLine({
        nextStepId: next.id,
        fromZone: current?.zone,
        toZone: next.zone,
      });
      speak(line, { voice, pitch: 0.62, rate: 0.92 });
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (isLast) {
      whisper();
      return;
    }

    const expected = normalize(step.answer);
    const got = normalize(answerInput);

    if (got === expected) {
      // Reveal the map BEFORE switching to the next riddle (dramatic pacing)
      const nextIndex = Math.min(saved.stepIndex + 1, steps.length - 1);
      setAnswerInput("");

      showMapForNextStep(nextIndex);

      // After overlay, advance the step
      setTimeout(() => {
        setSaved((s) => ({ ...s, stepIndex: nextIndex }));
      }, 3800);

      return;
    }

    setShake(true);
    setTimeout(() => setShake(false), 450);
    if (saved.unlockedAudio) {
      speak("Wrong. Try again...", { voice, pitch: 0.55, rate: 0.92 });
    }
  };

  const reset = () => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Reset the hunt back to Gift 1?");
      if (!ok) return;
    }
    setSaved({ stepIndex: 0, unlockedAudio: saved.unlockedAudio });
    setAnswerInput("");
    setShowHint(false);
    setMapOpen(false);
  };

  const jumpTo = (idx) => {
    setSaved((s) => ({ ...s, stepIndex: Math.max(0, Math.min(idx, steps.length - 1)) }));
    setAnswerInput("");
    setShowHint(false);
    setMapOpen(false);
  };

  const bg = "from-black via-zinc-950 to-black";

  const shedUnlocked = saved.stepIndex >= 15; // after back door step is solved, outdoor begins

  return (
    <div
      className={`min-h-screen bg-gradient-to-b ${bg} text-zinc-100`}
      style={{
        backgroundImage:
          "radial-gradient(900px 420px at 50% 15%, rgba(220,38,38,0.16), transparent 60%), radial-gradient(600px 360px at 20% 85%, rgba(59,130,246,0.10), transparent 60%)",
      }}
    >
      <HauntedMapOverlay
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        currentZone={mapZone}
        visitedZones={mapVisited}
        shedUnlocked={shedUnlocked || mapZone === "shed_final"}
      />

      <div className="mx-auto max-w-md px-4 pb-16 pt-8">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs tracking-widest text-zinc-400">SANTISMO PRESENTS</div>
            <h1 className="mt-1 text-2xl font-semibold">
              Christmas Horror Hunt <span className="ml-2 text-sm font-normal text-zinc-400">(v2)</span>
            </h1>
            <div className="mt-2 text-xs text-zinc-400">
              Progress: <span className="text-zinc-200">{saved.stepIndex + 1}</span> / {steps.length} · {progressPct}%
            </div>
          </div>

          <button
            onClick={() => setShowSettings((v) => !v)}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs hover:bg-zinc-900/50"
            title="Controller Panel"
          >
            ⚙️
          </button>
        </header>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-900">
          <div className="h-full rounded-full bg-red-600/70" style={{ width: `${progressPct}%` }} />
        </div>

        {!saved.unlockedAudio && (
          <div className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="text-sm text-zinc-200">Tap to awaken Santismo’s voice (iPhone requires this).</div>
            <button
              onClick={onUnlockAudio}
              className="mt-3 w-full rounded-2xl bg-red-600/80 px-4 py-3 text-sm font-semibold hover:bg-red-600"
            >
              🔊 Awaken the Voice
            </button>
            <div className="mt-2 text-xs text-zinc-500">
              Tip: If the voice sounds too normal, iPhone Settings → Accessibility → Spoken Content → Voices.
            </div>
          </div>
        )}

        {showSettings && (
          <div className="mt-5 rounded-3xl border border-zinc-800 bg-zinc-950/50 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Controller Panel</div>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-xs hover:bg-zinc-900/50"
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={reset}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs hover:bg-zinc-900/50"
              >
                ↩ Reset Hunt
              </button>
              <button
                onClick={whisper}
                className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs hover:bg-zinc-900/50"
              >
                🎅 Whisper
              </button>
            </div>

            <div className="mt-3">
              <div className="text-xs text-zinc-400">Jump to step</div>
              <div className="mt-2 grid grid-cols-6 gap-2">
                {Array.from({ length: steps.length }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => jumpTo(i)}
                    className={`rounded-xl border px-2 py-2 text-xs ${
                      i === saved.stepIndex
                        ? "border-red-500/60 bg-red-500/15"
                        : "border-zinc-800 bg-zinc-950/40 hover:bg-zinc-900/50"
                    }`}
                    title={steps[i].locationHint}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 text-xs text-zinc-500">
              Put the code word on a tiny note INSIDE the gift. She types it to advance.
            </div>
          </div>
        )}

        <main
          className={`mt-6 rounded-[28px] border border-zinc-800 bg-zinc-950/45 p-5 shadow-xl ${
            shake ? "animate-[shake_0.45s_ease-in-out]" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs tracking-widest text-zinc-400">GIFT {step.id}</div>
              <h2 className="mt-1 text-xl font-semibold text-zinc-100">{typedTitle}</h2>
            </div>
            <button
              onClick={whisper}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs hover:bg-zinc-900/50"
              title="Have Santismo speak"
            >
              🎙️
            </button>
          </div>

          <div className="mt-4 whitespace-pre-line rounded-3xl border border-zinc-800 bg-black/25 p-4 text-[15px] leading-relaxed">
            {typedRiddle}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={() => setShowHint((v) => !v)}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs hover:bg-zinc-900/50"
            >
              {showHint ? "Hide" : "Hint"}
            </button>
            <div className="text-xs text-zinc-500">(Hint is the real-world location label)</div>
          </div>

          {showHint && (
            <div className="mt-3 rounded-3xl border border-zinc-800 bg-red-500/10 p-4 text-sm">
              <div className="text-xs tracking-widest text-red-200/80">LOCATION HINT</div>
              <div className="mt-1 text-zinc-100">{step.locationHint}</div>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-5">
            <label className="text-xs tracking-widest text-zinc-400">ENTER THE CODE WORD FOUND WITH THE GIFT</label>
            <div className="mt-2 flex gap-2">
              <input
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                placeholder={isLast ? "You did it." : "e.g., crossroads"}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm outline-none focus:border-red-500/60"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <button
                type="submit"
                className="shrink-0 rounded-2xl bg-red-600/80 px-4 py-3 text-sm font-semibold hover:bg-red-600"
              >
                {isLast ? "🎄" : "Unlock"}
              </button>
            </div>
            {!isLast && (
              <div className="mt-2 text-xs text-zinc-500">
                After a correct code word, Santismo reveals the haunted map briefly… then the next riddle appears.
              </div>
            )}
          </form>

          {isLast && (
            <div className="mt-5 rounded-3xl border border-zinc-800 bg-emerald-500/10 p-4">
              <div className="text-xs tracking-widest text-emerald-200/80">THE END</div>
              <div className="mt-1 text-sm text-zinc-100">
                Tap 🎙️ for a final whisper. Then claim your treasure and close the curse.
              </div>
            </div>
          )}
        </main>

        <footer className="mt-6 text-xs text-zinc-600">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/35 p-4">
            <div className="font-semibold text-zinc-400">Run it (no printer)</div>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Hide each gift at the Location Hint for that step.</li>
              <li>Put a tiny note inside each gift with the CODE WORD (exactly matching the app).</li>
              <li>She opens the site on iPhone, taps “Awaken the Voice”, finds gift, types code word, unlocks next clue.</li>
            </ol>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes shake {
          0% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
