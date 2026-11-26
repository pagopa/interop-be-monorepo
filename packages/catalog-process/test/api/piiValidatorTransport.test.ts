import {
  createServer,
  IncomingMessage,
  ServerResponse,
  Server,
} from "node:http";
import { AddressInfo } from "node:net";
import { genericLogger } from "pagopa-interop-commons";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPersonalDataPrevention } from "../../src/services/personalDataPrevention/index.js";
import { createPiiValidatorTransport } from "../../src/services/personalDataPrevention/piiValidatorTransport.js";

const request = {
  fields: [{ fieldId: "notes", text: "SYNTHETIC_PRIVATE_TEXT" }],
};
const context = { correlationId: "synthetic-correlation" };
const verdict = { results: [{ fieldId: "notes", detectedCategories: [] }] };
const servers: Server[] = [];
async function listen(
  handler: (req: IncomingMessage, res: ServerResponse) => void
): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

describe("PII validator real HTTP transport", () => {
  it.each([400, 401, 403, 500, 501, 503])(
    "sanitizes HTTP %s with exactly one attempt",
    async (status) => {
      const received = vi.fn();
      const baseUrl = await listen((_req, res) => {
        received();
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            detail: "SYNTHETIC_PRIVATE_TEXT",
            token: "SYNTHETIC_TECHNICAL_TOKEN",
          })
        );
      });
      const error = await createPiiValidatorTransport({
        baseUrl,
        tokenProvider: async () => "SYNTHETIC_TECHNICAL_TOKEN",
      })(request, context).catch((caught: unknown) => caught);
      expect(
        error instanceof Error &&
          error.message === "Personal data prevention unavailable"
      ).toBe(true);
      expect(
        JSON.stringify(Object.getOwnPropertyDescriptors(error)).includes(
          "SYNTHETIC_"
        )
      ).toBe(false);
      expect(error instanceof Error && Object.hasOwn(error, "cause")).toBe(
        false
      );
      expect(received).toHaveBeenCalledTimes(1);
    }
  );

  it("sanitizes token provider failure before any HTTP request", async () => {
    const received = vi.fn((_req: IncomingMessage, res: ServerResponse) =>
      res.end()
    );
    const baseUrl = await listen(received);
    const error = await createPiiValidatorTransport({
      baseUrl,
      tokenProvider: async () => {
        throw new Error("SYNTHETIC_TECHNICAL_TOKEN");
      },
    })(request, context).catch((caught: unknown) => caught);
    expect(
      error instanceof Error &&
        error.message === "Personal data prevention unavailable"
    ).toBe(true);
    expect(
      JSON.stringify(Object.getOwnPropertyDescriptors(error)).includes(
        "SYNTHETIC_"
      )
    ).toBe(false);
    expect(received).not.toHaveBeenCalled();
  });

  it("aborts an active HTTP request when the configurable deadline expires", async () => {
    const closed = vi.fn();
    const baseUrl = await listen((req, res) => {
      req.resume();
      res.on("close", () => {
        if (!res.writableEnded) {
          closed();
        }
      });
      setTimeout(() => {
        res.end(JSON.stringify(verdict));
      }, 150);
    });
    const transport = createPiiValidatorTransport({
      baseUrl,
      tokenProvider: async () => "SYNTHETIC_TECHNICAL_TOKEN",
      timeoutMs: 30,
    });
    const error = await transport(request, context).catch(
      (caught: unknown) => caught
    );
    expect(
      error instanceof Error &&
        error.message === "Personal data prevention unavailable"
    ).toBe(true);
    await vi.waitFor(() => expect(closed).toHaveBeenCalledTimes(1));
  });

  it.each([301, 302, 303, 307, 308])(
    "never follows HTTP %s redirects to another server",
    async (status) => {
      const redirected = vi.fn((_req: IncomingMessage, res: ServerResponse) =>
        res.end(JSON.stringify(verdict))
      );
      const target = await listen(redirected);
      const attempts = vi.fn();
      const baseUrl = await listen((_req, res) => {
        attempts();
        res.writeHead(status, { Location: `${target}/exfiltrate` });
        res.end();
      });
      const error = await createPiiValidatorTransport({
        baseUrl,
        tokenProvider: async () => "SYNTHETIC_TECHNICAL_TOKEN",
      })(request, context).catch((caught: unknown) => caught);
      expect(
        error instanceof Error &&
          error.message === "Personal data prevention unavailable"
      ).toBe(true);
      expect(redirected).not.toHaveBeenCalled();
      expect(attempts).toHaveBeenCalledTimes(1);
    }
  );

  it("rejects invalid JSON even on HTTP 200", async () => {
    const baseUrl = await listen((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("SYNTHETIC_PRIVATE_TEXT{");
    });
    const error = await createPiiValidatorTransport({
      baseUrl,
      tokenProvider: async () => "SYNTHETIC_TECHNICAL_TOKEN",
    })(request, context).catch((caught: unknown) => caught);
    expect(
      error instanceof Error &&
        error.message === "Personal data prevention unavailable"
    ).toBe(true);
    expect(
      JSON.stringify(Object.getOwnPropertyDescriptors(error)).includes(
        "SYNTHETIC_"
      )
    ).toBe(false);
  });

  it.each([0, -1, NaN, Infinity, 0.5, 2147483648])(
    "rejects invalid timeout %s at construction",
    (timeoutMs) => {
      let caught: unknown;
      try {
        createPiiValidatorTransport({
          baseUrl: "http://127.0.0.1",
          tokenProvider: async () => "synthetic",
          timeoutMs,
        });
      } catch (error) {
        caught = error;
      }
      expect(
        caught instanceof Error &&
          caught.message === "Personal data prevention unavailable"
      ).toBe(true);
    }
  );

  it("bounds token acquisition and never sends after its deadline", async () => {
    const received = vi.fn((_req: IncomingMessage, res: ServerResponse) =>
      res.end(JSON.stringify(verdict))
    );
    const baseUrl = await listen(received);
    const started = performance.now();
    const error = await createPiiValidatorTransport({
      baseUrl,
      timeoutMs: 20,
      tokenProvider: async () =>
        new Promise<string>((resolve) =>
          setTimeout(() => resolve("SYNTHETIC_TECHNICAL_TOKEN"), 180)
        ),
    })(request, context).catch((caught: unknown) => caught);
    expect(
      error instanceof Error &&
        error.message === "Personal data prevention unavailable"
    ).toBe(true);
    expect(performance.now() - started).toBeLessThan(140);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(received).not.toHaveBeenCalled();
  });

  it.each([201, 202, 204, 206])(
    "rejects non-contract success status %s",
    async (status) => {
      const baseUrl = await listen((_req, res) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(verdict));
      });
      const error = await createPiiValidatorTransport({
        baseUrl,
        tokenProvider: async () => "SYNTHETIC_TECHNICAL_TOKEN",
      })(request, context).catch((caught: unknown) => caught);
      expect(
        error instanceof Error &&
          error.message === "Personal data prevention unavailable"
      ).toBe(true);
    }
  );

  it.each(["refused", "reset"])(
    "sanitizes network %s without retry",
    async (failure) => {
      const received = vi.fn();
      const baseUrl = await listen((req) => {
        received();
        req.socket.destroy();
      });
      if (failure === "refused") {
        await new Promise<void>((resolve, reject) =>
          servers[servers.length - 1].close((error) =>
            error ? reject(error) : resolve()
          )
        );
        servers.pop();
      }
      const tokenProvider = vi.fn(async () => "SYNTHETIC_TECHNICAL_TOKEN");
      const error = await createPiiValidatorTransport({
        baseUrl,
        tokenProvider,
      })(request, context).catch((caught: unknown) => caught);
      expect(
        error instanceof Error &&
          error.message === "Personal data prevention unavailable"
      ).toBe(true);
      expect(
        JSON.stringify(Object.getOwnPropertyDescriptors(error)).includes(
          "SYNTHETIC_"
        )
      ).toBe(false);
      expect(tokenProvider).toHaveBeenCalledTimes(1);
      expect(received).toHaveBeenCalledTimes(failure === "refused" ? 0 : 1);
    }
  );

  it("uses a 2000ms default deadline even for a token provider that never settles", async () => {
    vi.useFakeTimers();
    try {
      let settled = false;
      const pending = createPiiValidatorTransport({
        baseUrl: "http://127.0.0.1",
        tokenProvider: async () => new Promise<string>(() => undefined),
      })(request, context).catch((caught: unknown) => {
        settled = true;
        return caught;
      });
      await vi.advanceTimersByTimeAsync(1999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const error = await pending;
      expect(
        error instanceof Error &&
          error.message === "Personal data prevention unavailable"
      ).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([200, 500])(
    "keeps malicious HTTP %s payloads out of diagnostic sinks",
    async (status) => {
      const baseUrl = await listen((_req, res) => {
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            results: [
              {
                fieldId: "notes",
                detectedCategories: ["SYNTHETIC_PRIVATE_TEXT"],
              },
            ],
            token: "SYNTHETIC_TECHNICAL_TOKEN",
          })
        );
      });
      const logs = [
        vi.spyOn(genericLogger, "info"),
        vi.spyOn(genericLogger, "warn"),
        vi.spyOn(genericLogger, "error"),
        vi.spyOn(genericLogger, "debug"),
        vi.spyOn(console, "log"),
        vi.spyOn(console, "info"),
        vi.spyOn(console, "warn"),
        vi.spyOn(console, "error"),
        vi.spyOn(console, "debug"),
      ];
      for (const log of logs) {
        log.mockImplementation(() => {
          throw new Error("Unexpected diagnostic write");
        });
      }
      const stdout = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      const stderr = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      let sanitized = false;
      let silent = false;
      try {
        const transport = createPiiValidatorTransport({
          baseUrl,
          tokenProvider: async () => "SYNTHETIC_TECHNICAL_TOKEN",
        });
        const error = await createPersonalDataPrevention({
          transport,
          policy: () => true,
        })
          .assertAllowed(request, context)
          .catch((caught: unknown) => caught);
        sanitized =
          error instanceof Error &&
          error.message === "Personal data prevention unavailable" &&
          !JSON.stringify(Object.getOwnPropertyDescriptors(error)).includes(
            "SYNTHETIC_"
          ) &&
          !Object.hasOwn(error, "cause");
        silent = [...logs, stdout, stderr].every(
          (log) => log.mock.calls.length === 0
        );
      } finally {
        for (const log of [...logs, stdout, stderr]) {
          log.mockRestore();
        }
      }
      expect(sanitized).toBe(true);
      expect(silent).toBe(true);
    }
  );

  it("posts the batch with a technical bearer and correlation header", async () => {
    const received = vi.fn();
    const baseUrl = await listen((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        received({
          method: req.method,
          path: req.url,
          authorization: req.headers.authorization,
          correlationId: req.headers["x-correlation-id"],
          body: JSON.parse(body),
        });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(verdict));
      });
    });
    const tokenProvider = vi.fn(async () => "SYNTHETIC_TECHNICAL_TOKEN");
    const transport = createPiiValidatorTransport({ baseUrl, tokenProvider });
    await expect(transport(request, context)).resolves.toEqual(verdict);
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledExactlyOnceWith({
      method: "POST",
      path: "/detect",
      authorization: "Bearer SYNTHETIC_TECHNICAL_TOKEN",
      correlationId: context.correlationId,
      body: request,
    });
  });
});
