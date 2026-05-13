/**
 * Humanize financial text for natural Indian-accent TTS playback.
 * Converts "₹342 L" → "three hundred forty-two lakhs rupees".
 * Converts "28.2%" → "twenty-eight point two percent".
 * For Hindi/Marathi: replaces unit abbreviations with native words; TTS engines
 * already read digits naturally in those languages, so numerals stay as is.
 */

export type Lang = "en" | "hi" | "mr";

const ONES = [
  "zero","one","two","three","four","five","six","seven","eight","nine",
  "ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen",
];
const TENS = ["", "", "twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];

function under1000ToWords(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n]!;
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return TENS[t]! + (o > 0 ? "-" + ONES[o] : "");
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return ONES[h]! + " hundred" + (rest > 0 ? " " + under1000ToWords(rest) : "");
}

/** Convert whole/decimal number to English words. Handles negatives + decimals. */
function numberToEnglish(n: number): string {
  if (isNaN(n)) return "";
  const neg = n < 0;
  n = Math.abs(n);
  const [wholeStr, decStr] = n.toString().split(".");
  let whole = parseInt(wholeStr ?? "0", 10);
  let result = "";

  if (whole === 0) {
    result = "zero";
  } else if (whole < 1000) {
    result = under1000ToWords(whole);
  } else if (whole < 100_000) {
    const thousands = Math.floor(whole / 1000);
    const rest = whole % 1000;
    result = under1000ToWords(thousands) + " thousand" + (rest > 0 ? " " + under1000ToWords(rest) : "");
  } else if (whole < 10_000_000) {
    const lakhs = Math.floor(whole / 100_000);
    const rest = whole % 100_000;
    result = under1000ToWords(lakhs) + " lakh" + (rest > 0 ? " " + numberToEnglish(rest) : "");
  } else {
    const crores = Math.floor(whole / 10_000_000);
    const rest = whole % 10_000_000;
    result = under1000ToWords(crores) + " crore" + (rest > 0 ? " " + numberToEnglish(rest) : "");
  }

  if (decStr && decStr !== "0") {
    const decWords = decStr
      .split("")
      .map((d) => ONES[parseInt(d, 10)] ?? "")
      .join(" ");
    result += " point " + decWords;
  }

  return (neg ? "minus " : "") + result;
}

function unitWord(unit: string, lang: Lang): string {
  const u = unit.toLowerCase();
  if (lang === "hi") {
    if (u.startsWith("l")) return "लाख";
    if (u.startsWith("c") && u !== "cr".slice(0,1)) return "करोड़";
    if (u === "cr") return "करोड़";
    if (u === "k") return "हज़ार";
    if (u === "m" || u === "mn") return "मिलियन";
  }
  if (lang === "mr") {
    if (u.startsWith("l")) return "लाख";
    if (u === "cr" || u.startsWith("c")) return "कोटी";
    if (u === "k") return "हजार";
    if (u === "m" || u === "mn") return "मिलियन";
  }
  if (u.startsWith("l")) return "lakhs";
  if (u === "cr" || u.startsWith("c")) return "crores";
  if (u === "k") return "thousand";
  if (u === "m" || u === "mn") return "million";
  return unit;
}

function currencyWord(symbol: string, lang: Lang): string {
  if (symbol === "₹") {
    if (lang === "hi") return "रुपये";
    if (lang === "mr") return "रुपये";
    return "rupees";
  }
  if (symbol === "$") return "dollars";
  if (symbol === "€") return "euros";
  if (symbol === "£") return "pounds";
  if (symbol === "د.إ") return lang === "en" ? "dirhams" : "दिरहम";
  if (symbol === "S$") return lang === "en" ? "Singapore dollars" : "सिंगापुर डॉलर";
  return "";
}

/**
 * Main humanizer. Pass through Maya text before SpeechSynthesisUtterance.
 * For English: full number-to-words.
 * For Hindi/Marathi: native units + native scripts; TTS reads digits naturally.
 */
export function humanize(text: string, lang: Lang): string {
  if (!text) return text;
  let out = text;

  // Currency + amount + unit (e.g. "₹342.50 L", "$ 12.5 Cr", "S$3.2 M")
  out = out.replace(
    /(₹|\$|€|£|د\.إ|S\$)\s*([\-\d,]+(?:\.\d+)?)\s*(L|Lakhs?|Cr|Crores?|K|M|Mn|Million)?/gi,
    (_match, sym, num, unit) => {
      const clean = parseFloat(num.replace(/,/g, ""));
      if (isNaN(clean)) return _match;
      const cur = currencyWord(sym, lang);
      const numWords = lang === "en" ? numberToEnglish(clean) : num.replace(/,/g, "");
      const uw = unit ? " " + unitWord(unit, lang) : "";
      return ` ${numWords}${uw} ${cur} `;
    }
  );

  // Bare percentages (e.g. "28.2%", "+0.4%", "-2.5%")
  out = out.replace(/([\+\-]?\d+(?:\.\d+)?)\s*%/g, (_match, num) => {
    const clean = parseFloat(num);
    if (isNaN(clean)) return _match;
    const numWords = lang === "en" ? numberToEnglish(clean) : num;
    const pct = lang === "en" ? "percent" : "प्रतिशत";
    return ` ${numWords} ${pct} `;
  });

  // Standalone large numbers with commas like "1,42,857" — read as words in English only
  if (lang === "en") {
    out = out.replace(/\b(\d{1,3}(?:[,]\d{2,3})+)\b/g, (_match, num) => {
      const clean = parseFloat(num.replace(/,/g, ""));
      if (isNaN(clean)) return _match;
      return numberToEnglish(clean);
    });
  }

  // Replace remaining "L"/"Cr" word-tokens with native equivalents to prevent spelling
  if (lang === "hi") {
    out = out.replace(/\b(Lakhs?|L)\b/gi, "लाख");
    out = out.replace(/\b(Crores?|Cr)\b/gi, "करोड़");
  } else if (lang === "mr") {
    out = out.replace(/\b(Lakhs?|L)\b/gi, "लाख");
    out = out.replace(/\b(Crores?|Cr)\b/gi, "कोटी");
  }

  // Collapse whitespace
  return out.replace(/\s+/g, " ").trim();
}
