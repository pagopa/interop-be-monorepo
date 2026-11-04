import { describe, expect, it, vi } from "vitest";

import { processDriverServiceBuilder } from "../src/services/processDriverService.js";

describe("local process driver", () => {
  it.each([
    { script: "process.exit(0)", code: 0, signal: null },
    { script: "process.exit(2)", code: 2, signal: null },
    {
      script: "process.kill(process.pid, 'SIGTERM')",
      code: null,
      signal: "SIGTERM",
    },
  ])(
    "preserves the process exit code $code and signal $signal",
    async ({ script, code, signal }) => {
      const driver = processDriverServiceBuilder(100);
      const exited = vi.fn();
      try {
        const child = await driver.start(
          {
            source: "job",
            executable: process.execPath,
            args: ["-e", script],
            cwd: process.cwd(),
          },
          () => undefined,
          exited
        );

        await vi.waitFor(() =>
          expect(exited).toHaveBeenCalledExactlyOnceWith({ code, signal })
        );
        expect(await driver.isRunning(child.pid)).toBe(false);
      } finally {
        await driver.shutdown();
      }
    }
  );
  it("cancels active commands when the dashboard shuts down", async () => {
    const driver = processDriverServiceBuilder(100);
    const run = driver.run(
      {
        source: "shutdown",
        executable: process.execPath,
        args: ["-e", "setInterval(()=>{},1000)"],
        cwd: process.cwd(),
        timeoutMs: 60000,
      },
      () => undefined
    );
    const rejected = expect(run).rejects.toThrow(/exited/);
    await driver.shutdown();
    await rejected;
  });
  it("observes the actual tsx application's crash without a surviving watch wrapper", async () => {
    const driver = processDriverServiceBuilder(100);
    const exited = vi.fn();
    const child = await driver.start(
      {
        source: "crash",
        executable: `${process.cwd()}/node_modules/.bin/tsx`,
        args: ["test/fixtures/crash.ts"],
        cwd: process.cwd(),
      },
      () => undefined,
      exited
    );
    await vi.waitFor(
      () =>
        expect(exited).toHaveBeenCalledExactlyOnceWith({
          code: 1,
          signal: null,
        }),
      { timeout: 5000 }
    );
    expect(await driver.isRunning(child.pid)).toBe(false);
  });
  it("runs without a shell and captures complete and trailing log lines", async () => {
    const lines: string[] = [];
    const driver = processDriverServiceBuilder();
    const output = await driver.run(
      {
        source: "test",
        executable: process.execPath,
        args: [
          "-e",
          "console.log(process.argv[1]);process.stdout.write('tail')",
          "$(touch /tmp/dashboard-should-never-exist)",
        ],
        cwd: process.cwd(),
      },
      (line) => lines.push(line)
    );
    expect(output).toContain("$(touch /tmp/dashboard-should-never-exist)");
    expect(lines).toEqual([
      "$(touch /tmp/dashboard-should-never-exist)",
      "tail",
    ]);
  });
  it("terminates the whole process group, including grandchildren", async () => {
    const driver = processDriverServiceBuilder(300);
    let grandchild = 0;
    const child = await driver.start(
      {
        source: "test",
        executable: process.execPath,
        args: [
          "-e",
          "const {spawn}=require('child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(c.pid);setInterval(()=>{},1000)",
        ],
        cwd: process.cwd(),
      },
      (line) => {
        grandchild = Number(line);
      },
      () => undefined
    );
    for (let i = 0; i < 50 && !grandchild; i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    expect(grandchild).toBeGreaterThan(0);
    await child.stop();
    expect(() => process.kill(child.pid, 0)).toThrow();
    // A killed grandchild can briefly remain a zombie until the host init reaps it.
    expect(await driver.isRunning(grandchild)).toBe(false);
  });
  it("enforces bounded command timeouts and suppresses private token output", async () => {
    const driver = processDriverServiceBuilder(100);
    await expect(
      driver.run(
        {
          source: "test",
          executable: process.execPath,
          args: ["-e", "setInterval(()=>{},1000)"],
          cwd: process.cwd(),
          timeoutMs: 50,
        },
        () => undefined
      )
    ).rejects.toThrow(/timed out/);
    const lines: string[] = [];
    const token = await driver.run(
      {
        source: "identity",
        executable: process.execPath,
        args: ["-e", "console.log('secret-token')"],
        cwd: process.cwd(),
        privateOutput: true,
      },
      (line) => lines.push(line)
    );
    expect(token.trim()).toBe("secret-token");
    expect(lines).toEqual([]);
  });
});
