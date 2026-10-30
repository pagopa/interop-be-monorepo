import { watch } from "node:fs";

import { DASHBOARD_TIMING } from "../config/constants.js";

// The supervisor owns watch restarts. Node/tsx watch wrappers can remain alive
// after a crashed application, which would hide the failure and revive it later.
export const watchSource = (
  path: string,
  changed: () => void
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const watcher = watch(path, { recursive: true }, (_event, filename) => {
    if (!filename || !/\.(?:ts|json)$/.test(filename.toString())) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (!closed) changed();
    }, DASHBOARD_TIMING.sourceWatchDebounceMs);
  });
  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    watcher.close();
  };
};
