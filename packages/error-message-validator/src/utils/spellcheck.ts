import {
  getDefaultSettings,
  mergeSettings,
  readSettings,
  spellCheckDocument,
} from "cspell-lib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Words that are valid in the error messages but missing from the dictionaries
export const allowedWords = [
  "e-service",
  "eservice",
  "eservices",
  "client",
  "clients",
  "keychain",
  "pagopa",
  "interop",
  "selfcare",
  "template",
  "templates",
  "PDND",
  "IPA",
  "SPID",
  "PEC",
  "PA",
  "CSV",
  "API",
  "callback",
  "quell’ente",
];

type Language = "it" | "en";

async function getSettings(language: Language) {
  const base = await getDefaultSettings();
  const italian = await readSettings(
    require.resolve("@cspell/dict-it-it/cspell-ext.json")
  );
  return mergeSettings(base, italian, {
    words: allowedWords,
    language: language === "it" ? "it" : "en",
    dictionaries: language === "it" ? ["it-it"] : ["en_US"],
  });
}

export async function findMisspelledWords(
  text: string,
  language: Language
): Promise<string[]> {
  const result = await spellCheckDocument(
    { uri: `text.${language}.txt`, text, languageId: "plaintext" },
    { noConfigSearch: true, generateSuggestions: false },
    await getSettings(language)
  );
  return [...new Set(result.issues.map((issue) => issue.text))];
}
