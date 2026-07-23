import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);
const recoveryScript = new URL("./kafka-recover-stale-broker.sh", import.meta.url);

const fakeDocker = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
case "$*" in
  *" ps -aq kafka") printf '%s\\n' "kafka-container" ;;
  "inspect --format {{.State.Running}} kafka-container") printf '%s\\n' "$FAKE_KAFKA_RUNNING" ;;
esac
`;

const runRecovery = async (kafkaRunning) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "interop-kafka-recovery-"));
  const dockerPath = join(temporaryDirectory, "docker");
  const logPath = join(temporaryDirectory, "docker.log");
  await writeFile(dockerPath, fakeDocker);
  await chmod(dockerPath, 0o755);

  try {
    await execFileAsync("bash", [recoveryScript.pathname, "/workspace/docker-compose.yml"], {
      env: {
        ...process.env,
        PATH: `${temporaryDirectory}:${process.env.PATH}`,
        FAKE_DOCKER_LOG: logPath,
        FAKE_KAFKA_RUNNING: String(kafkaRunning),
      },
    });
    return await readFile(logPath, "utf8");
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};

test("removes a stale ZooKeeper broker registration when Kafka is stopped", async () => {
  const calls = await runRecovery(false);

  assert.match(calls, /up -d --wait zookeeper/);
  assert.match(calls, /zkCli\.sh delete \/brokers\/ids\/1/);
});

test("keeps the active broker registration when Kafka is running", async () => {
  const calls = await runRecovery(true);

  assert.doesNotMatch(calls, /zkCli\.sh delete \/brokers\/ids\/1/);
});
