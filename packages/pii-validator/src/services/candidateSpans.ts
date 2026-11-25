import moo from "moo";

// All offsets refer to the original UTF-16 input. Token values are transient.
export type CandidateSpan = readonly [start: number, end: number];

const wordSegmenter = new Intl.Segmenter("it", { granularity: "word" });
const isDigit = (char: string): boolean => char >= "0" && char <= "9";
const isLetter = (char: string): boolean =>
  (char >= "A" && char <= "Z") || (char >= "a" && char <= "z");
const isAlphaNumeric = (char: string): boolean =>
  isDigit(char) || isLetter(char);
const isWhitespace = (char: string): boolean =>
  char === " " || char === "\t" || char === "\n" || char === "\r";

// Literal clues and separators only. Moo owns the pattern compilation; no
// application-authored regular expression or sensitive lexer error escapes.
const lexerRules = {
  at: "@",
  iban: "IT",
  license: ["U1", "71"],
  space: " ",
  tab: "\t",
  newline: { match: "\n", lineBreaks: true },
  carriageReturn: { match: "\r", lineBreaks: true },
  slash: "/",
  backslash: "\\",
  comma: ",",
  semicolon: ";",
  colon: ":",
  openParen: "(",
  closeParen: ")",
  openBracket: "[",
  closeBracket: "]",
  openAngle: "<",
  closeAngle: ">",
  fallback: moo.fallback,
};

type Clue = Readonly<{ type: string; start: number; end: number }>;

function* clues(text: string): Generator<Clue> {
  try {
    // One lexer per invocation: reset and iteration cannot interleave requests.
    const lexer = moo.compile(lexerRules);
    lexer.reset(text);
    for (const token of lexer) {
      yield {
        type: token.type ?? "fallback",
        start: token.offset,
        end: token.offset + token.text.length,
      };
    }
  } catch {
    // Moo's default error embeds the source line; do not attach it as cause.
    throw new Error("PII tokenization failed");
  }
}

type WordBoundary = CandidateSpan;

function wordBoundaries(text: string): WordBoundary[] {
  const result: WordBoundary[] = [];
  for (const part of wordSegmenter.segment(text)) {
    if (part.isWordLike)
      result.push([part.index, part.index + part.segment.length]);
  }
  return result;
}

// A binary lookup avoids restarting word segmentation for every candidate.
function insideWord(
  boundaries: readonly WordBoundary[],
  offset: number
): boolean {
  let low = 0;
  let high = boundaries.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (boundaries[middle][0] < offset) low = middle + 1;
    else high = middle;
  }
  return low > 0 && offset < boundaries[low - 1][1];
}

function isolated(
  text: string,
  start: number,
  end: number,
  boundaries: readonly WordBoundary[]
): boolean {
  return (
    !insideWord(boundaries, start) &&
    !insideWord(boundaries, end) &&
    (start === 0 || !isAlphaNumeric(text[start - 1])) &&
    (end === text.length || !isAlphaNumeric(text[end]))
  );
}

// A fallback chunk may contain several digit/letter runs. Literal anchors can
// split a run; consume their original source slices in the same linear pass.
function* runs(text: string, digitOnly: boolean): Generator<CandidateSpan> {
  const boundaries = digitOnly ? undefined : wordBoundaries(text);
  let start = -1;
  let previousEnd = 0;
  for (const clue of clues(text)) {
    for (let i = clue.start; i < clue.end; i++) {
      const belongs = digitOnly ? isDigit(text[i]) : isAlphaNumeric(text[i]);
      if (belongs) {
        if (start < 0) start = i;
      } else if (start >= 0) {
        if (digitOnly || isolated(text, start, i, boundaries ?? []))
          yield [start, i];
        start = -1;
      }
    }
    previousEnd = clue.end;
  }
  if (
    start >= 0 &&
    (digitOnly || isolated(text, start, previousEnd, boundaries ?? []))
  ) {
    yield [start, previousEnd];
  }
}

const emailEnd = new Set(["/", "\\"]);
const outside = new Set([
  '"',
  "'",
  "(",
  ")",
  "[",
  "]",
  "<",
  ">",
  ",",
  ";",
  ":",
  "!",
  "?",
]);

function* email(text: string): Generator<CandidateSpan> {
  let blockEnd = 0;
  for (const clue of clues(text)) {
    if (clue.type !== "at" || clue.start < blockEnd) continue;
    const at = clue.start;
    let start = at;
    let end = at + 1;
    while (
      start > 0 &&
      !isWhitespace(text[start - 1]) &&
      !emailEnd.has(text[start - 1])
    )
      start--;
    while (
      end < text.length &&
      !isWhitespace(text[end]) &&
      !emailEnd.has(text[end])
    )
      end++;
    blockEnd = end;
    while (start < at && outside.has(text[start])) start++;
    while (
      end > at + 1 &&
      (outside.has(text[end - 1]) || text[end - 1] === ".")
    )
      end--;
    if (start < at && end > at + 1) yield [start, end];
  }
}

function* digits(text: string): Generator<CandidateSpan> {
  for (const [start, end] of runs(text, true)) {
    // Entire ASCII digit run: even a Unicode digit beside it is a boundary
    // only for VAT's explicitly non-numeric policy, not a card/phone prefix.
    yield [start, end];
  }
}

function* vat(text: string): Generator<CandidateSpan> {
  for (const [start, end] of digits(text)) {
    if (end - start === 11) yield [start, end];
  }
}

function* iban(text: string): Generator<CandidateSpan> {
  for (const [start, end] of runs(text, false)) {
    if (end - start === 27 && text.startsWith("IT", start)) yield [start, end];
  }
}

function* cards(text: string): Generator<CandidateSpan> {
  const boundaries = wordBoundaries(text);
  for (const [start, end] of digits(text)) {
    if (
      end - start < 12 ||
      end - start > 19 ||
      !isolated(text, start, end, boundaries)
    )
      continue;
    let next = end;
    while (next < text.length && phoneSeparator.has(text[next])) next++;
    if (next > end && next < text.length && isDigit(text[next])) continue;
    yield [start, end];
  }
}

const phoneSeparator = new Set([
  " ",
  "\u00a0",
  "-",
  "\t",
  "\n",
  "\r",
  "–",
  "/",
  "\\",
]);

function* phones(text: string): Generator<CandidateSpan> {
  const boundaries = wordBoundaries(text);
  for (const [start, end] of digits(text)) {
    if (end - start !== 10 || !isolated(text, start, end, boundaries)) continue;
    const prefixed = text.slice(Math.max(0, start - 4), start) === "+39 ";
    let before = start;
    // A bare suffix of a malformed +39 prefix is not a separate mobile.
    // Stop at any preceding alphanumeric character, not a fixed list of
    // separators (which would miss a colon, NBSP, or bracket).
    while (before > 0 && !isAlphaNumeric(text[before - 1])) before--;
    let after = end;
    while (after < text.length && phoneSeparator.has(text[after])) after++;
    if (after > end && after < text.length && isDigit(text[after])) continue;
    if (before < start && before > 0 && isDigit(text[before - 1])) {
      if (text.slice(before - 3, before) === "+39") {
        if (!prefixed || before !== start - 1) continue;
      } else {
        let priorStart = before;
        while (priorStart > 0 && isDigit(text[priorStart - 1])) priorStart--;
        if (before - priorStart <= 3) continue;
      }
    }
    if (before < start && before > 0 && text[before - 1] === "+") continue;
    if (prefixed) {
      if (start < 5 || !isAlphaNumeric(text[start - 5])) yield [start - 4, end];
    } else {
      yield [start, end];
    }
  }
}

function* licenses(text: string): Generator<CandidateSpan> {
  for (const [start, end] of runs(text, false)) {
    if (end - start !== 10) continue;
    if (!(text.startsWith("U1", start) || text.startsWith("71", start)))
      continue;
    if (!isLetter(text[end - 1])) continue;
    yield [start, end];
  }
}

export const candidateSpans = { email, vat, iban, cards, phones, licenses };
