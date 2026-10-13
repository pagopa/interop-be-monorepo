import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import type { Child, Command, Driver } from "../model/domain/models.js";

import {
  DASHBOARD_TIMING,
  INHERITED_ENVIRONMENT_KEYS,
  INHERITED_ENVIRONMENT_PREFIXES,
  PROCESS_LIMITS,
} from "../config/constants.js";
import { errorMessage } from "../utilities/errorUtils.js";

const safeEnvironment = (): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        INHERITED_ENVIRONMENT_KEYS.includes(key) ||
        INHERITED_ENVIRONMENT_PREFIXES.some((prefix) => key.startsWith(prefix))
    )
  );

type ProcessExit = { code: number | null; signal: NodeJS.Signals | null };

type ManagedProcess = {
  process: ChildProcess;
  complete: Promise<ProcessExit>;
  output: () => string;
};

type ProcessDriver = Driver & {
  isRunning(pid: number): Promise<boolean>;
  shutdown(): Promise<void>;
};

function captureStream(
  stream: ChildProcess["stdout"],
  collect: (data: string) => void,
  log: (line: string) => void
): void {
  if (!stream) return;
  let partial = "";
  stream.setEncoding("utf8");
  stream.on("data", (data: string) => {
    collect(data);
    partial += data;
    const lines = partial.split(/\r?\n/);
    partial = (lines.pop() ?? "").slice(-PROCESS_LIMITS.partialLineLength);
    lines.forEach((line) => log(line));
  });
  stream.on("end", () => {
    if (partial) log(partial);
  });
}

function captureOutput(
  child: ChildProcess,
  command: Command,
  log: (line: string) => void
): () => string {
  let output = "";
  const publish = (line: string): void => {
    if (!command.privateOutput) log(line);
  };
  captureStream(
    child.stdout,
    (data) => {
      output = (output + data).slice(-PROCESS_LIMITS.outputLength);
    },
    publish
  );
  captureStream(child.stderr, () => undefined, publish);
  return () => output;
}

async function isRunning(pid: number): Promise<boolean> {
  try {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8");
    return !stat.slice(stat.lastIndexOf(")") + 2).startsWith("Z");
  } catch {
    return false;
  }
}

export function processDriverServiceBuilder(
  graceMs: number = DASHBOARD_TIMING.processGraceMs
): ProcessDriver {
  const active = new Set<ManagedProcess>();
  let closing = false;

  function spawnProcess(
    command: Command,
    log: (line: string) => void
  ): ManagedProcess {
    if (closing) throw new Error("Process driver is shutting down");
    const child = spawn(command.executable, command.args, {
      cwd: command.cwd,
      env: { ...safeEnvironment(), ...command.env },
      detached: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = captureOutput(child, command, log);
    const complete = new Promise<ProcessExit>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    const managed = { process: child, output, complete };
    active.add(managed);
    void complete.then(
      () => active.delete(managed),
      () => active.delete(managed)
    );
    return managed;
  }

  async function terminate(
    child: ChildProcess,
    complete: Promise<unknown>
  ): Promise<void> {
    const pid = child.pid;
    if (!pid) return;
    const kill = (signal: NodeJS.Signals): void => {
      try {
        process.kill(-pid, signal);
      } catch (error) {
        if (
          !(error instanceof Error && "code" in error && error.code === "ESRCH")
        )
          throw error;
      }
    };
    kill("SIGTERM");
    await Promise.race([complete.catch(() => undefined), delay(graceMs)]);
    // Even if the leader exited, a grandchild may have ignored SIGTERM.
    kill("SIGKILL");
    await Promise.race([
      complete.catch(() => undefined),
      delay(DASHBOARD_TIMING.processKillWaitMs),
    ]);
  }

  async function run(
    command: Command,
    log: (line: string) => void
  ): Promise<string> {
    const managed = spawnProcess(command, log);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${command.source} command timed out`)),
        command.timeoutMs ?? DASHBOARD_TIMING.commandTimeoutMs
      );
    });
    try {
      const result = await Promise.race([managed.complete, timedOut]);
      if (result.code !== 0)
        throw new Error(
          `${command.source} command exited with ${result.signal ?? result.code}`
        );
      return managed.output();
    } catch (error) {
      await terminate(managed.process, managed.complete);
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function start(
    command: Command,
    log: (line: string) => void,
    exit: (error: string) => void
  ): Promise<Child> {
    const managed = spawnProcess(command, log);
    let stopping = false;

    async function onProcessExit({ code, signal }: ProcessExit): Promise<void> {
      if (stopping) return;
      exit(`${command.source} exited with ${signal ?? code}`);
      try {
        await terminate(managed.process, managed.complete);
      } catch {
        // Process-group cleanup must not replace the reported exit.
      }
    }

    void managed.complete.then(onProcessExit, (error: unknown) => {
      if (!stopping) exit(errorMessage(error));
    });
    await new Promise<void>((resolve, reject) => {
      managed.process.once("spawn", resolve);
      managed.process.once("error", reject);
    });
    const pid = managed.process.pid;
    if (!pid) throw new Error("Child process has no pid");
    return {
      pid,
      stop: async () => {
        stopping = true;
        await terminate(managed.process, managed.complete);
      },
    };
  }

  async function shutdown(): Promise<void> {
    closing = true;
    await Promise.all(
      [...active].map((managed) => terminate(managed.process, managed.complete))
    );
  }

  return {
    run,
    start,
    isRunning,
    shutdown,
  };
}
