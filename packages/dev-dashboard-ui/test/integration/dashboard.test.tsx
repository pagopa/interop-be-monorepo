import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/App";
import { createDashboardRouter } from "../../src/router/DashboardRoutes";
import {
  emptyLogs,
  identitiesFixture,
  seedPackagesFixture,
  statusFixture,
} from "../fixtures";

const bffName = "pagopa-interop-backend-for-frontend";
const workerName = "pagopa-interop-catalog-readmodel-writer-sql";
const tenantName = "pagopa-interop-tenant-process";
const infrastructureActions = [
  { intent: "start", label: "Start infrastructure" },
  { intent: "stop", label: "Stop infrastructure" },
  { intent: "reset", label: "Reset infrastructure" },
] satisfies Array<{ intent: "start" | "stop" | "reset"; label: string }>;

let currentStatus = statusFixture();
let failActions = false;
let failPresetSave = false;
let operationPending = false;
const fetchMock = vi.fn<typeof fetch>();
const routers = new Set<ReturnType<typeof createDashboardRouter>>();

function renderDashboard() {
  const router = createDashboardRouter();
  routers.add(router);
  return render(<App router={router} />);
}

afterEach(() => {
  for (const router of routers) router.dispose();
  routers.clear();
});

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  window.history.replaceState(null, "", "#/packages");
  currentStatus = statusFixture();
  failActions = false;
  failPresetSave = false;
  operationPending = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/status")) return Response.json(currentStatus);
    if (url.includes("/logs?")) return Response.json(emptyLogs);
    if (url.endsWith("/identities")) return Response.json(identitiesFixture);
    if (url.endsWith("/identity"))
      return Response.json({ sessionToken: "local-session-token" });
    if (url.endsWith("/actions")) {
      if (failActions)
        return Response.json(
          { error: "Port 3600 is already in use" },
          { status: 409 }
        );
      currentStatus = {
        ...currentStatus,
        operations: [
          ...currentStatus.operations,
          {
            id: "new-operation",
            kind: "action",
            state: operationPending ? "running" : "passed",
            startedAt: "2026-10-06T10:01:00Z",
            phases: [],
          },
        ],
      };
      return Response.json({ operationId: "new-operation" }, { status: 202 });
    }
    if (url.endsWith("/presets") && init?.method === "POST") {
      if (failPresetSave)
        return Response.json(
          { error: "Could not save preset" },
          { status: 409 }
        );
      return Response.json({
        id: "created",
        source: "personal",
        ...JSON.parse(String(init.body)),
      });
    }
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

function postedBodies(path: string) {
  return fetchMock.mock.calls
    .filter(
      ([input, init]) => String(input).endsWith(path) && init?.method === "POST"
    )
    .map(([, init]) => JSON.parse(String(init?.body)));
}

describe("development dashboard", () => {
  it.each([
    { kind: "preset.start", state: "pending", button: "Start" },
    { kind: "preset.start", state: "running", button: "Start" },
    { kind: "preset.stop", state: "pending", button: "Stop" },
    { kind: "preset.stop", state: "running", button: "Stop" },
  ] satisfies Array<{
    kind: "preset.start" | "preset.stop";
    state: "pending" | "running";
    button: string;
  }>)(
    "restores the $state $kind progress and locks preset controls after reload",
    async ({ kind, state, button }) => {
      const preset = currentStatus.presets[1];
      currentStatus = {
        ...currentStatus,
        operations: [
          {
            id: "preset-operation",
            kind,
            presetId: preset.id,
            state,
            startedAt: "2026-10-06T10:01:00Z",
            phases: [],
          },
        ],
      };
      window.history.replaceState(null, "", "#/presets");
      renderDashboard();
      const row = within(
        await screen.findByRole("article", { name: preset.name })
      );
      for (const action of ["Start", "Stop", "Edit", "Delete"])
        expect(
          row.getByRole("button", { name: `${action} ${preset.name}` })
        ).toBeDisabled();
      expect(
        row.getByRole("button", { name: `${button} ${preset.name}` })
      ).toHaveAttribute("aria-busy", "true");
      expect(row.getByRole("status")).toBeVisible();
      const otherPreset = currentStatus.presets[0];
      expect(
        within(
          screen.getByRole("article", { name: otherPreset.name })
        ).getByRole("button", { name: `Start ${otherPreset.name}` })
      ).toBeEnabled();

      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((operation) => ({
          ...operation,
          state: "passed",
        })),
      };
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Refresh runtime status" }));
      await waitFor(() =>
        expect(
          row.getByRole("button", { name: `Edit ${preset.name}` })
        ).toBeEnabled()
      );
      expect(
        row.getByRole("button", { name: `Delete ${preset.name}` })
      ).toBeEnabled();
      expect(row.queryByRole("status")).not.toBeInTheDocument();
      expect(postedBodies("/actions")).toEqual([]);
    }
  );

  it("removes operation navigation and timelines from all dashboard pages", async () => {
    renderDashboard();
    await screen.findByRole("heading", { name: "Package catalogue" });
    expect(
      screen.queryByRole("link", { name: /^Operations/ })
    ).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "Logs" }));
    expect(
      await screen.findByRole("heading", { name: "Aggregate logs" })
    ).toBeVisible();
    expect(
      screen.queryByRole("region", { name: "Active operation" })
    ).not.toBeInTheDocument();
  });
  it("provides keyboard-accessible links to dedicated runtime views", async () => {
    const user = userEvent.setup();
    renderDashboard();
    const navigation = screen.getByRole("navigation", {
      name: "Runtime tools",
    });
    const first = within(navigation).getByRole("link", { name: "Packages" });
    for (const name of [
      "Packages",
      "Presets",
      "Infrastructure",
      "Access token",
      "Logs",
    ]) {
      expect(within(navigation).getByRole("link", { name })).toHaveAttribute(
        "href"
      );
    }
    await screen.findByRole("heading", { name: "Package catalogue" });
    expect(first).toHaveAttribute("aria-current", "page");
    expect(screen.queryByLabelText("Search logs")).not.toBeInTheDocument();
    first.focus();
    await user.tab();
    expect(
      within(navigation).getByRole("link", { name: "Presets" })
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("heading", {
        name: "Presets",
      })
    ).toBeVisible();
    expect(window.location.hash).toBe("#/presets");
    expect(
      screen.queryByRole("heading", { name: "Package catalogue" })
    ).not.toBeInTheDocument();
  });

  it("opens package logs in a dedicated filtered view and restores it on reload and browser back", async () => {
    const user = userEvent.setup();
    const outerScroll = vi
      .spyOn(window, "scrollTo")
      .mockImplementation(() => undefined);
    const view = renderDashboard();
    const content = screen.getByRole("main");
    content.scrollTop = 320;
    content.scrollLeft = 40;
    await user.click(
      await screen.findByRole("button", { name: `Logs for ${bffName}` })
    );
    expect(await screen.findByLabelText("Source")).toHaveValue(bffName);
    expect(screen.getByRole("combobox", { name: "Level" })).toHaveValue("");
    expect(window.location.hash).toBe(`#/logs?source=${bffName}`);
    expect(content.scrollTop).toBe(0);
    expect(content.scrollLeft).toBe(0);
    expect(outerScroll).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Logs" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.queryByRole("heading", { name: "Package catalogue" })
    ).not.toBeInTheDocument();
    view.unmount();
    renderDashboard();
    expect(await screen.findByLabelText("Source")).toHaveValue(bffName);
    await user.click(screen.getByRole("link", { name: "Infrastructure" }));
    expect(
      await screen.findByRole("heading", { name: "Local infrastructure" })
    ).toBeVisible();
    window.history.back();
    await waitFor(() =>
      expect(screen.getByLabelText("Source")).toHaveValue(bffName)
    );
  });

  it("loads the requested section directly from its URL", async () => {
    window.history.replaceState(null, "", "#/access-token");
    renderDashboard();
    expect(
      await screen.findByRole("heading", { name: "Local access token" })
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Package catalogue" })
    ).not.toBeInTheDocument();
  });

  it.each([
    { source: "group:packages", label: "All packages" },
    { source: "group:infra", label: "Infra" },
  ])(
    "keeps the $label aggregate source through URL changes, reload and browser back without resetting page scroll or focus",
    async ({ source: initialSource, label }) => {
      window.history.replaceState(
        null,
        "",
        `#/logs?${new URLSearchParams({ source: initialSource, level: "error" })}`
      );
      const user = userEvent.setup();
      const view = renderDashboard();
      const source = await screen.findByRole("combobox", { name: "Source" });
      expect(within(source).getByRole("option", { name: label })).toHaveValue(
        initialSource
      );
      expect(source).toHaveValue(initialSource);
      const content = screen.getByRole("main");
      content.scrollTop = 120;
      content.scrollLeft = 20;
      const level = screen.getByRole("combobox", { name: "Level" });
      await user.selectOptions(level, "warn");
      expect(level).toHaveFocus();
      expect(content.scrollTop).toBe(120);
      expect(content.scrollLeft).toBe(20);
      await waitFor(() =>
        expect(window.location.hash).toBe(
          `#/logs?${new URLSearchParams({ source: initialSource, level: "warn" })}`
        )
      );
      await waitFor(() =>
        expect(
          fetchMock.mock.calls.some(([input]) => {
            const query = new URL(String(input)).searchParams;
            return (
              query.get("source") === initialSource &&
              query.get("level") === "warn"
            );
          })
        ).toBe(true)
      );
      view.unmount();
      renderDashboard();
      expect(
        await screen.findByRole("combobox", { name: "Source" })
      ).toHaveValue(initialSource);
      expect(screen.getByRole("combobox", { name: "Level" })).toHaveValue(
        "warn"
      );
      await user.selectOptions(
        screen.getByRole("combobox", { name: "Source" }),
        "group:seed"
      );
      await waitFor(() =>
        expect(window.location.hash).toContain("source=group%3Aseed")
      );
      window.history.back();
      await waitFor(() =>
        expect(screen.getByRole("combobox", { name: "Source" })).toHaveValue(
          initialSource
        )
      );
      expect(screen.getByRole("combobox", { name: "Level" })).toHaveValue(
        "warn"
      );
      expect(postedBodies("/actions")).toEqual([]);
    }
  );

  it("keeps preset source and level filters through changes, refresh, reload and browser back", async () => {
    window.history.replaceState(
      null,
      "",
      "#/logs?source=preset%3Abackend&level=error"
    );
    const user = userEvent.setup();
    const view = renderDashboard();
    const source = await screen.findByRole("combobox", { name: "Source" });
    await within(source).findByRole("option", { name: "Backend core" });
    expect(source).toHaveValue("preset:backend");
    const level = screen.getByRole("combobox", { name: "Level" });
    expect(level).toHaveValue("error");
    await user.selectOptions(source, "preset:personal-core");
    await waitFor(() =>
      expect(window.location.hash).toBe(
        "#/logs?source=preset%3Apersonal-core&level=error"
      )
    );
    expect(level).toHaveValue("error");
    await user.selectOptions(level, "warn");
    await waitFor(() =>
      expect(window.location.hash).toBe(
        "#/logs?source=preset%3Apersonal-core&level=warn"
      )
    );
    expect(source).toHaveValue("preset:personal-core");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Refresh logs" })).toBeEnabled()
    );
    const requestedBeforeRefresh = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/logs?")
    ).length;
    await user.click(screen.getByRole("button", { name: "Refresh logs" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).includes("/logs?")
        ).length
      ).toBeGreaterThan(requestedBeforeRefresh)
    );
    expect(source).toHaveValue("preset:personal-core");
    view.unmount();
    renderDashboard();
    const restoredSource = await screen.findByRole("combobox", {
      name: "Source",
    });
    await within(restoredSource).findByRole("option", { name: "My core" });
    expect(restoredSource).toHaveValue("preset:personal-core");
    expect(screen.getByRole("combobox", { name: "Level" })).toHaveValue("warn");
    expect(
      within(restoredSource).queryByRole("option", {
        name: "preset:personal-core",
      })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Infrastructure" }));
    await screen.findByRole("heading", { name: "Local infrastructure" });
    window.history.back();
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Source" })).toHaveValue(
        "preset:personal-core"
      )
    );
    expect(screen.getByRole("combobox", { name: "Level" })).toHaveValue("warn");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Level" }),
      "info"
    );
    await waitFor(() =>
      expect(window.location.hash).toBe(
        "#/logs?source=preset%3Apersonal-core&level=info"
      )
    );
    window.history.back();
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Level" })).toHaveValue(
        "warn"
      )
    );
    expect(screen.getByRole("combobox", { name: "Source" })).toHaveValue(
      "preset:personal-core"
    );
    expect(postedBodies("/actions")).toEqual([]);
  });

  it.each(["verbose", "ERROR", "<invalid>"])(
    "ignores an invalid URL log level '%s' before requesting logs",
    async (level) => {
      window.history.replaceState(
        null,
        "",
        `#/logs?${new URLSearchParams({ source: "preset:backend", level })}`
      );
      renderDashboard();
      const source = await screen.findByRole("combobox", { name: "Source" });
      await within(source).findByRole("option", { name: "Backend core" });
      expect(source).toHaveValue("preset:backend");
      expect(screen.getByRole("combobox", { name: "Level" })).toHaveValue("");
      await waitFor(() =>
        expect(
          fetchMock.mock.calls.some(([input]) =>
            String(input).includes("/logs?")
          )
        ).toBe(true)
      );
      expect(
        fetchMock.mock.calls
          .filter(([input]) => String(input).includes("/logs?"))
          .every(
            ([input]) =>
              !new URL(String(input), "http://localhost").searchParams.has(
                "level"
              )
          )
      ).toBe(true);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
  );

  it.each(["Clear log filters", "Logs"])(
    "removes both source and level with %s",
    async (control) => {
      window.history.replaceState(
        null,
        "",
        "#/logs?source=preset%3Abackend&level=error"
      );
      const user = userEvent.setup();
      renderDashboard();
      const source = await screen.findByRole("combobox", { name: "Source" });
      await within(source).findByRole("option", { name: "Backend core" });
      expect(screen.getByRole("combobox", { name: "Level" })).toHaveValue(
        "error"
      );
      if (control === "Logs")
        await user.click(screen.getByRole("link", { name: "Logs" }));
      else await user.click(screen.getByRole("button", { name: control }));
      await waitFor(() => expect(window.location.hash).toBe("#/logs"));
      expect(source).toHaveValue("");
      expect(screen.getByRole("combobox", { name: "Level" })).toHaveValue("");
      await waitFor(() =>
        expect(
          fetchMock.mock.calls.some(([input]) => {
            if (!String(input).includes("/logs?")) return false;
            const params = new URL(String(input), "http://localhost")
              .searchParams;
            return !params.has("source") && !params.has("level");
          })
        ).toBe(true)
      );
      expect(postedBodies("/actions")).toEqual([]);
    }
  );

  it("opens a preset's packages without starting anything and restores the filter after reload", async () => {
    const user = userEvent.setup();
    const view = renderDashboard();
    await user.click(screen.getByRole("link", { name: "Presets" }));
    await user.click(
      await screen.findByRole("link", { name: "View packages in Backend core" })
    );
    expect(await screen.findByRole("combobox", { name: "Group" })).toHaveValue(
      "preset:backend"
    );
    expect(window.location.hash).toBe("#/packages?preset=backend");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(
      screen.getByRole("row", { name: new RegExp(bffName) })
    ).toBeVisible();
    expect(postedBodies("/actions")).toEqual([]);
    view.unmount();
    renderDashboard();
    expect(await screen.findByRole("combobox", { name: "Group" })).toHaveValue(
      "preset:backend"
    );
    expect(screen.getAllByRole("row")).toHaveLength(2);
    await user.click(screen.getByRole("link", { name: "Packages" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Group" })).toHaveValue("")
    );
    expect(window.location.hash).toBe("#/packages");
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });

  it("updates the URL from the preset filter and restores it with browser back while clearing selection", async () => {
    window.history.replaceState(null, "", "#/packages?preset=backend");
    const user = userEvent.setup();
    renderDashboard();
    const preset = await screen.findByRole("combobox", { name: "Group" });
    expect(preset).toHaveValue("preset:backend");
    await user.selectOptions(preset, "preset:personal-core");
    await waitFor(() =>
      expect(window.location.hash).toBe("#/packages?preset=personal-core")
    );
    expect(
      screen.getByRole("row", { name: new RegExp(workerName) })
    ).toBeVisible();
    await user.click(
      screen.getByRole("checkbox", { name: `Select ${workerName}` })
    );
    expect(screen.getByText("1 selected")).toBeVisible();
    window.history.back();
    await waitFor(() => expect(preset).toHaveValue("preset:backend"));
    expect(screen.getByText("0 selected")).toBeVisible();
    expect(
      screen.getByRole("row", { name: new RegExp(bffName) })
    ).toBeVisible();
    expect(postedBodies("/actions")).toEqual([]);
  });

  it("keeps a removed preset filter empty and allows an explicit reset to all packages", async () => {
    window.history.replaceState(null, "", "#/packages?preset=backend");
    const user = userEvent.setup();
    renderDashboard();
    const preset = await screen.findByRole("combobox", { name: "Group" });
    currentStatus = statusFixture({ presets: [] });
    await user.click(
      screen.getByRole("button", { name: "Refresh runtime status" })
    );
    await screen.findByText("This preset is no longer available.");
    expect(preset).toHaveValue("preset:backend");
    expect(window.location.hash).toBe("#/packages?preset=backend");
    expect(screen.getAllByRole("row")).toHaveLength(1);
    await user.selectOptions(preset, "");
    await waitFor(() => expect(window.location.hash).toBe("#/packages"));
    expect(screen.getAllByRole("row")).toHaveLength(4);
    expect(postedBodies("/actions")).toEqual([]);
  });

  it.each(["running", "passed"])(
    "keeps seed package and log navigation available during a %s seed startup without automatic navigation",
    async (state) => {
      currentStatus = seedPackagesFixture();
      const seedNames = currentStatus.seedPackages;
      const implementation = fetchMock.getMockImplementation();
      if (!implementation) throw new Error("Missing dashboard fixture handler");
      fetchMock.mockImplementation(async (input, init) => {
        if (!String(input).endsWith("/actions"))
          return implementation(input, init);
        currentStatus = {
          ...currentStatus,
          seedPrerequisites: [],
          packages: currentStatus.packages.map((item) =>
            seedNames.includes(item.name)
              ? { ...item, state: state === "running" ? "starting" : "running" }
              : item
          ),
          operations: [
            {
              id: "seed-startup",
              kind: "seed.prepare",
              state: state === "running" ? "running" : "passed",
              startedAt: "2026-10-08T15:00:00Z",
              phases: seedNames.map((name) => ({
                id: `start:${name}`,
                label: name,
                state: state === "running" ? "running" : "passed",
              })),
            },
          ],
        };
        return Response.json({ operationId: "seed-startup" }, { status: 202 });
      });
      window.history.replaceState(null, "", "#/access-token");
      const user = userEvent.setup();
      renderDashboard();
      const start = await screen.findByRole("button", {
        name: "Start seed packages",
      });
      const link = screen.getByRole("link", { name: "View seed packages" });
      expect(link).toHaveAttribute("href", "#/packages?group=seed");
      expect(
        screen.getByRole("link", { name: "Logs for seed packages" })
      ).toHaveAttribute("href", "#/logs?source=group%3Aseed");
      await user.click(start);
      await waitFor(() =>
        expect(postedBodies("/actions")).toEqual([{ type: "seed.prepare" }])
      );
      await waitFor(() =>
        expect(start).toHaveAttribute(
          "aria-busy",
          state === "running" ? "true" : "false"
        )
      );
      expect(window.location.hash).toBe("#/access-token");
      expect(link).toBeVisible();
      expect(link).not.toHaveAttribute("aria-disabled", "true");
      if (state === "running") expect(start).toBeDisabled();
      await user.click(link);
      expect(
        await screen.findByRole("combobox", { name: "Group" })
      ).toHaveValue("seed");
      expect(window.location.hash).toBe("#/packages?group=seed");
      expect(screen.getAllByRole("row")).toHaveLength(5);
      expect(
        screen.queryByRole("row", { name: new RegExp(bffName) })
      ).not.toBeInTheDocument();
      for (const name of seedNames) {
        const row = screen.getByRole("row", { name: new RegExp(name) });
        expect(row).toBeVisible();
        expect(
          within(row).getByRole("button", {
            name: `${state === "running" ? "Start" : "Stop"} ${name}`,
          })
        ).toHaveAttribute("aria-busy", state === "running" ? "true" : "false");
        expect(
          within(row).getByRole("button", { name: `Logs for ${name}` })
        ).toBeEnabled();
      }
      await user.click(
        screen.getByRole("button", { name: `Logs for ${seedNames[0]}` })
      );
      expect(
        await screen.findByRole("combobox", { name: "Source" })
      ).toHaveValue(seedNames[0]);
      await user.click(screen.getByRole("link", { name: "Access token" }));
      await user.click(
        await screen.findByRole("link", { name: "Logs for seed packages" })
      );
      expect(
        await screen.findByRole("combobox", { name: "Source" })
      ).toHaveValue("group:seed");
      expect(window.location.hash).toBe("#/logs?source=group%3Aseed");
      expect(postedBodies("/actions")).toEqual([{ type: "seed.prepare" }]);
    }
  );

  it("retains the complete seed group and selection on refresh, preserves its URL on reload/back and clears group queries on filter changes", async () => {
    currentStatus = seedPackagesFixture();
    const seedNames = currentStatus.seedPackages;
    window.history.replaceState(null, "", "#/packages?group=seed");
    const user = userEvent.setup();
    const view = renderDashboard();
    const group = await screen.findByRole("combobox", { name: "Group" });
    expect(group).toHaveValue("seed");
    expect(screen.getAllByRole("row")).toHaveLength(5);
    await user.click(
      screen.getByRole("checkbox", { name: `Select ${seedNames[0]}` })
    );
    currentStatus = {
      ...currentStatus,
      seedPrerequisites: [],
      seedPackages: [...seedNames],
      packages: currentStatus.packages.map((item) => ({
        ...item,
        state: "running",
      })),
    };
    await user.click(
      screen.getByRole("button", { name: "Refresh runtime status" })
    );
    await screen.findByRole("button", { name: `Stop ${seedNames[1]}` });
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(
      screen.getByRole("checkbox", { name: `Select ${seedNames[0]}` })
    ).toBeChecked();
    expect(screen.getByText("1 selected")).toBeVisible();
    expect(window.location.hash).toBe("#/packages?group=seed");
    await user.selectOptions(group, "preset:backend");
    await waitFor(() =>
      expect(window.location.hash).toBe("#/packages?preset=backend")
    );
    expect(screen.getByText("0 selected")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    await user.click(
      screen.getByRole("checkbox", { name: `Select ${bffName}` })
    );
    await user.selectOptions(group, "");
    await waitFor(() => expect(window.location.hash).toBe("#/packages"));
    expect(screen.getByText("0 selected")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(6);
    window.history.back();
    await waitFor(() => expect(group).toHaveValue("preset:backend"));
    window.history.back();
    await waitFor(() => expect(group).toHaveValue("seed"));
    expect(screen.getAllByRole("row")).toHaveLength(5);
    view.unmount();
    renderDashboard();
    expect(await screen.findByRole("combobox", { name: "Group" })).toHaveValue(
      "seed"
    );
    expect(window.location.hash).toBe("#/packages?group=seed");
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(postedBodies("/actions")).toEqual([]);
  });

  it("keeps startup phases out of the package view", async () => {
    renderDashboard();
    await screen.findByRole("heading", { name: "Package catalogue" });
    expect(
      screen.queryByRole("region", { name: "Latest operation" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Build packages")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Operations/ })
    ).not.toBeInTheDocument();
  });

  it("keeps active and completed startup phases out of the logs view", async () => {
    const fixture = statusFixture();
    currentStatus = statusFixture({
      operations: [
        { ...fixture.operations[0], state: "running" },
        {
          id: "later",
          kind: "seed",
          state: "passed",
          startedAt: "2026-10-06T11:00:00Z",
          phases: [],
        },
      ],
    });
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole("link", { name: "Logs" }));
    await screen.findByRole("heading", { name: "Aggregate logs" });
    expect(
      screen.queryByRole("region", { name: "Active operation" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Build packages")).not.toBeInTheDocument();
    currentStatus = {
      ...currentStatus,
      operations: currentStatus.operations.map((operation) => ({
        ...operation,
        state: "passed",
      })),
    };
    await user.click(
      screen.getByRole("button", { name: "Refresh runtime status" })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Active operation" })
      ).not.toBeInTheDocument()
    );
    expect(screen.queryByText("Build packages")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Operations/ })
    ).not.toBeInTheDocument();
  });

  it("redirects the removed operations route to packages without exposing operation details", async () => {
    const fixture = statusFixture();
    currentStatus = statusFixture({
      operations: [
        ...fixture.operations,
        {
          id: "failed-start",
          kind: "package.start",
          state: "failed",
          startedAt: "2026-10-06T10:01:00Z",
          error: "Build failed: invalid package configuration",
          phases: [],
        },
        {
          id: "later",
          kind: "seed",
          state: "passed",
          startedAt: "2026-10-06T10:02:00Z",
          phases: [],
        },
      ],
    });
    window.history.replaceState(null, "", "#/operations");
    renderDashboard();
    await screen.findByRole("heading", { name: "Package catalogue" });
    expect(window.location.hash).toBe("#/packages");
    expect(
      screen.queryByText("Build failed: invalid package configuration")
    ).not.toBeInTheDocument();
  });

  it("keeps a package busy until the accepted operation finishes and permits unrelated package controls", async () => {
    operationPending = true;
    const user = userEvent.setup();
    renderDashboard();
    await user.click(
      await screen.findByRole("button", { name: `Start ${bffName}` })
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: `Start ${bffName}` })
      ).toBeDisabled()
    );
    expect(
      screen.getByRole("checkbox", { name: `Watch ${bffName}` })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: `Stop ${workerName}` })
    ).toBeEnabled();
    currentStatus = {
      ...currentStatus,
      operations: currentStatus.operations.map((operation) => ({
        ...operation,
        state: "passed",
      })),
    };
    await user.click(
      screen.getByRole("button", { name: "Refresh runtime status" })
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: `Start ${bffName}` })
      ).toBeEnabled()
    );
  });

  it("stops only the selected running package", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(
      await screen.findByRole("button", { name: `Stop ${workerName}` })
    );
    await waitFor(() =>
      expect(postedBodies("/actions")).toEqual([
        { type: "package.stop", name: workerName },
      ])
    );
  });

  it("edits and deletes a personal preset without stopping its members", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole("link", { name: "Presets" }));
    await screen.findByRole("heading", { name: "Presets" });
    await user.click(screen.getByRole("button", { name: "Edit My core" }));
    const dialog = screen.getByRole("dialog", { name: "Edit local preset" });
    const form = within(dialog).getByRole("form", { name: "Local preset" });
    expect(
      within(form).queryByRole("checkbox", { name: /seed/i })
    ).not.toBeInTheDocument();
    expect(within(form).getByLabelText("Preset name")).toHaveFocus();
    await user.clear(within(form).getByLabelText("Preset name"));
    await user.type(within(form).getByLabelText("Preset name"), "My worker");
    await user.click(within(form).getByRole("button", { name: "Save preset" }));
    await waitFor(() =>
      expect(postedBodies("/presets")).toContainEqual({
        id: "personal-core",
        name: "My worker",
        packages: [{ name: workerName, watch: false }],
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit My core" })).toHaveFocus()
    );
    await user.click(screen.getByRole("button", { name: "Delete My core" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete preset",
      })
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).endsWith("/presets/personal-core") &&
            init?.method === "DELETE"
        )
      ).toBe(true)
    );
    expect(postedBodies("/actions")).toEqual([]);
  });

  it("filters infrastructure logs by the selected container source", async () => {
    currentStatus = statusFixture({
      logSources: [
        { id: "infra:postgres", label: "Postgres", kind: "infrastructure" },
      ],
    });
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole("link", { name: "Infrastructure" }));
    await user.click(
      await screen.findByRole("button", { name: "Logs for postgres" })
    );
    expect(await screen.findByLabelText("Source")).toHaveValue(
      "infra:postgres"
    );
    expect(window.location.hash).toBe("#/logs?source=infra%3Apostgres");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input]) =>
            new URL(String(input), "http://localhost").searchParams.get(
              "source"
            ) === "infra:postgres"
        )
      ).toBe(true)
    );
  });

  it.each([
    { path: "packages", heading: "Package catalogue" },
    { path: "presets", heading: "Presets" },
    { path: "infrastructure", heading: "Local infrastructure" },
    { path: "access-token", heading: "Local access token" },
    { path: "logs", heading: "Aggregate logs" },
  ])(
    "never exposes frontend lifecycle controls on the backend $path page",
    async ({ path, heading }) => {
      window.history.replaceState(null, "", `#/${path}`);
      renderDashboard();
      await screen.findByRole("heading", { name: heading });
      const toolbar = screen.getByRole("region", { name: "Runtime status" });
      expect(
        within(toolbar).getByRole("button", { name: "Refresh runtime status" })
      ).toBeEnabled();
      expect(
        screen.queryByRole("button", { name: "Start fullstack" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Stop fullstack" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("Frontend environment")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Restart frontend" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Open frontend" })
      ).not.toBeInTheDocument();
    }
  );

  it("starts one package and changes its watch mode without replacing other running packages", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(
      await screen.findByRole("button", { name: `Start ${bffName}` })
    );
    await waitFor(() =>
      expect(postedBodies("/actions")).toContainEqual({
        type: "package.start",
        name: bffName,
      })
    );
    await user.click(
      await screen.findByRole("checkbox", { name: `Watch ${bffName}` })
    );
    await waitFor(() =>
      expect(postedBodies("/actions")).toContainEqual({
        type: "package.watch",
        name: bffName,
        watch: true,
      })
    );
    expect(
      screen.getByRole("button", { name: `Stop ${workerName}` })
    ).toBeEnabled();
    expect(postedBodies("/actions")).not.toContainEqual({
      type: "package.stop",
      name: workerName,
    });
  });

  it("allows an idle package to start and change watch mode without configuration gating", async () => {
    const user = userEvent.setup();
    renderDashboard();
    const start = await screen.findByRole("button", {
      name: `Start ${tenantName}`,
    });
    expect(start).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: `Watch ${tenantName}` })
    ).toBeEnabled();
    expect(screen.queryByText("Needs configuration")).not.toBeInTheDocument();
    await user.click(start);
    await waitFor(() =>
      expect(postedBodies("/actions")).toEqual([
        { type: "package.start", name: tenantName },
      ])
    );
  });

  it("runs an additive shared preset, while shared presets cannot be edited or deleted", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole("link", { name: "Presets" }));
    await user.click(
      await screen.findByRole("button", { name: "Start Backend core" })
    );
    await waitFor(() =>
      expect(postedBodies("/actions")).toContainEqual({
        type: "preset.start",
        id: "backend",
      })
    );
    expect(
      screen.queryByRole("button", { name: "Edit Backend core" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete Backend core" })
    ).not.toBeInTheDocument();
  });

  it("omits operation cards and history navigation from Presets", async () => {
    const fixture = statusFixture();
    currentStatus = statusFixture({
      operations: fixture.operations.map((operation) => ({
        ...operation,
        state: "running",
      })),
    });
    window.history.replaceState(null, "", "#/presets");
    renderDashboard();
    await screen.findByRole("heading", { name: "Presets" });
    expect(
      screen.queryByRole("region", { name: "Active operation" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Build packages")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Operations/ })
    ).not.toBeInTheDocument();
  });

  it.each(["start", "stop"])(
    "loads only the preset %s button from POST through acceptance until the operation finishes",
    async (intent) => {
      const fixture = statusFixture();
      currentStatus = statusFixture({
        packages: fixture.packages.map((item, index) => ({
          ...item,
          state:
            index === 0
              ? intent === "stop"
                ? "running"
                : "stopped"
              : item.state,
        })),
        operations: [],
      });
      let finishPost: (response: Response) => void = () => undefined;
      const post = new Promise<Response>((resolve) => {
        finishPost = resolve;
      });
      const implementation = fetchMock.getMockImplementation();
      if (!implementation) throw new Error("Missing dashboard fixture handler");
      fetchMock.mockImplementation((input, init) =>
        String(input).endsWith("/actions") ? post : implementation(input, init)
      );
      window.history.replaceState(null, "", "#/presets");
      const user = userEvent.setup();
      renderDashboard();
      const start = await screen.findByRole("button", {
        name: "Start Backend core",
      });
      const stop = screen.getByRole("button", { name: "Stop Backend core" });
      const article = screen.getByRole("article", { name: "Backend core" });
      const pressed = intent === "start" ? start : stop;
      const other = intent === "start" ? stop : start;
      await user.click(pressed);
      expect(pressed).toHaveAttribute("aria-busy", "true");
      expect(within(pressed).getByRole("status")).toHaveTextContent(
        "Preset operation in progress"
      );
      expect(other).toHaveAttribute("aria-busy", "false");
      expect(within(other).queryByRole("status")).not.toBeInTheDocument();
      expect(start).toBeDisabled();
      expect(stop).toBeDisabled();
      expect(
        screen.queryByText("Preset operation in progress…")
      ).not.toBeInTheDocument();
      await user.click(other);
      expect(postedBodies("/actions")).toEqual([
        { type: `preset.${intent}`, id: "backend" },
      ]);
      currentStatus = {
        ...currentStatus,
        packages: currentStatus.packages.map((item, index) => ({
          ...item,
          state:
            index === 0
              ? intent === "start"
                ? "running"
                : "stopped"
              : item.state,
        })),
        operations: [
          {
            ...fixture.operations[0],
            id: "preset-operation",
            kind: `preset.${intent}`,
            state: "running",
            phases: [
              { id: `${intent}:${bffName}`, label: "Process", state: "passed" },
            ],
          },
        ],
      };
      await act(async () => {
        finishPost(
          Response.json({ operationId: "preset-operation" }, { status: 202 })
        );
      });
      await waitFor(() =>
        expect(
          within(article).getByText(`${intent === "start" ? 1 : 0}/1 running`)
        ).toBeVisible()
      );
      expect(pressed).toHaveAttribute("aria-busy", "true");
      expect(other).toHaveAttribute("aria-busy", "false");
      expect(start).toBeDisabled();
      expect(stop).toBeDisabled();
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((operation) => ({
          ...operation,
          state: "passed",
        })),
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      await waitFor(() =>
        expect(pressed).toHaveAttribute("aria-busy", "false")
      );
      expect(within(pressed).queryByRole("status")).not.toBeInTheDocument();
      if (intent === "start") {
        expect(start).toBeDisabled();
        expect(stop).toBeEnabled();
      } else {
        expect(start).toBeEnabled();
        expect(stop).toBeDisabled();
      }
    }
  );

  it.each(["start", "stop"])(
    "clears preset %s loading after a rejected request",
    async (intent) => {
      const fixture = statusFixture();
      currentStatus = statusFixture({
        packages: fixture.packages.map((item, index) => ({
          ...item,
          state:
            index === 0
              ? intent === "stop"
                ? "running"
                : "stopped"
              : item.state,
        })),
      });
      failActions = true;
      window.history.replaceState(null, "", "#/presets");
      const user = userEvent.setup();
      renderDashboard();
      const pressed = await screen.findByRole("button", {
        name: `${intent === "start" ? "Start" : "Stop"} Backend core`,
      });
      await user.click(pressed);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Port 3600 is already in use"
      );
      expect(pressed).toHaveAttribute("aria-busy", "false");
      expect(pressed).toBeEnabled();
      expect(within(pressed).queryByRole("status")).not.toBeInTheDocument();
    }
  );

  it.each(["start", "stop"])(
    "shows a correlated preset %s failure, clears it immediately on retry and retains operation history",
    async (intent) => {
      const fixture = statusFixture();
      currentStatus = statusFixture({
        packages: fixture.packages.map((item, index) => ({
          ...item,
          state: index === 0 && intent === "stop" ? "running" : item.state,
        })),
        operations: [
          {
            ...fixture.operations[0],
            id: "historical-failure",
            state: "failed",
            error: "Unrelated historical failure",
          },
        ],
      });
      let finishPost: (response: Response) => void = () => undefined;
      let post = new Promise<Response>((resolve) => {
        finishPost = resolve;
      });
      const implementation = fetchMock.getMockImplementation();
      if (!implementation) throw new Error("Missing dashboard fixture handler");
      fetchMock.mockImplementation((input, init) =>
        String(input).endsWith("/actions") ? post : implementation(input, init)
      );
      window.history.replaceState(null, "", "#/presets");
      const user = userEvent.setup();
      renderDashboard();
      const pressed = await screen.findByRole("button", {
        name: `${intent === "start" ? "Start" : "Stop"} Backend core`,
      });
      const article = screen.getByRole("article", { name: "Backend core" });
      const otherPreset = screen.getByRole("article", { name: "My core" });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      await user.click(pressed);
      expect(pressed).toHaveAttribute("aria-busy", "true");
      expect(within(article).queryByRole("alert")).not.toBeInTheDocument();
      const operation = {
        ...fixture.operations[0],
        id: "failed-preset",
        kind: `preset.${intent}`,
        state: "pending",
        phases: [],
      } satisfies (typeof currentStatus.operations)[number];
      currentStatus = {
        ...currentStatus,
        operations: [...currentStatus.operations, operation],
      };
      await act(async () => {
        finishPost(
          Response.json({ operationId: operation.id }, { status: 202 })
        );
      });
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      expect(pressed).toHaveAttribute("aria-busy", "true");
      expect(within(article).queryByRole("alert")).not.toBeInTheDocument();
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((item) =>
          item.id === operation.id ? { ...item, state: "running" } : item
        ),
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      expect(pressed).toHaveAttribute("aria-busy", "true");
      expect(within(article).queryByRole("alert")).not.toBeInTheDocument();
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((item) =>
          item.id === operation.id
            ? { ...item, state: "failed", error: "Backend process failed" }
            : item
        ),
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      const failure = await within(article).findByRole("alert");
      expect(failure).toHaveTextContent(
        intent === "start" ? "Startup failed" : "Stop failed"
      );
      expect(failure).not.toHaveTextContent("Backend process failed");
      expect(
        within(failure).getByRole("link", { name: "Logs" })
      ).toHaveAttribute("href", "#/logs?source=preset%3Abackend&level=error");
      expect(
        within(failure).queryByRole("link", { name: "Operations" })
      ).not.toBeInTheDocument();
      expect(within(otherPreset).queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Active operation" })
      ).not.toBeInTheDocument();
      expect(pressed).toHaveAttribute("aria-busy", "false");
      expect(pressed).toBeEnabled();
      expect(within(pressed).queryByRole("status")).not.toBeInTheDocument();

      post = new Promise<Response>((resolve) => {
        finishPost = resolve;
      });
      await user.click(pressed);
      expect(within(article).queryByRole("alert")).not.toBeInTheDocument();
      expect(pressed).toHaveAttribute("aria-busy", "true");
      currentStatus = {
        ...currentStatus,
        operations: [
          ...currentStatus.operations,
          { ...operation, id: "retry-success", state: "passed" },
        ],
      };
      await act(async () => {
        finishPost(
          Response.json({ operationId: "retry-success" }, { status: 202 })
        );
      });
      await waitFor(() =>
        expect(pressed).toHaveAttribute("aria-busy", "false")
      );
      expect(within(article).queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /^Operations/ })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Backend process failed")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Unrelated historical failure")
      ).not.toBeInTheDocument();
    }
  );

  it("opens preset logs directly from an immediate startup failure without showing backend details", async () => {
    currentStatus = statusFixture({ operations: [] });
    const implementation = fetchMock.getMockImplementation();
    if (!implementation) throw new Error("Missing dashboard fixture handler");
    fetchMock.mockImplementation(async (input, init) => {
      if (!String(input).endsWith("/actions"))
        return implementation(input, init);
      currentStatus = {
        ...currentStatus,
        operations: [
          {
            id: "immediate-failure",
            kind: "preset.start",
            state: "failed",
            error: "Supervisor process could not start",
            startedAt: "2026-10-08T12:00:00Z",
            phases: [],
          },
        ],
      };
      return Response.json(
        { operationId: "immediate-failure" },
        { status: 202 }
      );
    });
    window.history.replaceState(null, "", "#/presets");
    const user = userEvent.setup();
    renderDashboard();
    const start = await screen.findByRole("button", {
      name: "Start Backend core",
    });
    await user.click(start);
    const article = screen.getByRole("article", { name: "Backend core" });
    const failure = await within(article).findByRole("alert");
    expect(failure).toHaveTextContent("Startup failed");
    expect(failure).not.toHaveTextContent("Supervisor process could not start");
    expect(failure).not.toHaveTextContent("No failure details were provided.");
    expect(start).toHaveAttribute("aria-busy", "false");
    expect(start).toBeEnabled();
    await user.click(within(failure).getByRole("link", { name: "Logs" }));
    expect(await screen.findByRole("combobox", { name: "Source" })).toHaveValue(
      "preset:backend"
    );
    expect(window.location.hash).toBe(
      "#/logs?source=preset%3Abackend&level=error"
    );
    expect(screen.getByRole("combobox", { name: "Level" })).toHaveValue(
      "error"
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const query = new URL(String(input), "http://localhost").searchParams;
          return (
            query.get("source") === "preset:backend" &&
            query.get("level") === "error"
          );
        })
      ).toBe(true)
    );
  });

  it("saves a local preset with package-level watch choices and seed disabled", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole("link", { name: "Presets" }));
    await user.click(await screen.findByRole("button", { name: "New preset" }));
    const dialog = screen.getByRole("dialog", { name: "Create local preset" });
    const form = within(dialog).getByRole("form", { name: "Local preset" });
    await user.type(
      within(form).getByLabelText("Preset name"),
      "Focused agreement"
    );
    await user.click(
      within(form).getByRole("checkbox", {
        name: "Include Backend for frontend",
      })
    );
    await user.click(
      within(form).getByRole("checkbox", { name: "Watch Backend for frontend" })
    );
    expect(
      within(form).queryByRole("checkbox", { name: /seed/i })
    ).not.toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: "Save preset" }));
    await waitFor(() =>
      expect(postedBodies("/presets")).toContainEqual({
        name: "Focused agreement",
        packages: [{ name: bffName, watch: true }],
      })
    );
  });

  it("keeps failed preset saves and their error visible inside the modal", async () => {
    failPresetSave = true;
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole("link", { name: "Presets" }));
    await user.click(await screen.findByRole("button", { name: "New preset" }));
    const dialog = screen.getByRole("dialog", { name: "Create local preset" });
    await user.type(
      within(dialog).getByLabelText("Preset name"),
      "Retry preset"
    );
    await user.click(
      within(dialog).getByRole("checkbox", {
        name: "Include Backend for frontend",
      })
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Save preset" })
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Could not save preset"
    );
    expect(dialog).toBeVisible();
    expect(within(dialog).getByLabelText("Preset name")).toHaveValue(
      "Retry preset"
    );
    expect(
      within(dialog).getByRole("button", { name: "Save preset" })
    ).toBeEnabled();
  });

  it("omits active operation cards from Infrastructure and Logs", async () => {
    const fixture = statusFixture();
    currentStatus = statusFixture({
      operations: [
        { ...fixture.operations[0], kind: "infra.start", state: "running" },
      ],
    });
    window.history.replaceState(null, "", "#/infrastructure");
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole("heading", { name: "Local infrastructure" });
    expect(
      screen.queryByRole("region", { name: "Active operation" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Build packages")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Logs" }));
    await screen.findByRole("heading", { name: "Aggregate logs" });
    expect(
      screen.queryByRole("region", { name: "Active operation" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Build packages")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Operations/ })
    ).not.toBeInTheDocument();
  });

  it.each(infrastructureActions)(
    "shows the correlated infrastructure $intent failure with logs and clears it on retry",
    async ({ intent, label }) => {
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
        440
      );
      vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
        800
      );
      const operation = {
        id: "infra-operation",
        kind: `infra.${intent}`,
        state: "pending",
        startedAt: "2026-10-08T12:00:00Z",
        phases: [],
      } satisfies (typeof currentStatus.operations)[number];
      currentStatus = statusFixture({
        operations: [
          {
            ...operation,
            id: "historical",
            state: "failed",
            error: "Old failure",
          },
        ],
      });
      let finishPost: (response: Response) => void = () => undefined;
      let post = new Promise<Response>((resolve) => {
        finishPost = resolve;
      });
      const implementation = fetchMock.getMockImplementation();
      if (!implementation) throw new Error("Missing dashboard fixture handler");
      fetchMock.mockImplementation(async (input, init) => {
        const url = new URL(String(input), window.location.origin);
        if (url.pathname.endsWith("/actions")) return post;
        if (url.pathname.endsWith("/logs"))
          return Response.json(
            url.searchParams.get("source") === "orchestration" &&
              url.searchParams.get("level") === "error"
              ? {
                  ...emptyLogs,
                  entries: [
                    {
                      id: "999",
                      source: "orchestration",
                      service: "orchestration",
                      level: "error",
                      message: "Docker infrastructure failed",
                    },
                  ],
                  cursors: { orchestration: "999" },
                }
              : emptyLogs
          );
        return implementation(input, init);
      });
      window.history.replaceState(null, "", "#/infrastructure");
      const user = userEvent.setup();
      renderDashboard();
      const pressed = await screen.findByRole("button", { name: label });
      const panel = screen.getByRole("region", {
        name: "Local infrastructure",
      });
      expect(within(panel).queryByRole("alert")).not.toBeInTheDocument();
      await user.click(pressed);
      if (intent === "reset")
        await user.click(
          screen.getByRole("button", { name: "Delete data and reset" })
        );
      currentStatus = {
        ...currentStatus,
        operations: [...currentStatus.operations, operation],
      };
      await act(async () => {
        finishPost(
          Response.json({ operationId: operation.id }, { status: 202 })
        );
      });
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      );
      expect(pressed).toHaveAttribute("aria-busy", "true");
      expect(within(panel).queryByRole("alert")).not.toBeInTheDocument();
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((item) =>
          item.id === operation.id ? { ...item, state: "running" } : item
        ),
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      expect(pressed).toHaveAttribute("aria-busy", "true");
      expect(within(panel).queryByRole("alert")).not.toBeInTheDocument();
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((item) =>
          item.id === operation.id
            ? {
                ...item,
                state: "failed",
                error: "Docker infrastructure failed",
              }
            : item
        ),
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      const failure = await within(panel).findByRole("alert");
      expect(failure).toHaveTextContent(`Infrastructure ${intent} failed`);
      expect(failure).toHaveTextContent("Docker infrastructure failed");
      const logs = within(failure).getByRole("link", { name: "Logs" });
      expect(logs).toHaveAttribute(
        "href",
        "#/logs?source=orchestration&level=error"
      );
      expect(pressed).toHaveAttribute("aria-busy", "false");
      expect(pressed).toBeEnabled();
      expect(screen.queryByText("Old failure")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Active operation" })
      ).not.toBeInTheDocument();
      await user.click(logs);
      await screen.findByRole("heading", { name: "Aggregate logs" });
      await waitFor(() =>
        expect(
          fetchMock.mock.calls.some(([input]) => {
            const url = new URL(String(input), window.location.origin);
            return (
              url.pathname.endsWith("/logs") &&
              url.searchParams.get("source") === "orchestration" &&
              url.searchParams.get("level") === "error"
            );
          })
        ).toBe(true)
      );
      expect(
        await screen.findByText("Docker infrastructure failed", { exact: true })
      ).toBeVisible();
      await user.click(screen.getByRole("link", { name: "Infrastructure" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Docker infrastructure failed"
      );
      post = new Promise<Response>((resolve) => {
        finishPost = resolve;
      });
      const retry = screen.getByRole("button", { name: label });
      await user.click(retry);
      if (intent === "reset")
        await user.click(
          screen.getByRole("button", { name: "Delete data and reset" })
        );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(retry).toHaveAttribute("aria-busy", "true");
      currentStatus = {
        ...currentStatus,
        operations: [
          ...currentStatus.operations,
          { ...operation, id: "retry-success", state: "passed" },
        ],
      };
      await act(async () => {
        finishPost(
          Response.json({ operationId: "retry-success" }, { status: 202 })
        );
      });
      await waitFor(() => expect(retry).toHaveAttribute("aria-busy", "false"));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /^Operations/ })
      ).not.toBeInTheDocument();
    }
  );

  it.each(
    infrastructureActions.flatMap((action) => [
      { ...action, state: "pending", terminal: "passed" },
      { ...action, state: "running", terminal: "failed" },
    ])
  )(
    "restores infrastructure $intent loading from an existing $state operation and clears it when $terminal",
    async ({ intent, label, state, terminal }) => {
      const fixture = statusFixture();
      currentStatus = statusFixture({
        operations: [
          {
            ...fixture.operations[0],
            kind: `infra.${intent}`,
            state: state === "pending" ? "pending" : "running",
            phases: [{ id: "docker", label: "Docker", state: "passed" }],
          },
        ],
      });
      window.history.replaceState(null, "", "#/infrastructure");
      const user = userEvent.setup();
      renderDashboard();
      const pressed = await screen.findByRole("button", { name: label });
      expect(pressed).toHaveAttribute("aria-busy", "true");
      expect(within(pressed).getByRole("status")).toBeInTheDocument();
      for (const action of infrastructureActions) {
        const button = screen.getByRole("button", { name: action.label });
        expect(button).toBeDisabled();
        if (action.intent !== intent) {
          expect(button).toHaveAttribute("aria-busy", "false");
          expect(within(button).queryByRole("status")).not.toBeInTheDocument();
        }
        await user.click(button);
      }
      expect(postedBodies("/actions")).toEqual([]);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Active operation" })
      ).not.toBeInTheDocument();
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((operation) => ({
          ...operation,
          state: terminal === "failed" ? "failed" : "passed",
        })),
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      await waitFor(() =>
        expect(pressed).toHaveAttribute("aria-busy", "false")
      );
      for (const action of infrastructureActions) {
        const button = screen.getByRole("button", { name: action.label });
        expect(button).toBeEnabled();
        expect(within(button).queryByRole("status")).not.toBeInTheDocument();
      }
      expect(postedBodies("/actions")).toEqual([]);
    }
  );

  it("does not derive infrastructure loading from preset operation phases", async () => {
    const fixture = statusFixture();
    currentStatus = statusFixture({
      operations: [
        {
          ...fixture.operations[0],
          kind: "preset.start",
          state: "running",
          phases: [
            { id: "infra.start", label: "Infrastructure", state: "running" },
          ],
        },
      ],
    });
    window.history.replaceState(null, "", "#/infrastructure");
    renderDashboard();
    await screen.findByRole("heading", { name: "Local infrastructure" });
    for (const action of infrastructureActions) {
      const button = screen.getByRole("button", { name: action.label });
      expect(button).toHaveAttribute("aria-busy", "false");
      expect(button).toBeEnabled();
      expect(within(button).queryByRole("status")).not.toBeInTheDocument();
    }
    expect(postedBodies("/actions")).toEqual([]);
  });

  it.each(
    infrastructureActions.flatMap((action) => [
      { ...action, terminal: "passed" },
      { ...action, terminal: "failed" },
    ])
  )(
    "loads only infrastructure $intent from POST through acceptance until $terminal",
    async ({ intent, label, terminal }) => {
      currentStatus = statusFixture({ operations: [] });
      let finishPost: (response: Response) => void = () => undefined;
      const post = new Promise<Response>((resolve) => {
        finishPost = resolve;
      });
      const implementation = fetchMock.getMockImplementation();
      if (!implementation) throw new Error("Missing dashboard fixture handler");
      fetchMock.mockImplementation((input, init) =>
        String(input).endsWith("/actions") ? post : implementation(input, init)
      );
      window.history.replaceState(null, "", "#/infrastructure");
      const user = userEvent.setup();
      renderDashboard();
      const pressed = await screen.findByRole("button", { name: label });
      const buttons = infrastructureActions.map((action) =>
        screen.getByRole("button", { name: action.label })
      );
      await user.click(pressed);
      if (intent === "reset") {
        expect(postedBodies("/actions")).toEqual([]);
        await user.click(
          within(screen.getByRole("alertdialog")).getByRole("button", {
            name: "Delete data and reset",
          })
        );
        const confirm = within(screen.getByRole("alertdialog")).getByRole(
          "button",
          {
            name: "Delete data and reset",
          }
        );
        expect(confirm).toHaveAttribute("aria-busy", "true");
        expect(within(confirm).getByRole("status")).toBeInTheDocument();
      }
      for (const button of buttons) {
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute(
          "aria-busy",
          button === pressed ? "true" : "false"
        );
        if (button === pressed)
          expect(
            within(button).getByRole("status", { hidden: true })
          ).toBeInTheDocument();
        else
          expect(within(button).queryByRole("status")).not.toBeInTheDocument();
      }
      expect(
        screen.queryByText("Infrastructure operation in progress…")
      ).not.toBeInTheDocument();
      expect(postedBodies("/actions")).toEqual([
        intent === "reset"
          ? { type: "infra.reset", confirm: true }
          : { type: `infra.${intent}` },
      ]);
      currentStatus = {
        ...currentStatus,
        operations: [
          {
            id: "infra-operation",
            kind: `infra.${intent}`,
            state: "running",
            startedAt: "2026-10-08T12:00:00Z",
            phases: [
              { id: "docker", label: "Docker containers", state: "passed" },
            ],
          },
        ],
      };
      await act(async () => {
        finishPost(
          Response.json({ operationId: "infra-operation" }, { status: 202 })
        );
      });
      await waitFor(() => expect(pressed).toHaveAttribute("aria-busy", "true"));
      if (intent === "reset")
        await waitFor(() =>
          expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
        );
      expect(pressed).toHaveAttribute("aria-busy", "true");
      expect(within(pressed).getByRole("status")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Logs for postgres" })
      ).toBeEnabled();
      expect(
        screen.queryByRole("region", { name: "Active operation" })
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Docker containers")).not.toBeInTheDocument();
      await user.click(buttons.find((button) => button !== pressed) ?? pressed);
      expect(postedBodies("/actions")).toHaveLength(1);
      currentStatus = {
        ...currentStatus,
        operations: currentStatus.operations.map((operation) => ({
          ...operation,
          state: terminal === "failed" ? "failed" : "passed",
        })),
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      await waitFor(() =>
        expect(pressed).toHaveAttribute("aria-busy", "false")
      );
      for (const button of buttons) {
        expect(button).toBeEnabled();
        expect(button).toHaveAttribute("aria-busy", "false");
        expect(within(button).queryByRole("status")).not.toBeInTheDocument();
      }
    }
  );

  it.each(infrastructureActions)(
    "clears infrastructure $intent loading after a rejected request",
    async ({ intent, label }) => {
      failActions = true;
      window.history.replaceState(null, "", "#/infrastructure");
      const user = userEvent.setup();
      renderDashboard();
      const pressed = await screen.findByRole("button", { name: label });
      await user.click(pressed);
      if (intent === "reset")
        await user.click(
          within(screen.getByRole("alertdialog")).getByRole("button", {
            name: "Delete data and reset",
          })
        );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Port 3600 is already in use"
      );
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      );
      for (const action of infrastructureActions) {
        const button = screen.getByRole("button", { name: action.label });
        expect(button).toBeEnabled();
        expect(button).toHaveAttribute("aria-busy", "false");
        expect(within(button).queryByRole("status")).not.toBeInTheDocument();
      }
      expect(postedBodies("/actions")).toHaveLength(1);
    }
  );

  it("requires a second explicit confirmation before infrastructure data deletion", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await user.click(screen.getByRole("link", { name: "Infrastructure" }));
    await user.click(
      await screen.findByRole("button", { name: "Reset infrastructure" })
    );
    expect(postedBodies("/actions")).toEqual([]);
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete local infrastructure data?",
    });
    expect(
      within(dialog).getByRole("button", { name: "Cancel" })
    ).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("button", { name: "Reset infrastructure" })
    ).toHaveFocus();
    expect(postedBodies("/actions")).toEqual([]);
    await user.click(
      screen.getByRole("button", { name: "Reset infrastructure" })
    );
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset infrastructure" })
    ).toHaveFocus();
    expect(postedBodies("/actions")).toEqual([]);
    await user.click(
      screen.getByRole("button", { name: "Reset infrastructure" })
    );
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete data and reset",
      })
    );
    await waitFor(() =>
      expect(postedBodies("/actions")).toContainEqual({
        type: "infra.reset",
        confirm: true,
      })
    );
    expect(
      screen.getByRole("heading", { name: "Development dashboard" })
    ).toBeVisible();
  });

  it("generates and copies a token for the selected tenant and user", async () => {
    const user = userEvent.setup();
    const copy = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    renderDashboard();
    await user.click(screen.getByRole("link", { name: "Access token" }));
    await user.selectOptions(
      await screen.findByLabelText("Tenant"),
      "producer"
    );
    await user.selectOptions(screen.getByLabelText("User"), "operator");
    await user.click(screen.getByRole("button", { name: "Generate token" }));
    await waitFor(() =>
      expect(postedBodies("/identity")).toEqual([
        { tenantKey: "producer", userId: "operator" },
      ])
    );
    await user.click(await screen.findByRole("button", { name: "Copy token" }));
    expect(copy).toHaveBeenCalledWith("local-session-token");
    await user.selectOptions(screen.getByLabelText("Tenant"), "consumer");
    expect(
      screen.queryByRole("button", { name: "Copy token" })
    ).not.toBeInTheDocument();
  });

  it("disables ready seed actions and restores them after stop and reset", async () => {
    const fixture = seedPackagesFixture();
    currentStatus = {
      ...fixture,
      seedReady: false,
    };
    window.history.replaceState(null, "", "#/access-token");
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole("button", { name: "Generate token" });
    const prepare = screen.getByRole("button", { name: "Start seed packages" });
    const seed = screen.getByRole("button", { name: "Seed local data" });
    expect(prepare).toBeEnabled();
    expect(seed).toBeEnabled();
    currentStatus = {
      ...currentStatus,
      seedReady: true,
      packages: fixture.packages.map((item) => ({ ...item, state: "running" })),
    };
    await user.click(
      screen.getByRole("button", { name: "Refresh runtime status" })
    );
    await waitFor(() =>
      expect(prepare).toHaveAccessibleName("Seed packages running")
    );
    expect(prepare).toHaveTextContent("Seed packages running");
    expect(prepare).toBeDisabled();
    expect(seed).toHaveTextContent("Local data seeded");
    expect(seed).toHaveAccessibleName("Local data seeded");
    expect(seed).toBeDisabled();
    await user.click(prepare);
    expect(postedBodies("/actions")).toEqual([]);
    await user.click(seed);
    expect(postedBodies("/actions")).toEqual([]);
    expect(seed).toHaveTextContent("Local data seeded");
    currentStatus = {
      ...currentStatus,
      seedReady: false,
      packages: currentStatus.packages.map((item, index) => ({
        ...item,
        state: index === 0 ? "stopped" : item.state,
      })),
    };
    await user.click(
      screen.getByRole("button", { name: "Refresh runtime status" })
    );
    await waitFor(() =>
      expect(prepare).toHaveAccessibleName("Start seed packages")
    );
    expect(prepare).toBeEnabled();
    expect(seed).toHaveAccessibleName("Seed local data");
    expect(seed).toHaveTextContent("Seed local data");
    expect(seed).toBeEnabled();
    await user.click(seed);
    await waitFor(() =>
      expect(postedBodies("/actions")).toEqual([{ type: "seed" }])
    );
    expect(
      screen.getByRole("link", { name: "View seed packages" })
    ).toHaveAttribute("href", "#/packages?group=seed");
    expect(
      screen.getByRole("link", { name: "Logs for seed packages" })
    ).toHaveAttribute("href", "#/logs?source=group%3Aseed");
    expect(postedBodies("/actions")).toEqual([{ type: "seed" }]);
  });

  it.each([false, true])(
    "discovers identities despite readiness %s and offers seed only in Access token without prerequisite lists",
    async (ready) => {
      currentStatus = statusFixture({
        seedReady: ready,
        seedPrerequisites: [tenantName, workerName],
      });
      const user = userEvent.setup();
      renderDashboard();
      await user.click(screen.getByRole("link", { name: "Access token" }));
      await screen.findByRole("heading", { name: "Local access token" });
      expect(
        await screen.findByRole("button", { name: "Generate token" })
      ).toBeEnabled();
      const seed = screen.getByRole("button", {
        name: ready ? "Local data seeded" : "Seed local data",
      });
      if (ready) expect(seed).toBeDisabled();
      else expect(seed).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Start seed packages" })
      ).toBeEnabled();
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).endsWith("/identities")
        )
      ).toHaveLength(1);
      expect(screen.queryByText(tenantName)).not.toBeInTheDocument();
      expect(screen.queryByText(workerName)).not.toBeInTheDocument();
      for (const section of ["Packages", "Presets", "Infrastructure"]) {
        await user.click(screen.getByRole("link", { name: section }));
        await waitFor(() =>
          expect(screen.getByRole("link", { name: section })).toHaveAttribute(
            "aria-current",
            "page"
          )
        );
        expect(
          screen.queryByRole("button", {
            name: ready ? "Local data seeded" : "Seed local data",
          })
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Start seed packages" })
        ).not.toBeInTheDocument();
      }
      expect(postedBodies("/actions")).toEqual([]);
    }
  );

  it("starts seed packages when cached prerequisites are ready but infrastructure and identities are unavailable", async () => {
    const fixture = statusFixture();
    currentStatus = statusFixture({
      seedReady: true,
      seedPrerequisites: [],
      packages: fixture.packages.map((item) => ({ ...item, state: "running" })),
      infrastructure: [{ name: "postgres", state: "stopped" }],
      operations: [],
    });
    const implementation = fetchMock.getMockImplementation();
    if (!implementation) throw new Error("Missing dashboard fixture handler");
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith("/identities"))
        return Response.json({ ready: false, tenants: [] });
      if (!String(input).endsWith("/actions"))
        return implementation(input, init);
      currentStatus = {
        ...currentStatus,
        operations: [
          {
            id: "cold-prepare",
            kind: "seed.prepare",
            state: "passed",
            startedAt: "2026-10-08T15:00:00Z",
            phases: [],
          },
        ],
      };
      return Response.json({ operationId: "cold-prepare" }, { status: 202 });
    });
    window.history.replaceState(null, "", "#/access-token");
    const user = userEvent.setup();
    renderDashboard();
    const empty = await screen.findByRole("region", {
      name: "Local identities unavailable",
    });
    expect(
      within(empty)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(currentStatus.seedPackages);
    const prepare = screen.getByRole("button", { name: "Start seed packages" });
    expect(prepare).toBeEnabled();
    await user.click(prepare);
    await waitFor(() =>
      expect(postedBodies("/actions")).toEqual([{ type: "seed.prepare" }])
    );
    await waitFor(() => expect(prepare).toHaveAttribute("aria-busy", "false"));
    expect(
      screen.getByRole("region", { name: "Local identities unavailable" })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Generate token" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Session token" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reload identities" })
    ).toBeEnabled();
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith("/identities")
      )
    ).toHaveLength(1);
    expect(postedBodies("/identity")).toEqual([]);
  });

  it.each(["passed", "failed"])(
    "keeps only startup loading from its POST through an accepted operation until %s and preserves the selected token",
    async (terminal) => {
      currentStatus = statusFixture({ seedReady: false, operations: [] });
      let finishPost: (response: Response) => void = () => undefined;
      const post = new Promise<Response>((resolve) => {
        finishPost = resolve;
      });
      const implementation = fetchMock.getMockImplementation();
      if (!implementation) throw new Error("Missing dashboard fixture handler");
      fetchMock.mockImplementation((input, init) =>
        String(input).endsWith("/actions") ? post : implementation(input, init)
      );
      window.history.replaceState(null, "", "#/access-token");
      const user = userEvent.setup();
      renderDashboard();
      await user.selectOptions(
        await screen.findByLabelText("Tenant"),
        "producer"
      );
      await user.click(screen.getByRole("button", { name: "Generate token" }));
      expect(
        await screen.findByRole("textbox", { name: "Session token" })
      ).toHaveValue("local-session-token");
      const prepare = screen.getByRole("button", {
        name: "Start seed packages",
      });
      const seed = screen.getByRole("button", { name: "Seed local data" });
      await user.click(prepare);
      expect(prepare).toHaveAttribute("aria-busy", "true");
      expect(within(prepare).getByRole("status")).toHaveTextContent(
        "Starting seed packages"
      );
      expect(prepare).toBeDisabled();
      expect(seed).toHaveAttribute("aria-busy", "false");
      expect(seed).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Generate token" })
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Reload identities" })
      ).toBeDisabled();
      expect(screen.getByLabelText("Tenant")).toBeDisabled();
      expect(screen.getByLabelText("User")).toBeDisabled();
      await user.click(prepare);
      expect(postedBodies("/actions")).toEqual([{ type: "seed.prepare" }]);
      const operation = {
        id: "prepare-operation",
        kind: "seed.prepare",
        state: "pending",
        startedAt: "2026-10-08T15:00:00Z",
        phases: [
          {
            id: "build",
            label: "Build seed packages",
            state: "pending",
          },
        ],
      } satisfies (typeof currentStatus.operations)[number];
      currentStatus = { ...currentStatus, operations: [operation] };
      await act(async () => {
        finishPost(
          Response.json({ operationId: operation.id }, { status: 202 })
        );
      });
      await waitFor(() => expect(prepare).toHaveAttribute("aria-busy", "true"));
      currentStatus = {
        ...currentStatus,
        operations: [
          {
            ...operation,
            state: "running",
            phases: [{ ...operation.phases[0], state: "passed" }],
          },
        ],
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      expect(prepare).toHaveAttribute("aria-busy", "true");
      expect(seed).toHaveAttribute("aria-busy", "false");
      expect(
        screen.queryByRole("region", { name: "Active operation" })
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Build seed packages")).not.toBeInTheDocument();
      currentStatus = {
        ...currentStatus,
        operations: [
          {
            ...operation,
            state: terminal === "passed" ? "passed" : "failed",
            error: "Private startup detail",
          },
        ],
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      await waitFor(() =>
        expect(prepare).toHaveAttribute("aria-busy", "false")
      );
      expect(prepare).toBeEnabled();
      expect(seed).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Generate token" })
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Reload identities" })
      ).toBeEnabled();
      if (terminal === "failed") {
        const failure = await screen.findByRole("alert");
        expect(failure).toHaveTextContent("Seed packages startup failed");
        expect(failure).not.toHaveTextContent("Private startup detail");
        expect(
          within(failure).getByRole("link", { name: "Logs" })
        ).toHaveAttribute("href", "#/logs?source=orchestration&level=error");
      } else expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      for (let index = 0; index < 2; index++)
        await user.click(
          screen.getByRole("button", { name: "Refresh runtime status" })
        );
      expect(
        screen.getByRole("textbox", { name: "Session token" })
      ).toHaveValue("local-session-token");
      expect(screen.getByLabelText("Tenant")).toHaveValue("producer");
      expect(screen.getByLabelText("User")).toHaveValue("operator");
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).endsWith("/identities")
        )
      ).toHaveLength(1);
      expect(postedBodies("/identity")).toEqual([
        { tenantKey: "producer", userId: "operator" },
      ]);
      expect(postedBodies("/actions")).toEqual([{ type: "seed.prepare" }]);
    }
  );

  it.each(["infra.start", "preset.start", "package.start"])(
    "does not show startup loading for an unrelated %s operation",
    async (kind) => {
      currentStatus = statusFixture({
        operations: [
          {
            id: "unrelated",
            kind,
            state: "running",
            startedAt: "2026-10-08T15:00:00Z",
            phases: [
              {
                id: "processes",
                label: "Start seed packages",
                state: "running",
              },
            ],
          },
        ],
      });
      window.history.replaceState(null, "", "#/access-token");
      renderDashboard();
      const prepare = await screen.findByRole("button", {
        name: "Start seed packages",
      });
      expect(prepare).toBeEnabled();
      expect(prepare).toHaveAttribute("aria-busy", "false");
      expect(postedBodies("/actions")).toEqual([]);
    }
  );

  it.each(["passed", "failed"])(
    "keeps seed loading from a pending POST through accepted operations until %s without polling identities repeatedly",
    async (terminal) => {
      currentStatus = statusFixture({ seedReady: false, operations: [] });
      let ready = false;
      let finishPost: (response: Response) => void = () => undefined;
      const post = new Promise<Response>((resolve) => {
        finishPost = resolve;
      });
      const implementation = fetchMock.getMockImplementation();
      if (!implementation) throw new Error("Missing dashboard fixture handler");
      fetchMock.mockImplementation((input, init) => {
        if (String(input).endsWith("/identities"))
          return Promise.resolve(
            Response.json(
              ready ? identitiesFixture : { ready: false, tenants: [] }
            )
          );
        return String(input).endsWith("/actions")
          ? post
          : implementation(input, init);
      });
      window.history.replaceState(null, "", "#/access-token");
      const user = userEvent.setup();
      renderDashboard();
      await screen.findByRole("region", {
        name: "Local identities unavailable",
      });
      const seed = screen.getByRole("button", { name: "Seed local data" });
      await user.click(seed);
      expect(seed).toHaveAttribute("aria-busy", "true");
      expect(seed).toBeDisabled();
      expect(within(seed).getByRole("status")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Reload identities" })
      ).toBeDisabled();
      await user.click(seed);
      expect(postedBodies("/actions")).toEqual([{ type: "seed" }]);
      const operation = {
        id: "seed-operation",
        kind: "seed",
        state: "pending",
        startedAt: "2026-10-08T15:00:00Z",
        phases: [{ id: "seed", label: "Seed local dataset", state: "pending" }],
      } satisfies (typeof currentStatus.operations)[number];
      currentStatus = { ...currentStatus, operations: [operation] };
      await act(async () => {
        finishPost(
          Response.json({ operationId: operation.id }, { status: 202 })
        );
      });
      await waitFor(() => expect(seed).toHaveAttribute("aria-busy", "true"));
      currentStatus = {
        ...currentStatus,
        operations: [
          {
            ...operation,
            state: "running",
            phases: [{ ...operation.phases[0], state: "passed" }],
          },
        ],
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      expect(seed).toHaveAttribute("aria-busy", "true");
      expect(
        screen.queryByRole("region", { name: "Active operation" })
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Seed local dataset")).not.toBeInTheDocument();
      ready = terminal === "passed";
      currentStatus = {
        ...currentStatus,
        operations: [
          {
            ...operation,
            state: terminal === "passed" ? "passed" : "failed",
            error: "Private backend failure detail",
            phases: [
              {
                ...operation.phases[0],
                state: terminal === "passed" ? "passed" : "failed",
              },
            ],
          },
        ],
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      await waitFor(() => expect(seed).toHaveAttribute("aria-busy", "false"));
      expect(seed).toBeEnabled();
      if (terminal === "passed") {
        await user.click(
          await screen.findByRole("button", { name: "Generate token" })
        );
        expect(
          await screen.findByRole("textbox", { name: "Session token" })
        ).toHaveValue("local-session-token");
      } else {
        const failure = await screen.findByRole("alert");
        expect(failure).toHaveTextContent("Seed failed");
        expect(failure).not.toHaveTextContent("Private backend failure detail");
        expect(
          within(failure).getByRole("link", { name: "Logs" })
        ).toHaveAttribute("href", "#/logs?source=orchestration&level=error");
      }
      const identityRequests = fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith("/identities")
      ).length;
      expect(identityRequests).toBe(terminal === "passed" ? 2 : 1);
      for (let index = 0; index < 2; index++)
        await user.click(
          screen.getByRole("button", { name: "Refresh runtime status" })
        );
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).endsWith("/identities")
        )
      ).toHaveLength(identityRequests);
      if (terminal === "passed")
        expect(
          screen.getByRole("textbox", { name: "Session token" })
        ).toHaveValue("local-session-token");
      expect(
        screen.queryByRole("link", { name: /^Operations/ })
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Seed local dataset")).not.toBeInTheDocument();
    }
  );

  it.each([
    { kind: "seed", label: "Seed local data", failure: "Seed failed" },
    {
      kind: "seed.prepare",
      label: "Start seed packages",
      failure: "Seed packages startup failed",
    },
  ])(
    "shows compact HTTP $kind failure and immediately clears it on a successful retry",
    async ({ kind, label, failure }) => {
      window.history.replaceState(null, "", "#/access-token");
      currentStatus = statusFixture({ seedReady: false, operations: [] });
      failActions = true;
      const user = userEvent.setup();
      renderDashboard();
      const seed = await screen.findByRole("button", { name: label });
      await user.click(
        await screen.findByRole("button", { name: "Generate token" })
      );
      expect(
        await screen.findByRole("textbox", { name: "Session token" })
      ).toHaveValue("local-session-token");
      await user.click(seed);
      expect(await screen.findByRole("alert")).toHaveTextContent(failure);
      expect(
        within(await screen.findByRole("alert")).getByRole("link", {
          name: "Logs",
        })
      ).toHaveAttribute("href", "#/logs?source=orchestration&level=error");
      expect(
        screen.queryByText("Port 3600 is already in use")
      ).not.toBeInTheDocument();
      expect(seed).toHaveAttribute("aria-busy", "false");
      expect(
        screen.getByRole("textbox", { name: "Session token" })
      ).toHaveValue("local-session-token");
      failActions = false;
      const implementation = fetchMock.getMockImplementation();
      if (!implementation) throw new Error("Missing dashboard fixture handler");
      fetchMock.mockImplementation(async (input, init) => {
        if (!String(input).endsWith("/actions"))
          return implementation(input, init);
        currentStatus = {
          ...currentStatus,
          operations: [
            {
              id: "retry-seed",
              kind,
              state: "passed",
              startedAt: "2026-10-08T15:00:00Z",
              phases: [],
            },
          ],
        };
        return Response.json({ operationId: "retry-seed" }, { status: 202 });
      });
      await user.click(seed);
      await waitFor(() =>
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
      );
      expect(seed).toBeEnabled();
      await waitFor(() =>
        expect(
          fetchMock.mock.calls.filter(([input]) =>
            String(input).endsWith("/identities")
          )
        ).toHaveLength(kind === "seed" ? 2 : 1)
      );
      if (kind === "seed")
        expect(
          screen.queryByRole("textbox", { name: "Session token" })
        ).not.toBeInTheDocument();
      else
        expect(
          screen.getByRole("textbox", { name: "Session token" })
        ).toHaveValue("local-session-token");
      expect(postedBodies("/actions")).toEqual([
        { type: kind },
        { type: kind },
      ]);
    }
  );

  it.each([
    { kind: "seed", label: "Seed local data", failure: "Seed failed" },
    {
      kind: "seed.prepare",
      label: "Start seed packages",
      failure: "Seed packages startup failed",
    },
  ])(
    "shows an immediately failed accepted $kind without surfacing historical failures on entry",
    async ({ kind, label, failure }) => {
      const fixture = statusFixture();
      currentStatus = statusFixture({
        seedReady: false,
        operations: [
          {
            ...fixture.operations[0],
            kind,
            state: "failed",
            error: "Historical failure",
          },
        ],
      });
      const implementation = fetchMock.getMockImplementation();
      if (!implementation) throw new Error("Missing dashboard fixture handler");
      fetchMock.mockImplementation(async (input, init) => {
        if (!String(input).endsWith("/actions"))
          return implementation(input, init);
        currentStatus = {
          ...currentStatus,
          operations: [
            ...currentStatus.operations,
            {
              id: "immediate-seed",
              kind,
              state: "failed",
              error: "Secret failure",
              startedAt: "2026-10-08T15:00:00Z",
              phases: [],
            },
          ],
        };
        return Response.json(
          { operationId: "immediate-seed" },
          { status: 202 }
        );
      });
      window.history.replaceState(null, "", "#/access-token");
      const user = userEvent.setup();
      renderDashboard();
      const seed = await screen.findByRole("button", { name: label });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      await user.click(seed);
      expect(await screen.findByRole("alert")).toHaveTextContent(failure);
      expect(screen.queryByText("Secret failure")).not.toBeInTheDocument();
      expect(seed).toHaveAttribute("aria-busy", "false");
      expect(seed).toBeEnabled();
    }
  );

  it.each([
    { kind: "seed", state: "pending", terminal: "passed" },
    { kind: "seed", state: "running", terminal: "passed" },
    { kind: "seed", state: "running", terminal: "failed" },
    { kind: "seed.prepare", state: "pending", terminal: "passed" },
    { kind: "seed.prepare", state: "running", terminal: "passed" },
    { kind: "seed.prepare", state: "running", terminal: "failed" },
  ])(
    "restores an existing $state $kind after reload and handles $terminal with an unchanged readiness flag",
    async ({ kind, state, terminal }) => {
      const operation = {
        id: "existing-seed",
        kind,
        state: state === "pending" ? "pending" : "running",
        startedAt: "2026-10-08T15:00:00Z",
        phases: [],
      } satisfies (typeof currentStatus.operations)[number];
      currentStatus = statusFixture({
        seedReady: false,
        operations: [operation],
      });
      window.history.replaceState(null, "", "#/access-token");
      const user = userEvent.setup();
      renderDashboard();
      const seed = await screen.findByRole("button", {
        name: kind === "seed" ? "Seed local data" : "Start seed packages",
      });
      expect(seed).toHaveAttribute("aria-busy", "true");
      expect(
        await screen.findByRole("button", { name: "Generate token" })
      ).toBeDisabled();
      currentStatus = {
        ...currentStatus,
        operations: [
          { ...operation, state: terminal === "passed" ? "passed" : "failed" },
        ],
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      await waitFor(() => expect(seed).toHaveAttribute("aria-busy", "false"));
      expect(
        await screen.findByRole("button", { name: "Generate token" })
      ).toBeEnabled();
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).endsWith("/identities")
        )
      ).toHaveLength(kind === "seed" && terminal === "passed" ? 2 : 1);
      if (terminal === "failed")
        expect(await screen.findByRole("alert")).toHaveTextContent(
          kind === "seed" ? "Seed failed" : "Seed packages startup failed"
        );
      expect(postedBodies("/actions")).toEqual([]);
    }
  );

  it.each(["passed", "failed"])(
    "ignores preset seed phases ending in %s without loading or reloading identities",
    async (terminal) => {
      const operation = {
        id: "preset-seed",
        kind: "preset.start",
        state: "running",
        startedAt: "2026-10-08T15:00:00Z",
        phases: [
          { id: "build", label: "Build", state: "running" },
          { id: "seed", label: "Seed local dataset", state: "pending" },
        ],
      } satisfies (typeof currentStatus.operations)[number];
      currentStatus = statusFixture({
        seedReady: false,
        operations: [operation],
      });
      window.history.replaceState(null, "", "#/access-token");
      const user = userEvent.setup();
      renderDashboard();
      const seed = await screen.findByRole("button", {
        name: "Seed local data",
      });
      expect(seed).toHaveAttribute("aria-busy", "false");
      expect(
        screen.queryByRole("region", { name: "Active operation" })
      ).not.toBeInTheDocument();
      currentStatus = {
        ...currentStatus,
        operations: [
          {
            ...operation,
            phases: [
              { ...operation.phases[0], state: "passed" },
              { ...operation.phases[1], state: "running" },
            ],
          },
        ],
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      expect(seed).toHaveAttribute("aria-busy", "false");
      expect(seed).toBeEnabled();
      currentStatus = {
        ...currentStatus,
        operations: [
          {
            ...operation,
            state: terminal === "failed" ? "failed" : "running",
            phases: [
              { ...operation.phases[0], state: "passed" },
              {
                ...operation.phases[1],
                state: terminal === "passed" ? "passed" : "failed",
              },
            ],
          },
        ],
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      await waitFor(() => expect(seed).toHaveAttribute("aria-busy", "false"));
      expect(
        await screen.findByRole("button", { name: "Generate token" })
      ).toBeEnabled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      currentStatus = {
        ...currentStatus,
        operations: [
          {
            ...currentStatus.operations[0],
            state: terminal === "passed" ? "passed" : "failed",
          },
        ],
      };
      await user.click(
        screen.getByRole("button", { name: "Refresh runtime status" })
      );
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).endsWith("/identities")
        )
      ).toHaveLength(1);
      expect(postedBodies("/actions")).toEqual([]);
    }
  );

  it("keeps process progress in package buttons without operation views", async () => {
    const fixture = statusFixture();
    currentStatus = statusFixture({
      packages: fixture.packages.map((item, index) => ({
        ...item,
        state: index === 0 ? "building" : item.state,
      })),
      operations: fixture.operations.map((operation) => ({
        ...operation,
        state: "running",
      })),
    });
    renderDashboard();
    expect(
      await screen.findByRole("button", { name: `Start ${bffName}` })
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.queryByRole("region", { name: "Active operation" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Build packages")).not.toBeInTheDocument();
    expect(screen.queryByText("Frontend")).not.toBeInTheDocument();
    expect(screen.queryByText("Smoke checks")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start fullstack" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Operations/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Build packages")).not.toBeInTheDocument();
  });

  it("sends a single selected start batch, loads its rows and releases completed rows independently", async () => {
    operationPending = true;
    const user = userEvent.setup();
    renderDashboard();
    await user.click(
      await screen.findByRole("checkbox", {
        name: "Select all visible packages",
      })
    );
    await user.click(
      screen.getByRole("button", { name: "Start selected packages" })
    );
    await waitFor(() =>
      expect(postedBodies("/actions")).toEqual([
        { type: "packages.start", names: [bffName, tenantName] },
      ])
    );
    expect(
      screen.getByRole("button", { name: `Start ${bffName}` })
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("button", { name: `Start ${tenantName}` })
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("button", { name: `Stop ${workerName}` })
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: `Logs for ${bffName}` })
    ).toBeEnabled();
    expect(
      screen.queryByRole("region", { name: "Active operation" })
    ).not.toBeInTheDocument();
    currentStatus = {
      ...currentStatus,
      operations: currentStatus.operations.map((operation) =>
        operation.id === "new-operation"
          ? {
              ...operation,
              phases: [
                { id: `start:${bffName}`, label: bffName, state: "passed" },
                {
                  id: `start:${tenantName}`,
                  label: tenantName,
                  state: "running",
                },
              ],
            }
          : operation
      ),
    };
    await user.click(
      screen.getByRole("button", { name: "Refresh runtime status" })
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: `Start ${bffName}` })
      ).toHaveAttribute("aria-busy", "false")
    );
    expect(
      screen.getByRole("button", { name: `Start ${tenantName}` })
    ).toHaveAttribute("aria-busy", "true");
    currentStatus = {
      ...currentStatus,
      operations: currentStatus.operations.map((operation) => ({
        ...operation,
        state: "passed",
      })),
    };
    await user.click(
      screen.getByRole("button", { name: "Refresh runtime status" })
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: `Start ${tenantName}` })
      ).toHaveAttribute("aria-busy", "false")
    );
  });

  it("shows the requested bulk watch mode through POST, queued restarts and partial failure", async () => {
    currentStatus = statusFixture({
      operations: [],
      packages: statusFixture().packages.map((item) => ({
        ...item,
        watch: false,
        state: "running",
      })),
    });
    const names = currentStatus.packages.map((item) => item.name);
    let accept: (response: Response) => void = () => undefined;
    const acceptance = new Promise<Response>((resolve) => {
      accept = resolve;
    });
    const implementation = fetchMock.getMockImplementation();
    if (!implementation) throw new Error("Missing dashboard fixture handler");
    fetchMock.mockImplementation(async (input, init) =>
      String(input).endsWith("/actions")
        ? acceptance
        : implementation(input, init)
    );
    const user = userEvent.setup();
    renderDashboard();
    await user.click(
      await screen.findByRole("checkbox", {
        name: "Select all visible packages",
      })
    );
    await user.click(
      screen.getByRole("button", { name: "Enable watch for selected packages" })
    );
    for (const name of names) {
      const row = within(screen.getByRole("row", { name: new RegExp(name) }));
      expect(
        row.getByRole("checkbox", { name: `Watch ${name}` })
      ).toBeChecked();
      expect(
        row.getByRole("checkbox", { name: `Watch ${name}` })
      ).toBeDisabled();
      expect(row.getByRole("status")).toHaveTextContent("Queued");
    }
    currentStatus = {
      ...currentStatus,
      operations: [
        {
          id: "watch-batch",
          kind: "packages.watch",
          watch: true,
          state: "running",
          startedAt: "2026-10-08T15:00:00Z",
          phases: names.map((name, index) => ({
            id: `watch:${name}`,
            label: "Watch",
            state: index === 0 ? "running" : "pending",
          })),
        },
      ],
    };
    await act(async () => {
      accept(Response.json({ operationId: "watch-batch" }, { status: 202 }));
    });
    await waitFor(() =>
      expect(
        within(
          screen.getByRole("row", { name: new RegExp(names[0]) })
        ).getByRole("status")
      ).toHaveTextContent("Restarting")
    );
    currentStatus = {
      ...currentStatus,
      packages: currentStatus.packages.map((item, index) => ({
        ...item,
        watch: index === 0,
      })),
      operations: currentStatus.operations.map((operation) => ({
        ...operation,
        phases: operation.phases.map((phase, index) => ({
          ...phase,
          state: index === 0 ? "passed" : index === 1 ? "running" : "pending",
        })),
      })),
    };
    await user.click(
      screen.getByRole("button", { name: "Refresh runtime status" })
    );
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: `Watch ${names[0]}` })
      ).toBeEnabled()
    );
    expect(
      within(
        screen.getByRole("row", { name: new RegExp(names[0]) })
      ).queryByRole("status")
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: new RegExp(names[1]) })).getByRole(
        "status"
      )
    ).toHaveTextContent("Restarting");
    currentStatus = {
      ...currentStatus,
      operations: currentStatus.operations.map((operation) => ({
        ...operation,
        state: "failed",
      })),
    };
    await user.click(
      screen.getByRole("button", { name: "Refresh runtime status" })
    );
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: `Watch ${names[1]}` })
      ).toBeEnabled()
    );
    for (const [index, name] of names.entries()) {
      expect(
        screen.getByRole("checkbox", { name: `Watch ${name}` })
      ).toHaveAttribute("aria-checked", String(index === 0));
      expect(
        within(screen.getByRole("row", { name: new RegExp(name) })).queryByRole(
          "status"
        )
      ).not.toBeInTheDocument();
    }
  });

  it("restores every selected row after a rejected watch batch and shows the error beside the table", async () => {
    failActions = true;
    const user = userEvent.setup();
    renderDashboard();
    await user.click(
      await screen.findByRole("checkbox", {
        name: "Select all visible packages",
      })
    );
    await user.click(
      screen.getByRole("button", { name: "Enable watch for selected packages" })
    );
    await waitFor(() =>
      expect(postedBodies("/actions")).toEqual([
        { type: "packages.watch", names: [bffName, tenantName], watch: true },
      ])
    );
    const catalogue = screen.getByRole("region", { name: "Package catalogue" });
    expect(await within(catalogue).findByRole("alert")).toHaveTextContent(
      "Port 3600 is already in use"
    );
    expect(
      screen.getByRole("button", { name: `Start ${bffName}` })
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: `Watch ${tenantName}` })
    ).toBeEnabled();
    await user.click(
      within(catalogue).getByRole("button", { name: "Dismiss error" })
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps server errors visible and restores failed action controls", async () => {
    failActions = true;
    const user = userEvent.setup();
    renderDashboard();
    await user.click(
      await screen.findByRole("button", { name: `Start ${bffName}` })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Port 3600 is already in use"
    );
    expect(
      screen.getByRole("button", { name: `Start ${bffName}` })
    ).toBeEnabled();
  });
});
