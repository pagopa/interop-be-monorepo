import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DashboardApiConfig } from "../src/config/config.js";

describe("dashboard startup configuration", () => {
  it("keeps the default backend checkout rooted at the repository after moving config into its own directory", () => {
    expect(DashboardApiConfig.parse({}).beRoot).toBe(
      resolve(fileURLToPath(new URL("../../..", import.meta.url)))
    );
  });

  it("derives local dashboard paths from the backend checkout with the existing startup defaults", () => {
    const config = DashboardApiConfig.parse({ INTEROP_BE_ROOT: "/be" });

    expect(config).toEqual({
      beRoot: "/be",
      port: 8076,
      autostart: true,
      autostartPreset: undefined,
      frontendUrl: undefined,
      personalPath: "/be/.local-development/dashboard/presets.json",
      bootstrapLogPath: "/be/.local-development/dashboard/logs/bootstrap.log",
      uiRoot: "/be/packages/dev-dashboard-ui/dist",
    });
  });

  it("resolves checkout overrides and preserves selected preset, port, and disabled autostart settings", () => {
    const config = DashboardApiConfig.parse({
      INTEROP_BE_ROOT: "../backend",
      INTEROP_FE_ROOT: "../frontend",
      DASHBOARD_AUTOSTART_PRESET: "frontend-full",
      DASHBOARD_PORT: "8090",
      DASHBOARD_AUTOSTART: "false",
    });

    expect(config).toMatchObject({
      beRoot: resolve("../backend"),
      autostartPreset: "frontend-full",
      port: 8090,
      autostart: false,
    });
    expect(config).not.toHaveProperty("feRoot");
  });

  it.each([undefined, "true", "0", ""])(
    "keeps autostart enabled for %s, matching the startup boundary",
    (autostart) => {
      expect(
        DashboardApiConfig.parse({ DASHBOARD_AUTOSTART: autostart }).autostart
      ).toBe(true);
    }
  );

  it.each(["0", "65536", "8076.5", "invalid"])(
    "rejects invalid dashboard port %s before startup",
    (port) => {
      expect(() =>
        DashboardApiConfig.parse({ DASHBOARD_PORT: port })
      ).toThrow();
    }
  );

  it.each(["with/slash", "contains spaces", "x".repeat(101)])(
    "rejects invalid autostart preset id %s before startup",
    (presetId) => {
      expect(() =>
        DashboardApiConfig.parse({ DASHBOARD_AUTOSTART_PRESET: presetId })
      ).toThrow();
    }
  );

  it.each([undefined, ""])(
    "starts with infrastructure only when no preset is selected (%s)",
    (presetId) => {
      expect(
        DashboardApiConfig.parse({ DASHBOARD_AUTOSTART_PRESET: presetId })
          .autostartPreset
      ).toBeUndefined();
    }
  );

  it("does not expose a global mode in parsed startup configuration", () => {
    expect(DashboardApiConfig.parse({})).not.toHaveProperty("mode");
  });

  it("enables frontend observation only with an explicit local observer URL", () => {
    expect(DashboardApiConfig.parse({}).frontendUrl).toBeUndefined();
    expect(
      DashboardApiConfig.parse({
        DASHBOARD_FRONTEND_URL: "http://frontend:8077/",
      }).frontendUrl
    ).toBe("http://frontend:8077");
  });

  it.each([
    "https://frontend:8077",
    "http://example.com:8077",
    "http://user:password@frontend:8077",
    "http://frontend:8077/arbitrary",
    "http://frontend:8077/?token=secret",
  ])("rejects a non-local frontend observer URL: %s", (url) => {
    expect(() =>
      DashboardApiConfig.parse({ DASHBOARD_FRONTEND_URL: url })
    ).toThrow();
  });
});
