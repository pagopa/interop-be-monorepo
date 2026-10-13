import { readFile } from "node:fs/promises";

import { createApp } from "./app.js";
import { config } from "./config/config.js";
import { LOG_LIMITS, LOG_SOURCES } from "./config/constants.js";
import { discoverPackages, readPresets } from "./services/catalogService.js";
import { localEnvironment } from "./services/environmentService.js";
import { identityServiceBuilder } from "./services/identityService.js";
import { infrastructureServiceBuilder } from "./services/infrastructureService.js";
import { processDriverServiceBuilder } from "./services/processDriverService.js";
import { supervisorServiceBuilder } from "./services/supervisorService.js";
import { errorMessage } from "./utilities/errorUtils.js";
import { watchSource } from "./utilities/watch.js";

const driver = processDriverServiceBuilder();
const identities = identityServiceBuilder(config.beRoot, driver, config.feRoot);
const supervisor = supervisorServiceBuilder({
  beRoot: config.beRoot,
  feRoot: config.feRoot,
  driver,
  packages: await discoverPackages(config.beRoot),
  presets: await readPresets(config.beRoot, config.personalPath),
  personalPath: config.personalPath,
  environment: (name) => localEnvironment(config.beRoot, name),
  seedReady: async () => (await identities.identities()).ready,
  watchSource,
});

await supervisor.refreshSeed();

try {
  const log = await readFile(config.bootstrapLogPath, "utf8");

  log
    .split("\n")
    .slice(-LOG_LIMITS.bootstrapLines)
    .forEach((line) => supervisor.logs.append(LOG_SOURCES.orchestration, line));
} catch {
  /* The bootstrap log is optional outside Compose. */
}

const monitor = infrastructureServiceBuilder(config.beRoot, driver, supervisor);
const app = createApp(supervisor, identities, config.uiRoot);
const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`Local dashboard listening on http://localhost:${config.port}`);
  monitor.start();

  if (config.autostart) {
    try {
      supervisor.autostart(config.autostartPreset);
    } catch (error) {
      supervisor.logs.append(
        LOG_SOURCES.orchestration,
        `ERROR Autostart: ${errorMessage(error)}`
      );
    }
  }
});

let shuttingDown = false;

const shutdown = (): void => {
  if (shuttingDown) return;

  shuttingDown = true;
  server.close();

  void Promise.all([
    supervisor.shutdown(),
    monitor.shutdown(),
    driver.shutdown(),
  ]).finally(() => {
    process.exitCode = 0;
  });
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
