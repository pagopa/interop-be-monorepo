import { describe, expect, it } from "vitest";

import { api, schemas } from "../src/index.js";

function logParameter(name: string): ZodType<unknown> {
  const endpoint = api.api.find((item) => item.alias === "getLogs");
  if (!endpoint || !("parameters" in endpoint)) {
    throw new Error("Missing generated logs endpoint");
  }

  const parameter = endpoint.parameters.find((item) => item.name === name);
  if (!parameter) {
    throw new Error(`Missing generated log parameter: ${name}`);
  }

  return parameter.schema;
}

describe("generated dashboard contracts", () => {
  it("describes runtime availability without a global backend/fullstack mode", () => {
    const status = {
      packages: [],
      presets: [],
      infrastructure: [],
      operations: [],
      logSources: [],
      seedPackages: [],
      seedPrerequisites: [],
      seedReady: false,
      frontendAvailable: true,
    };

    expect(schemas.DashboardStatus.parse(status)).toEqual(status);
    expect(
      schemas.DashboardStatus.safeParse({ ...status, mode: "backend" }).success
    ).toBe(false);
  });

  it("matches the supported log levels at the HTTP boundary", () => {
    const level = logParameter("level");
    for (const value of ["debug", "info", "warn", "error", "unknown"]) {
      expect(level.safeParse(value).success).toBe(true);
    }

    expect(level.safeParse(undefined).success).toBe(true);
    expect(level.safeParse("unsupported").success).toBe(false);
  });

  it.each([
    { name: "source", maxLength: 200 },
    { name: "service", maxLength: 200 },
    { name: "search", maxLength: 1000 },
    { name: "cid", maxLength: 300 },
    { name: "cursors", maxLength: 30000 },
  ])(
    "matches the $name length limit at the HTTP boundary",
    ({ name, maxLength }) => {
      const schema = logParameter(name);
      expect(schema.safeParse(undefined).success).toBe(true);
      expect(schema.safeParse("x".repeat(maxLength)).success).toBe(true);
      expect(schema.safeParse("x".repeat(maxLength + 1)).success).toBe(false);
    }
  );

  it("keeps action validation strict and requires explicit reset confirmation", () => {
    expect(
      schemas.DashboardAction.safeParse({ type: "seed.prepare" }).success
    ).toBe(true);
    expect(
      schemas.DashboardAction.safeParse({
        type: "seed.prepare",
        command: "bash",
      }).success
    ).toBe(false);
    expect(
      schemas.DashboardAction.safeParse({ type: "infra.reset", confirm: false })
        .success
    ).toBe(false);
    expect(
      schemas.DashboardAction.safeParse({ type: "infra.reset", confirm: true })
        .success
    ).toBe(true);
    expect(
      schemas.DashboardAction.safeParse({ type: "packages.start", names: [] })
        .success
    ).toBe(false);
  });

  it("keeps response objects strict and preserves the token response shape", () => {
    expect(
      schemas.SessionResponse.parse({ sessionToken: "local-token" })
    ).toEqual({ sessionToken: "local-token" });
    expect(
      schemas.SessionResponse.safeParse({
        sessionToken: "local-token",
        extra: true,
      }).success
    ).toBe(false);
    expect(schemas.ApiError.parse({ error: "Request failed" })).toEqual({
      error: "Request failed",
    });
  });
});
import type { ZodType } from "zod";
