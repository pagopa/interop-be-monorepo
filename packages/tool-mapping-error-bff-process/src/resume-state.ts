import fs from "node:fs";
import path from "node:path";

export type ResumeState = {
  processName: string;
  totalEndpoints: number;
  offset: number;
  finalMarkdown: string;
};

export function buildResumeState({
  processName,
  finalMarkdown,
  offset,
  totalEndpoints,
}: {
  processName: string;
  finalMarkdown: string;
  offset: number;
  totalEndpoints: number;
}): ResumeState {
  return {
    processName,
    totalEndpoints,
    offset,
    finalMarkdown,
  };
}

export function saveResumeState(
  checkpointPath: string,
  state: ResumeState
): void {
  fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });
  fs.writeFileSync(checkpointPath, JSON.stringify(state, null, 2), "utf-8");
}

export function loadResumeState(
  checkpointPath: string,
  processName: string
): ResumeState | null {
  if (!fs.existsSync(checkpointPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(checkpointPath, "utf-8"));
    if (parsed.processName !== processName) {
      return null;
    }
    return parsed as ResumeState;
  } catch {
    return null;
  }
}

export function deleteResumeState(checkpointPath: string): void {
  if (fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
  }
}
