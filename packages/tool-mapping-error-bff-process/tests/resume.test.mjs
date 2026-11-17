import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { buildResumeState, loadResumeState, saveResumeState } from "../src/resume-state.ts";

test("buildResumeState keeps already completed markdown and next offset", () => {
  const state = buildResumeState({
    processName: "purpose-process",
    finalMarkdown: "# purpose-process\n\n",
    offset: 6,
    totalEndpoints: 12,
  });

  assert.equal(state.offset, 6);
  assert.equal(state.finalMarkdown, "# purpose-process\n\n");
  assert.equal(state.processName, "purpose-process");
});

test("save/load resume state round-trips checkpoint payload", () => {
  const checkpointPath = "/tmp/purpose-process-resume-state.json";
  const state = buildResumeState({
    processName: "purpose-process",
    totalEndpoints: 12,
    offset: 6,
    finalMarkdown: "# purpose-process\n\n",
  });

  saveResumeState(checkpointPath, state);
  const loaded = loadResumeState(checkpointPath, "purpose-process");

  assert.deepEqual(loaded, state);
});

test("append mode keeps growing the output file as batches complete", () => {
  const outputPath = "/tmp/purpose-process-ENDPOINT-ERRORS.md";
  fs.writeFileSync(outputPath, "# purpose-process\n\n", "utf-8");

  const nextChunk = "## 1\n\nBatch one\n\n---\n\n";
  const current = fs.readFileSync(outputPath, "utf-8");
  fs.writeFileSync(outputPath, current + nextChunk, "utf-8");

  const appended = fs.readFileSync(outputPath, "utf-8");
  assert.match(appended, /# purpose-process/);
  assert.match(appended, /Batch one/);
  assert.match(appended, /---/);
});
