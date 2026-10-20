import type { DashboardStatus } from "pagopa-interop-dev-dashboard-contracts";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/App";
import { createDashboardRouter } from "../../src/router/DashboardRoutes";
import { emptyLogs, statusFixture } from "../fixtures";

const bffName = "pagopa-interop-backend-for-frontend";
let currentStatus: DashboardStatus;
let failFrontendLogs = false;
let failStatus = false;
let holdFrontendLogs = false;
const fetchMock = vi.fn<typeof fetch>();
const routers = new Set<ReturnType<typeof createDashboardRouter>>();

function fullstackStatusFixture(): DashboardStatus {
  const status = statusFixture();
  return {
    ...status,
    packages: status.packages.map((item) => ({ ...item, state: "running" })),
    presets: [
      {
        id: "frontend-full",
        name: "Frontend backend",
        source: "shared",
        packages: [{ name: bffName, watch: false }],
      },
    ],
    frontend: {
      available: true,
      running: true,
      state: "passed",
      mode: "local",
      phases: [
        { id: "install", label: "Install dependencies", state: "passed" },
        {
          id: "backend",
          label: "Start backend services",
          state: "passed",
          operationId: "backend-startup",
        },
        { id: "vite", label: "Start frontend", state: "passed" },
        { id: "smoke", label: "Check frontend", state: "passed" },
      ],
    },
    operations: [
      {
        id: "backend-startup",
        kind: "preset.start",
        state: "passed",
        startedAt: "2026-10-15T10:00:00Z",
        phases: [
          { id: "build", label: "Build backend packages", state: "passed" },
        ],
      },
      {
        id: "unrelated-operation",
        kind: "seed.prepare",
        state: "passed",
        startedAt: "2026-10-14T10:00:00Z",
        phases: [
          { id: "old-seed", label: "Unrelated old seed", state: "passed" },
        ],
      },
    ],
  };
}

function renderDashboard(path = "/status") {
  window.history.replaceState(null, "", `#${path}`);
  const router = createDashboardRouter();
  routers.add(router);
  return render(<App router={router} />);
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  currentStatus = fullstackStatusFixture();
  failFrontendLogs = false;
  failStatus = false;
  holdFrontendLogs = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/frontend/logs") && holdFrontendLogs)
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Request aborted", "AbortError")),
          { once: true }
        );
      });
    if (url.pathname.endsWith("/frontend/logs"))
      return failFrontendLogs
        ? Response.json(
            { error: "Frontend log file unavailable" },
            { status: 503 }
          )
        : Response.json({
            content: `${url.searchParams.get("source")} output`,
          });
    if (url.pathname.endsWith("/status"))
      return failStatus
        ? Response.json(
            { error: "Runtime observer unavailable" },
            { status: 503 }
          )
        : Response.json(currentStatus);
    if (url.pathname.endsWith("/logs")) return Response.json(emptyLogs);
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  for (const router of routers) router.dispose();
  routers.clear();
});

function frontendLogRequests() {
  return fetchMock.mock.calls.filter(([input]) =>
    String(input).includes("/frontend/logs?")
  );
}

describe("optional fullstack status", () => {
  it("hides and guards the status page in a standalone backend dashboard", async () => {
    currentStatus = statusFixture();
    renderDashboard();
    expect(
      await screen.findByRole("heading", { name: "Package catalogue" })
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Fullstack status" })
    ).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#/packages");
    expect(frontendLogRequests()).toHaveLength(0);
  });

  it.each(["/", "/unknown"])(
    "defaults %s to fullstack status when enabled",
    async (path) => {
      renderDashboard(path);
      expect(
        await screen.findByRole("heading", { name: "Fullstack status" })
      ).toBeVisible();
      expect(
        screen.getByRole("link", { name: "Fullstack status" })
      ).toHaveAttribute("aria-current", "page");
      expect(window.location.hash).toBe("#/status");
      expect(frontendLogRequests()).toHaveLength(0);
    }
  );

  it("shows failed startup and only the backend subphases linked to this startup", async () => {
    if (!currentStatus.frontend)
      throw new Error("Fullstack fixture is required");
    currentStatus.frontend.state = "failed";
    currentStatus.frontend.error = "Backend startup failed";
    currentStatus.frontend.phases[1].state = "failed";
    currentStatus.operations[0].state = "failed";
    currentStatus.operations[0].phases[0].state = "failed";
    currentStatus.operations[0].phases[0].error =
      "Build failed in tenant-process";
    renderDashboard();
    const startup = within(
      await screen.findByRole("region", { name: "Current startup" })
    );
    expect(startup.getByText("Build backend packages")).toBeVisible();
    expect(startup.getByText("Build failed in tenant-process")).toBeVisible();
    expect(startup.queryByText("Unrelated old seed")).not.toBeInTheDocument();
    expect(screen.getByText("Backend startup failed")).toBeVisible();
    expect(
      startup.getByRole("link", { name: "Backend startup logs" })
    ).toHaveAttribute("href", "#/logs?source=preset%3Afrontend-full");
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.method === "GET")
    ).toBe(true);
  });

  it("focuses the status page on startup and logs without repeated overview sections", async () => {
    renderDashboard();
    const statusPage = within(
      await screen.findByRole("region", { name: "Fullstack status" })
    );
    expect(
      statusPage.getByRole("region", { name: "Current startup" })
    ).toBeVisible();
    expect(
      statusPage.getByRole("button", { name: "Show frontend logs" })
    ).toBeVisible();
    for (const name of [
      "Current runtime",
      "Current infrastructure",
      "Current backend services",
    ])
      expect(
        statusPage.queryByRole("region", { name })
      ).not.toBeInTheDocument();
    expect(statusPage.queryByRole("table")).not.toBeInTheDocument();
    expect(
      statusPage.queryByRole("status", { name: "Environment readiness" })
    ).not.toBeInTheDocument();
  });

  it.each(["passed", "running"])(
    "opens the running frontend in a new tab during %s startup",
    async (state) => {
      if (!currentStatus.frontend)
        throw new Error("Fullstack fixture is required");
      currentStatus.frontend.state = state === "running" ? "running" : "passed";
      currentStatus.frontend.phases[3].state =
        state === "running" ? "pending" : "passed";
      renderDashboard();
      const link = await screen.findByRole("link", { name: "Open frontend" });
      expect(link).toHaveAttribute("href", "http://localhost:3000/ui/it/");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  );

  it("disables the frontend entry until its process is running", async () => {
    if (!currentStatus.frontend)
      throw new Error("Fullstack fixture is required");
    currentStatus.frontend.running = false;
    renderDashboard();
    const button = await screen.findByRole("button", { name: "Open frontend" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "Available when the frontend is running."
    );
    expect(
      screen.queryByRole("link", { name: "Open frontend" })
    ).not.toBeInTheDocument();
  });

  it("keeps startup details and errors visible when the frontend runtime is unavailable", async () => {
    if (!currentStatus.frontend)
      throw new Error("Fullstack fixture is required");
    currentStatus.frontend.available = false;
    currentStatus.frontend.running = false;
    currentStatus.frontend.state = "stopped";
    currentStatus.frontend.error = "Frontend runtime is unavailable";
    renderDashboard();
    expect(
      await screen.findByText("Frontend runtime is unavailable")
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Current startup" })
    ).toHaveTextContent("Build backend packages");
  });

  it("shows unavailable logs without polling or presenting cached output as live", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole("heading", { name: "Fullstack status" });
    await user.click(
      screen.getByRole("button", { name: "Show frontend logs" })
    );
    expect(await screen.findByText("startup output")).toBeVisible();
    if (!currentStatus.frontend)
      throw new Error("Fullstack fixture is required");
    currentStatus.frontend.available = false;
    await user.click(
      screen.getByRole("button", { name: "Refresh runtime status" })
    );
    expect(
      await screen.findByText(
        "Frontend logs are unavailable while the frontend runtime cannot be reached."
      )
    ).toBeVisible();
    expect(screen.queryByText("startup output")).not.toBeInTheDocument();
    expect(frontendLogRequests()).toHaveLength(1);
  });

  it("keeps startup details visible while logs load and cancels the request when leaving status", async () => {
    holdFrontendLogs = true;
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole("heading", { name: "Fullstack status" });
    await user.click(
      screen.getByRole("button", { name: "Show frontend logs" })
    );
    await waitFor(() => expect(frontendLogRequests()).toHaveLength(1));
    expect(
      screen.getByRole("button", { name: "Refresh frontend logs" })
    ).toBeDisabled();
    expect(
      screen.getByRole("region", { name: "Current startup" })
    ).toHaveTextContent("Build backend packages");
    const signal = frontendLogRequests()[0][1]?.signal;
    await user.click(screen.getByRole("link", { name: "Packages" }));
    await screen.findByRole("heading", { name: "Package catalogue" });
    expect(signal?.aborted).toBe(true);
  });

  it("identifies shared development and omits local-only startup phases", async () => {
    if (!currentStatus.frontend)
      throw new Error("Fullstack fixture is required");
    currentStatus.frontend.mode = "dev";
    currentStatus.frontend.phases[1].state = "failed";
    currentStatus.operations[0].state = "failed";
    renderDashboard();
    await screen.findByRole("heading", { name: "Fullstack status" });
    expect(screen.getByText("Shared development")).toBeVisible();
    expect(
      within(
        screen.getByRole("region", { name: "Current startup" })
      ).queryByText("Start backend services")
    ).not.toBeInTheDocument();
  });

  it("shows phase progress during startup", async () => {
    if (!currentStatus.frontend)
      throw new Error("Fullstack fixture is required");
    currentStatus.frontend.state = "running";
    currentStatus.frontend.running = false;
    currentStatus.frontend.phases[1].state = "running";
    renderDashboard();
    await screen.findByRole("heading", { name: "Fullstack status" });
    expect(
      screen.getByRole("region", { name: "Current startup" })
    ).toHaveTextContent("starting");
    expect(
      within(
        screen.getByRole("list", { name: "Start backend services details" })
      ).getByText("Build backend packages")
    ).toBeVisible();
  });

  it("keeps startup details visible with the connection error when an API refresh fails", async () => {
    renderDashboard();
    await screen.findByRole("heading", { name: "Fullstack status" });
    failStatus = true;
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Refresh runtime status" }));
    expect(
      await screen.findByText("Runtime observer unavailable")
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Current startup" })
    ).toHaveTextContent("Build backend packages");
  });

  it("opens infrastructure startup diagnostics with orchestration output", async () => {
    if (!currentStatus.frontend)
      throw new Error("Fullstack fixture is required");
    currentStatus.frontend.phases.unshift({
      id: "infra",
      label: "Prepare local infrastructure",
      state: "passed",
    });
    renderDashboard();
    await screen.findByRole("heading", { name: "Fullstack status" });
    expect(
      screen.getByRole("link", { name: "Prepare local infrastructure logs" })
    ).toHaveAttribute("href", "#/logs?source=orchestration");
  });

  it("opens seed startup logs through the Tenant Seeding preset", async () => {
    if (!currentStatus.frontend)
      throw new Error("Fullstack fixture is required");
    currentStatus.frontend.phases.push({
      id: "seed",
      label: "Seed local data",
      state: "passed",
    });
    renderDashboard();
    expect(
      await screen.findByRole("link", { name: "Seed local data logs" })
    ).toHaveAttribute("href", "#/logs?source=preset%3Atenant-seeding");
  });

  it("loads only the selected frontend log and keeps failures separate from runtime state", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByRole("heading", { name: "Fullstack status" });
    expect(frontendLogRequests()).toHaveLength(0);
    await user.click(
      screen.getByRole("button", { name: "Show frontend logs" })
    );
    const logs = within(screen.getByRole("region", { name: "Frontend logs" }));
    expect(await logs.findByText("startup output")).toBeVisible();
    await user.selectOptions(
      logs.getByRole("combobox", { name: "Frontend log source" }),
      "vite"
    );
    expect(await logs.findByText("vite output")).toBeVisible();
    expect(
      frontendLogRequests().map(([input]) =>
        new URL(String(input)).searchParams.get("source")
      )
    ).toEqual(["startup", "vite"]);
    await user.click(
      screen.getByRole("button", { name: "Hide frontend logs" })
    );
    expect(
      screen.queryByRole("region", { name: "Frontend logs" })
    ).not.toBeInTheDocument();
    failFrontendLogs = true;
    await user.click(
      screen.getByRole("button", { name: "Show frontend logs" })
    );
    expect(
      await screen.findByText("Frontend log file unavailable")
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Current startup" })
    ).toHaveTextContent("Build backend packages");
    await user.click(screen.getByRole("link", { name: "Packages" }));
    await screen.findByRole("heading", { name: "Package catalogue" });
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Frontend logs" })
      ).not.toBeInTheDocument()
    );
  });
});
