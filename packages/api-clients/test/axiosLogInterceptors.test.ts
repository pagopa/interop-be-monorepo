import { describe, it, expect, vi, afterEach } from "vitest";
import axios, { AxiosError, AxiosHeaders } from "axios";
import { genericLogger } from "pagopa-interop-commons";
import { configureAxiosLogInterceptors } from "../src/axiosLogInterceptors.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function createSuccessInstance(
  baseURL: string
): ReturnType<typeof axios.create> {
  return axios.create({
    baseURL,
    adapter: async (config) => ({
      data: {},
      status: 200,
      statusText: "OK",
      headers: new AxiosHeaders(),
      config,
    }),
  });
}

function createErrorInstance(
  baseURL: string,
  status: number,
  statusText: string
): ReturnType<typeof axios.create> {
  return axios.create({
    baseURL,
    adapter: async (config) => {
      throw new AxiosError(
        statusText,
        "ERR",
        config,
        {},
        {
          data: {},
          status,
          statusText,
          headers: new AxiosHeaders(),
          config,
        }
      );
    },
  });
}

describe("configureAxiosLogInterceptors - log format", () => {
  const clientName = "TestClient";
  const correlationId = "abc-123";

  it("response log contains [CID=<id>][ClientName][Response] METHOD baseURL+path status:statusText", async () => {
    const infoSpy = vi.spyOn(genericLogger, "info");
    const instance = createSuccessInstance("http://example.com");
    configureAxiosLogInterceptors(instance, clientName);

    const headers = new AxiosHeaders();
    headers.set("X-Correlation-Id", correlationId);
    await instance.get("/users/42", { headers });

    expect(infoSpy).toHaveBeenCalledOnce();
    const msg: string = infoSpy.mock.calls[0]?.[0] as string;

    // Prefix: [CID=abc-123][TestClient]
    expect(msg).toMatch(/\[CID=abc-123\]\[TestClient\]/);
    // Type tag
    expect(msg).toContain("[Response]");
    // Method uppercased
    expect(msg).toContain("GET");
    // Full URL (baseURL + path)
    expect(msg).toContain("http://example.com/users/42");
    // Status
    expect(msg).toContain("200");
    expect(msg).toContain("OK");
  });

  it("error log contains [CID=<id>][ClientName][Error] METHOD baseURL+path status:statusText", async () => {
    const warnSpy = vi.spyOn(genericLogger, "warn");
    const instance = createErrorInstance(
      "http://example.com",
      404,
      "Not Found"
    );
    configureAxiosLogInterceptors(instance, clientName);

    const headers = new AxiosHeaders();
    headers.set("X-Correlation-Id", correlationId);
    await expect(instance.get("/missing", { headers })).rejects.toThrow();

    // Find the log call that contains [Error] (skip potential error.errors logs)
    const errorLogCall = warnSpy.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("[Error]")
    );
    expect(errorLogCall).toBeDefined();
    const msg: string = errorLogCall?.[0] as string;

    expect(msg).toMatch(/\[CID=abc-123\]\[TestClient\]/);
    expect(msg).toContain("[Error]");
    expect(msg).toContain("GET");
    expect(msg).toContain("http://example.com/missing");
    expect(msg).toContain("404");
    expect(msg).toContain("Not Found");
  });

  it("prefix without correlation ID is [ClientName]", async () => {
    const infoSpy = vi.spyOn(genericLogger, "info");
    const instance = createSuccessInstance("http://example.com");
    configureAxiosLogInterceptors(instance, clientName);

    // No X-Correlation-Id header
    await instance.get("/no-cid");

    expect(infoSpy).toHaveBeenCalledOnce();
    const msg: string = infoSpy.mock.calls[0]?.[0] as string;

    // Should have [TestClient] but NOT [CID=
    expect(msg).toContain("[TestClient]");
    expect(msg).not.toContain("CID=");
    expect(msg).toContain("[Response]");
    expect(msg).toContain("GET");
  });

  it("log includes POST method uppercased", async () => {
    const infoSpy = vi.spyOn(genericLogger, "info");
    const instance = createSuccessInstance("http://api.test");
    configureAxiosLogInterceptors(instance, "MyService");

    const headers = new AxiosHeaders();
    headers.set("X-Correlation-Id", "cid-post");
    await instance.post("/items", { name: "x" }, { headers });

    const msg: string = infoSpy.mock.calls[0]?.[0] as string;

    expect(msg).toMatch(/\[CID=cid-post\]\[MyService\]/);
    expect(msg).toContain("POST");
    expect(msg).toContain("http://api.test/items");
  });
});
