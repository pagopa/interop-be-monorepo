import moo from "moo";
import validator from "validator";

// All offsets refer to the original UTF-16 input.
type CandidateSpan = readonly [start: number, end: number];

const patterns = {
  // Whole blocks avoid prefix recovery and repeated searches for an at-sign.
  emailCandidate: /[^ \t\n\r/\\]+/u,
  ibanCandidate: /IT[A-Za-z0-9]{25}/u,
  numericCandidate: /(?:IT|\+)?[0-9]+(?: +[0-9]+)*/u,
};

type CandidateType = keyof typeof patterns;

function* tokens(text: string, type: CandidateType): Generator<CandidateSpan> {
  try {
    // A category-specific lexer prevents one shape from hiding another.
    const lexer = moo.compile({
      [type]: patterns[type],
      // Keep alphanumeric identifiers from swallowing a following numeric run.
      ...(type === "numericCandidate"
        ? { word: /[\p{L}\p{M}][\p{L}\p{M}\p{N}_]*/u }
        : {}),
      fallback: moo.fallback,
    });
    lexer.reset(text);
    for (const token of lexer) {
      if (token.type === type)
        yield [token.offset, token.offset + token.text.length];
    }
  } catch {
    // Moo errors can embed source text; do not expose the error or its cause.
    throw new Error("PII tokenization failed");
  }
}

const wordSegmenter = new Intl.Segmenter("it", { granularity: "word" });
function wordBoundaries(text: string): CandidateSpan[] {
  const result: CandidateSpan[] = [];
  for (const part of wordSegmenter.segment(text)) {
    if (part.isWordLike)
      result.push([part.index, part.index + part.segment.length]);
  }
  return result;
}

function insideWord(
  boundaries: readonly CandidateSpan[],
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
  // Moo owns the whole email-like block; only edge punctuation is trimmed.
  for (const [blockStart, blockEnd] of tokens(text, "emailCandidate")) {
    const relativeAt = text.slice(blockStart, blockEnd).indexOf("@");
    if (relativeAt < 0) continue;
    const at = blockStart + relativeAt;
    let start = blockStart;
    let end = blockEnd;
    while (start < at && outside.has(text[start])) start++;
    while (
      end > at + 1 &&
      (outside.has(text[end - 1]) || text[end - 1] === ".")
    )
      end--;
    if (start < at && end > at + 1) yield [start, end];
  }
}

function* isolatedTokens(
  text: string,
  type: CandidateType
): Generator<CandidateSpan> {
  const boundaries = wordBoundaries(text);
  for (const [start, end] of tokens(text, type)) {
    if (!insideWord(boundaries, start) && !insideWord(boundaries, end))
      yield [start, end];
  }
}

const numericSeparators = new Set([
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

function separatedDigitAfter(text: string, end: number): boolean {
  let next = end;
  while (next < text.length && numericSeparators.has(text[next])) next++;
  return (
    next > end &&
    next < text.length &&
    validator.isNumeric(text[next], { no_symbols: true })
  );
}

// All numeric checkers receive the whole numeric run, never a valid sub-window.
function* numeric(text: string): Generator<CandidateSpan> {
  for (const [start, end] of isolatedTokens(text, "numericCandidate")) {
    if (!separatedDigitAfter(text, end)) yield [start, end];
  }
}

const iban = (text: string): Generator<CandidateSpan> =>
  isolatedTokens(text, "ibanCandidate");

export type Candidate = Readonly<{ text: string; start: number; end: number }>;
export type CandidateExtractor = (text: string) => Iterable<Candidate>;

function* candidates(
  source: string,
  spans: Iterable<CandidateSpan>
): Generator<Candidate> {
  for (const [start, end] of spans) {
    yield { text: source.slice(start, end), start, end };
  }
}

export function extractEmailCandidates(text: string): Iterable<Candidate> {
  return candidates(text, email(text));
}

export function extractNumericCandidates(text: string): Iterable<Candidate> {
  return candidates(text, numeric(text));
}

export function extractIbanCandidates(text: string): Iterable<Candidate> {
  return candidates(text, iban(text));
}
