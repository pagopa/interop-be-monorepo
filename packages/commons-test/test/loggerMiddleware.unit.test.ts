import { EventEmitter } from "node:events";
import { loggerMiddleware } from "pagopa-interop-commons";
import { describe, expect, it, vi } from "vitest";

describe("loggerMiddleware", () => {
  it("Should log server error responses as errors", () => {
    const loggerInstance = {
      isDebugEnabled: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const loggerFactory = vi.fn(() => loggerInstance);
    const middleware = loggerMiddleware("test-service", loggerFactory);
    const request = {
      method: "GET",
      url: "/resource",
    } as Parameters<typeof middleware>[0];
    const response = Object.assign(new EventEmitter(), {
      statusCode: 500,
      statusMessage: "Internal Server Error",
    }) as unknown as Parameters<typeof middleware>[1];
    const next = vi.fn();

    middleware(request, response, next);
    response.emit("finish");

    expect(loggerInstance.error).toHaveBeenCalledWith(
      "Request GET /resource - Response 500 Internal Server Error"
    );
    expect(loggerInstance.info).not.toHaveBeenCalled();
  });
});
