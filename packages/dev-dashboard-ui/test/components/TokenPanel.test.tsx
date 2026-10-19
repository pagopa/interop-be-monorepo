import type {
  IdentitiesResponse,
  Operation,
  Package,
} from "pagopa-interop-dev-dashboard-contracts";

import {
  act,
  fireEvent,
  render as renderToaster,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TokenPanel } from "../../src/components/TokenPanel";
import { useAccessToken } from "../../src/hooks/useAccessToken";
import { NotificationProvider } from "../../src/providers/NotificationProvider";
import { identitiesFixture, statusFixture } from "../fixtures";
import {
  createTestQueryClient,
  createTestWrapper,
  renderWithProviders as render,
} from "../utils";

const seedPackages = statusFixture().seedPackages;
const runningSeedPackages: Package[] = seedPackages.map((name) => ({
  name,
  label: name,
  kind: "service",
  state: "running",
  watch: false,
}));
const unreadyStatus = {
  packages: statusFixture().packages,
  seedReady: false,
};

describe("local identities", () => {
  beforeEach(() =>
    renderToaster(<NotificationProvider>{null}</NotificationProvider>)
  );
  afterEach(() => toast.dismiss());
  it("disables completed seed actions when packages and local data are ready", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ ready: false, tenants: [] }))
    );
    const onSeed = vi.fn().mockResolvedValue(true);
    const onPrepare = vi.fn();
    render(
      <TokenPanel
        packages={runningSeedPackages}
        seedPackages={seedPackages}
        seedReady
        operations={[]}
        onSeed={onSeed}
        onPrepare={onPrepare}
      />
    );
    await screen.findByRole("region", { name: "Local identities unavailable" });
    const prepare = screen.getByRole("button", {
      name: "Seed packages running",
    });
    expect(prepare).toHaveTextContent("Seed packages running");
    expect(prepare).toBeDisabled();
    expect(prepare).toHaveAttribute("aria-busy", "false");
    expect(prepare.querySelector(".lucide-check")).toBeInTheDocument();
    const seed = screen.getByRole("button", { name: "Local data seeded" });
    expect(seed).toHaveTextContent("Local data seeded");
    expect(seed).toHaveAttribute("title", "Local data seeded");
    expect(seed.querySelector(".lucide-check")).toBeInTheDocument();
    expect(seed).toBeDisabled();
    const user = userEvent.setup();
    await user.click(prepare);
    expect(onPrepare).not.toHaveBeenCalled();
    await user.click(seed);
    expect(onSeed).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "View seed packages" })
    ).toHaveAttribute("href", "/packages?group=seed");
    expect(
      screen.getByRole("link", { name: "Logs for seed packages" })
    ).toHaveAttribute("href", "/logs?source=group%3Aseed");
  });

  it.each([
    "stopped",
    "building",
    "starting",
    "failed",
    "missing",
    "empty",
  ] satisfies Array<Package["state"] | "missing" | "empty">)(
    "restores package startup after a %s status change and clears seeded feedback on reset",
    async (state) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json(identitiesFixture))
      );
      const props = {
        seedPackages,
        seedReady: true,
        operations: [],
        onSeed: vi.fn(),
        onPrepare: vi.fn(),
      };
      const view = render(
        <TokenPanel {...props} packages={runningSeedPackages} />
      );
      await screen.findByRole("button", { name: "Generate token" });
      const prepare = screen.getByRole("button", {
        name: "Seed packages running",
      });
      const seed = screen.getByRole("button", {
        name: "Local data seeded",
      });
      expect(prepare).toBeDisabled();
      const packages: Package[] = runningSeedPackages.flatMap((item, index) =>
        index !== 0
          ? [item]
          : state === "missing" || state === "empty"
            ? []
            : [{ ...item, state }]
      );
      view.rerender(
        <TokenPanel
          {...props}
          packages={packages}
          seedPackages={state === "empty" ? [] : seedPackages}
        />
      );
      expect(prepare).toHaveAccessibleName("Start seed packages");
      expect(prepare).toHaveTextContent("Start seed packages");
      expect(prepare).toBeEnabled();
      expect(seed).toHaveTextContent("Local data seeded");
      expect(seed).toBeDisabled();
      view.rerender(
        <TokenPanel {...props} packages={packages} seedReady={false} />
      );
      expect(seed).toHaveAccessibleName("Seed local data");
      expect(seed).toHaveTextContent("Seed local data");
      expect(seed).toBeEnabled();
      expect(seed.querySelector(".lucide-check")).not.toBeInTheDocument();
      expect(prepare).toHaveClass("w-44");
      expect(seed).toHaveClass("w-40");
      expect(
        screen.getByRole("button", { name: "Generate token" })
      ).toBeEnabled();
    }
  );

  it.each(["seed", "seed.prepare"])(
    "prioritizes active %s loading over completed status and leaves navigation usable",
    async (kind) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(Response.json(identitiesFixture))
      );
      const props = {
        packages: runningSeedPackages,
        seedPackages,
        seedReady: true,
        onSeed: vi.fn(),
        onPrepare: vi.fn(),
      };
      const operation = {
        id: "active-ready-action",
        kind,
        state: "running",
        startedAt: "2026-10-08T15:00:00Z",
        phases: [],
      } satisfies Operation;
      const view = render(<TokenPanel {...props} operations={[operation]} />);
      await screen.findByRole("button", { name: "Generate token" });
      const button = screen.getByRole("button", {
        name: kind === "seed" ? "Seed local data" : "Start seed packages",
      });
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toBeDisabled();
      expect(within(button).getByRole("status")).toHaveTextContent(
        kind === "seed" ? "Seeding local data" : "Starting seed packages"
      );
      expect(button.querySelector(".lucide-check")).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "View seed packages" })
      ).not.toHaveAttribute("aria-disabled");
      expect(
        screen.getByRole("link", { name: "Logs for seed packages" })
      ).not.toHaveAttribute("aria-disabled");
      view.rerender(<TokenPanel {...props} operations={[]} />);
      expect(button).toHaveAttribute("aria-busy", "false");
      expect(button).toHaveTextContent(
        kind === "seed" ? "Local data seeded" : "Seed packages running"
      );
      expect(button.querySelector(".lucide-check")).toBeInTheDocument();
    }
  );

  it("does not infer completed actions from available identities or passed operation history", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(identitiesFixture))
    );
    render(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={["seed", "seed.prepare"].map((kind) => ({
          id: kind,
          kind,
          state: "passed",
          startedAt: "2026-10-08T15:00:00Z",
          phases: [],
        }))}
        onSeed={vi.fn()}
        onPrepare={vi.fn()}
      />
    );
    await screen.findByRole("button", { name: "Generate token" });
    expect(
      screen.getByRole("button", { name: "Start seed packages" })
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Seed local data" })
    ).toBeEnabled();
    expect(screen.queryByText("Seed packages running")).not.toBeInTheDocument();
    expect(screen.queryByText("Local data seeded")).not.toBeInTheDocument();
  });

  it("guards completed startup and seed calls until current readiness changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(identitiesFixture))
    );
    const onPrepare = vi.fn().mockResolvedValue(true);
    const onSeed = vi.fn().mockResolvedValue(true);
    const props = {
      packages: runningSeedPackages,
      seedPackages,
      seedReady: true,
      operations: [],
      onPrepare,
      onSeed,
    };
    const { result, rerender } = renderHook(
      (status) => useAccessToken(status),
      {
        initialProps: props,
        wrapper: createTestWrapper(),
      }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.runTokenAction("seed.prepare"));
    expect(onPrepare).not.toHaveBeenCalled();
    await act(async () => result.current.runTokenAction("seed"));
    expect(onSeed).not.toHaveBeenCalled();
    rerender({
      ...props,
      packages: runningSeedPackages.slice(1),
      seedReady: false,
    });
    await act(async () => result.current.runTokenAction("seed.prepare"));
    expect(onPrepare).toHaveBeenCalledTimes(1);
    await act(async () => result.current.runTokenAction("seed"));
    expect(onSeed).toHaveBeenCalledTimes(1);
  });

  it("always exposes refresh beside the token title and keeps seed navigation before Seed local data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(identitiesFixture))
    );
    render(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[]}
        onSeed={vi.fn()}
        onPrepare={vi.fn()}
      />
    );
    await screen.findByRole("button", { name: "Generate token" });
    const title = screen.getByRole("heading", { name: "Local access token" });
    const refresh = screen.getByRole("button", { name: "Reload identities" });
    expect(refresh).toBeEnabled();
    expect(title.parentElement).toContainElement(refresh);
    const controls = [
      screen.getByRole("button", { name: "Start seed packages" }),
      screen.getByRole("link", { name: "View seed packages" }),
      screen.getByRole("link", { name: "Logs for seed packages" }),
      screen.getByRole("button", { name: "Seed local data" }),
    ];
    controls.slice(1).forEach((control, index) => {
      expect(controls[index]?.compareDocumentPosition(control)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(controls[1]).toHaveAttribute("href", "/packages?group=seed");
    expect(controls[2]).toHaveAttribute("href", "/logs?source=group%3Aseed");
  });
  it("revalidates cached identities when reopening the panel and does not issue a token automatically", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(identitiesFixture));
    vi.stubGlobal("fetch", fetchMock);
    const client = createTestQueryClient();
    const props = {
      ...unreadyStatus,
      seedPackages: statusFixture().seedPackages,
      operations: [],
      onSeed: vi.fn(),
      onPrepare: vi.fn(),
    };
    const view = render(<TokenPanel {...props} />, { client });
    await screen.findByRole("combobox", { name: "Tenant" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    view.unmount();
    render(<TokenPanel {...props} />, { client });
    await screen.findByRole("combobox", { name: "Tenant" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(
      screen.queryByRole("textbox", { name: "Session token" })
    ).not.toBeInTheDocument();
    expect(props.onSeed).not.toHaveBeenCalled();
    expect(props.onPrepare).not.toHaveBeenCalled();
  });
  it("preserves seeded identities and the token after completed seed operations leave the history", async () => {
    let identities: IdentitiesResponse = { ready: false, tenants: [] };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        String(input).endsWith("/identity")
          ? Response.json({ sessionToken: "seeded-token" })
          : Response.json(identities)
      );
    vi.stubGlobal("fetch", fetchMock);
    const props = {
      ...unreadyStatus,
      seedPackages: statusFixture().seedPackages,
      onSeed: vi.fn(),
      onPrepare: vi.fn(),
    };
    const view = render(<TokenPanel {...props} operations={[]} />);
    await screen.findByRole("region", { name: "Local identities unavailable" });
    identities = identitiesFixture;
    const seed = {
      id: "completed-seed",
      kind: "seed",
      state: "passed",
      startedAt: "2026-10-08T15:00:00Z",
      phases: [],
    } satisfies Operation;
    view.rerender(<TokenPanel {...props} operations={[seed]} />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Generate token" })
    );
    expect(
      await screen.findByRole("textbox", { name: "Session token" })
    ).toHaveValue("seeded-token");
    view.rerender(<TokenPanel {...props} operations={[]} />);
    expect(screen.getByRole("combobox", { name: "Tenant" })).toHaveValue(
      "consumer"
    );
    expect(screen.getByRole("textbox", { name: "Session token" })).toHaveValue(
      "seeded-token"
    );
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).endsWith("/identities")
      )
    ).toHaveLength(2);
  });
  it.each(["seed", "seed.prepare"])(
    "keeps the compact %s failure after history eviction until retry",
    async (kind) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockImplementation(async () => Response.json(identitiesFixture))
      );
      const props = {
        ...unreadyStatus,
        seedPackages: statusFixture().seedPackages,
        onSeed: vi.fn().mockResolvedValue(true),
        onPrepare: vi.fn().mockResolvedValue(true),
      };
      const operation = {
        id: "failed-operation",
        kind,
        state: "running",
        startedAt: "2026-10-08T15:00:00Z",
        phases: [],
      } satisfies Operation;
      const view = render(<TokenPanel {...props} operations={[operation]} />);
      await screen.findByRole("button", { name: "Generate token" });
      view.rerender(
        <TokenPanel
          {...props}
          operations={[{ ...operation, state: "failed" }]}
        />
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        kind === "seed" ? "Seed failed" : "Seed packages startup failed"
      );
      view.rerender(<TokenPanel {...props} operations={[]} />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        kind === "seed" ? "Seed failed" : "Seed packages startup failed"
      );
      const user = userEvent.setup();
      await user.click(
        screen.getByRole("button", {
          name: kind === "seed" ? "Seed local data" : "Start seed packages",
        })
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
  );
  it("reloads identities and clears the old token when a later seed passes with the same timestamp", async () => {
    const oldSeed = {
      id: "old-seed",
      kind: "seed",
      state: "passed",
      startedAt: "2026-10-08T15:00:00.000Z",
      phases: [],
    } satisfies Operation;
    let identities = identitiesFixture;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        String(input).endsWith("/identity")
          ? Response.json({ sessionToken: "old-token" })
          : Response.json(identities)
      );
    vi.stubGlobal("fetch", fetchMock);
    const onSeed = vi.fn();
    const onPrepare = vi.fn();
    const view = render(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[oldSeed]}
        onSeed={onSeed}
        onPrepare={onPrepare}
      />
    );
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Generate token" })
    );
    expect(
      await screen.findByRole("textbox", { name: "Session token" })
    ).toHaveValue("old-token");
    view.rerender(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[oldSeed, { ...oldSeed, id: "new-seed", state: "running" }]}
        onSeed={onSeed}
        onPrepare={onPrepare}
      />
    );
    expect(screen.getByRole("textbox", { name: "Session token" })).toHaveValue(
      "old-token"
    );
    identities = {
      ...identitiesFixture,
      tenants: [
        { ...identitiesFixture.tenants[0], name: "Updated local tenant" },
      ],
    };
    view.rerender(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[oldSeed, { ...oldSeed, id: "new-seed" }]}
        onSeed={onSeed}
        onPrepare={onPrepare}
      />
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).endsWith("/identities")
        )
      ).toHaveLength(2)
    );
    expect(
      await screen.findByRole("option", { name: "Updated local tenant" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Session token" })
    ).not.toBeInTheDocument();
    expect(onSeed).not.toHaveBeenCalled();
  });

  it("discovers identities on entry and keeps the explicit seed action available when ready", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        String(input).endsWith("/identity")
          ? Response.json({ sessionToken: "local-token" })
          : Response.json(identitiesFixture)
      );
    vi.stubGlobal("fetch", fetchMock);
    const onSeed = vi.fn().mockResolvedValue(true);
    render(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[]}
        onSeed={onSeed}
        onPrepare={vi.fn()}
      />
    );
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Generate token" })
    );
    expect(
      await screen.findByRole("textbox", { name: "Session token" })
    ).toHaveValue("local-token");
    expect(
      screen.getByRole("button", { name: "Seed local data" })
    ).toBeEnabled();
    expect(onSeed).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Reload identities" })
    ).toBeEnabled();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).endsWith("/actions"))
    ).toBe(false);
  });

  it.each(
    ["tenant", "user", "token"].flatMap((change) =>
      ["resolves", "rejects"].map((outcome) => ({ change, outcome }))
    )
  )(
    "preserves the current $change when an earlier clipboard write $outcome",
    async ({ change, outcome }) => {
      const identities = {
        ...identitiesFixture,
        tenants: identitiesFixture.tenants.map((tenant) =>
          tenant.key === "consumer"
            ? {
                ...tenant,
                users: [...tenant.users, ...identitiesFixture.tenants[1].users],
              }
            : tenant
        ),
      };
      let token = "original-token";
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockImplementation(async (input) =>
            String(input).endsWith("/identity")
              ? Response.json({ sessionToken: token })
              : Response.json(identities)
          )
      );
      const user = userEvent.setup();
      let finishCopy: () => void = () => undefined;
      const clipboard = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve, reject) => {
              finishCopy =
                outcome === "resolves"
                  ? resolve
                  : () => reject(new Error("Clipboard failed"));
            })
        );
      render(
        <TokenPanel
          {...unreadyStatus}
          seedPackages={seedPackages}
          operations={[]}
          onSeed={vi.fn()}
          onPrepare={vi.fn()}
        />
      );
      await user.click(
        await screen.findByRole("button", { name: "Generate token" })
      );
      expect(
        await screen.findByRole("textbox", { name: "Session token" })
      ).toHaveValue("original-token");
      await user.click(screen.getByRole("button", { name: "Copy token" }));
      expect(clipboard).toHaveBeenCalledExactlyOnceWith("original-token");

      if (change === "token") {
        token = "replacement-token";
        await user.click(
          screen.getByRole("button", { name: "Generate token" })
        );
        await screen.findByDisplayValue("replacement-token");
      } else {
        await user.selectOptions(
          screen.getByRole("combobox", {
            name: change === "tenant" ? "Tenant" : "User",
          }),
          change === "tenant" ? "producer" : "operator"
        );
      }
      await act(async () => finishCopy());

      expect(screen.getByRole("combobox", { name: "Tenant" })).toHaveValue(
        change === "tenant" ? "producer" : "consumer"
      );
      expect(screen.getByRole("combobox", { name: "User" })).toHaveValue(
        change === "token" ? "admin" : "operator"
      );
      if (change === "token")
        expect(
          screen.getByRole("textbox", { name: "Session token" })
        ).toHaveValue("replacement-token");
      else
        expect(
          screen.queryByRole("textbox", { name: "Session token" })
        ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Copied" })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
  );

  it("reloads missing identities without automatically seeding and exposes discovered identities", async () => {
    let ready = false;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        Response.json(ready ? identitiesFixture : { ready: false, tenants: [] })
      );
    vi.stubGlobal("fetch", fetchMock);
    const onSeed = vi.fn();
    render(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[]}
        onSeed={onSeed}
        onPrepare={vi.fn()}
      />
    );
    const empty = await screen.findByRole("region", {
      name: "Local identities unavailable",
    });
    expect(
      within(empty)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
    ).toEqual(seedPackages);
    expect(
      screen.getByRole("button", { name: "Reload identities" })
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Seed local data" })
    ).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    ready = true;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Reload identities" }));
    expect(
      await screen.findByRole("button", { name: "Generate token" })
    ).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onSeed).not.toHaveBeenCalled();
    expect(await screen.findByText("Identities refreshed")).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Local access token" })
      ).queryByText("Identities refreshed")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Local identities unavailable" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reload identities" })
    ).toBeInTheDocument();
  });

  it("keeps generation disabled while a seed request is pending and clears its compact HTTP failure on retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockImplementation(async () => Response.json(identitiesFixture))
    );
    let finish: (accepted: boolean) => void = () => undefined;
    const onSeed = vi.fn().mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        })
    );
    render(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[]}
        onSeed={onSeed}
        onPrepare={vi.fn()}
      />
    );
    const user = userEvent.setup();
    const generate = await screen.findByRole("button", {
      name: "Generate token",
    });
    const seed = screen.getByRole("button", { name: "Seed local data" });
    await user.click(seed);
    expect(seed).toHaveAttribute("aria-busy", "true");
    expect(seed).toBeDisabled();
    expect(generate).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Start seed packages" })
    ).toBeDisabled();
    await user.click(seed);
    expect(onSeed).toHaveBeenCalledTimes(1);
    finish(false);
    const failure = await screen.findByRole("alert");
    expect(failure).toHaveTextContent("Seed failed");
    expect(screen.getByRole("link", { name: "Logs" })).toHaveAttribute(
      "href",
      "/logs?source=orchestration&level=error"
    );
    expect(seed).toHaveAttribute("aria-busy", "false");
    await user.click(seed);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    finish(true);
    await waitFor(() => expect(seed).toHaveAttribute("aria-busy", "false"));
  });

  it("keeps missing-identity guidance visible while reloading and disables reload during package startup", async () => {
    let finish: (response: Response) => void = () => undefined;
    const reload = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ready: false, tenants: [] }))
      .mockReturnValueOnce(reload);
    vi.stubGlobal("fetch", fetchMock);
    const onSeed = vi.fn();
    const onPrepare = vi.fn();
    const view = render(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[]}
        onSeed={onSeed}
        onPrepare={onPrepare}
      />
    );
    const empty = await screen.findByRole("region", {
      name: "Local identities unavailable",
    });
    const button = screen.getByRole("button", {
      name: "Reload identities",
    });
    const user = userEvent.setup();
    await user.click(button);
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(within(empty).getAllByRole("listitem")).toHaveLength(
      seedPackages.length
    );
    await user.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    finish(Response.json({ ready: false, tenants: [] }));
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "false"));
    view.rerender(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[]}
        prepareBusy="request"
        onSeed={onSeed}
        onPrepare={onPrepare}
      />
    );
    expect(button).toBeDisabled();
    expect(onSeed).not.toHaveBeenCalled();
    expect(onPrepare).not.toHaveBeenCalled();
  });

  it("reports an empty fast reload and prevents repeated requests until its cooldown ends", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        Response.json({ ready: false, tenants: [] })
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[]}
        onSeed={vi.fn()}
        onPrepare={vi.fn()}
      />
    );
    const button = await screen.findByRole("button", {
      name: "Reload identities",
    });
    await waitFor(() => expect(button).toBeEnabled());
    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(button);
        fireEvent.click(button);
      });
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(button).toHaveAttribute("aria-busy", "false");
      expect(button).toBeDisabled();
      expect(
        screen.getByText("No identities found. Run Seed local data.")
      ).toBeInTheDocument();
      expect(
        within(
          screen.getByRole("region", { name: "Local access token" })
        ).queryByText("No identities found. Run Seed local data.")
      ).not.toBeInTheDocument();
      fireEvent.click(button);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      act(() => vi.advanceTimersByTime(1900));
      expect(button).toBeDisabled();
      act(() => vi.advanceTimersByTime(100));
      expect(button).toBeEnabled();
      expect(
        screen.getByText("No identities found. Run Seed local data.")
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a failed reload and allows retry after the cooldown", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async () =>
        Response.json({ ready: false, tenants: [] })
      )
      .mockRejectedValueOnce(new Error("Identity read failed"))
      .mockImplementation(async () => Response.json(identitiesFixture));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[]}
        onSeed={vi.fn()}
        onPrepare={vi.fn()}
      />
    );
    const button = await screen.findByRole("button", {
      name: "Reload identities",
    });
    await waitFor(() => expect(button).toBeEnabled());
    vi.useFakeTimers();
    try {
      await act(async () => fireEvent.click(button));
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(screen.getByText("Identity read failed")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        within(
          screen.getByRole("region", { name: "Local access token" })
        ).queryByText("Identity read failed")
      ).not.toBeInTheDocument();
      expect(button).toBeDisabled();
      act(() => vi.advanceTimersByTime(2000));
      await act(async () => fireEvent.click(button));
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("Identities refreshed")).toBeInTheDocument();
      expect(
        within(
          screen.getByRole("region", { name: "Local access token" })
        ).queryByText("Identities refreshed")
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Generate token" })
      ).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("guards duplicate startup requests and clears a rejected startup failure on retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(identitiesFixture))
    );
    let reject: (failure: Error) => void = () => undefined;
    const onPrepare = vi
      .fn<() => Promise<boolean>>()
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((_, rejectRequest) => {
            reject = rejectRequest;
          })
      )
      .mockResolvedValue(true);
    const onSeed = vi.fn();
    const user = userEvent.setup();
    render(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[]}
        onSeed={onSeed}
        onPrepare={onPrepare}
      />
    );
    const generate = await screen.findByRole("button", {
      name: "Generate token",
    });
    const prepare = screen.getByRole("button", { name: "Start seed packages" });
    await user.click(prepare);
    expect(prepare).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("link", { name: "View seed packages" })
    ).toHaveAttribute("href", "/packages?group=seed");
    expect(
      screen.getByRole("link", { name: "Logs for seed packages" })
    ).toHaveAttribute("href", "/logs?source=group%3Aseed");
    expect(prepare).toBeDisabled();
    expect(generate).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Seed local data" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Seed local data" })
    ).toHaveAttribute("aria-busy", "false");
    expect(
      screen.getByRole("button", { name: "Reload identities" })
    ).toBeDisabled();
    expect(screen.getByLabelText("Tenant")).toBeDisabled();
    expect(screen.getByLabelText("User")).toBeDisabled();
    await user.click(prepare);
    expect(onPrepare).toHaveBeenCalledTimes(1);
    expect(onSeed).not.toHaveBeenCalled();
    reject(new Error("Private startup failure"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Seed packages startup failed"
    );
    expect(
      screen.queryByText("Private startup failure")
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Logs" })).toHaveAttribute(
      "href",
      "/logs?source=orchestration&level=error"
    );
    expect(prepare).toHaveAttribute("aria-busy", "false");
    await user.click(prepare);
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
    expect(onPrepare).toHaveBeenCalledTimes(2);
  });

  it("blocks startup while token generation is pending without starting seed", async () => {
    let finish: (response: Response) => void = () => undefined;
    const generation = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockImplementation(async (input) =>
          String(input).endsWith("/identity")
            ? generation
            : Response.json(identitiesFixture)
        )
    );
    const onPrepare = vi.fn();
    const onSeed = vi.fn();
    const user = userEvent.setup();
    render(
      <TokenPanel
        {...unreadyStatus}
        seedPackages={seedPackages}
        operations={[]}
        onSeed={onSeed}
        onPrepare={onPrepare}
      />
    );
    await user.click(
      await screen.findByRole("button", { name: "Generate token" })
    );
    const prepare = screen.getByRole("button", { name: "Start seed packages" });
    expect(prepare).toBeDisabled();
    expect(prepare).toHaveAttribute("aria-busy", "false");
    await user.click(prepare);
    expect(onPrepare).not.toHaveBeenCalled();
    expect(onSeed).not.toHaveBeenCalled();
    finish(Response.json({ sessionToken: "local-token" }));
    expect(
      await screen.findByRole("textbox", { name: "Session token" })
    ).toHaveValue("local-token");
    expect(prepare).toBeEnabled();
  });
});
