export type ProcessResult = "processed" | "skipped" | "error";

export type ResultsCollector = {
  add: (result: ProcessResult) => void;
  addMany: (results: ProcessResult[]) => void;
  getStats: () => { processed: number; skipped: number; errors: number };
};

export function createResultsCollector(): ResultsCollector {
  const results: ProcessResult[] = [];
  return {
    add: (result: ProcessResult): void => {
      // eslint-disable-next-line functional/immutable-data
      results.push(result);
    },
    addMany: (items: ProcessResult[]): void => {
      // eslint-disable-next-line functional/immutable-data
      results.push(...items);
    },
    getStats: () => ({
      processed: results.filter((r) => r === "processed").length,
      skipped: results.filter((r) => r === "skipped").length,
      errors: results.filter((r) => r === "error").length,
    }),
  };
}
