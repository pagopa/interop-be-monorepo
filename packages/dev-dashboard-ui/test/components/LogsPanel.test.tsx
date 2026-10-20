import type {
  LogEntry,
  LogSource,
  Preset,
} from "pagopa-interop-dev-dashboard-contracts";

import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { LogsPanel } from "../../src/components/LogsPanel";
import { emptyLogs, statusFixture } from "../fixtures";
import { renderWithProviders as render } from "../utils";

const sources: LogSource[] = [
  { id: "agreement", label: "Agreement", kind: "backend" },
  { id: "consumer", label: "Consumer", kind: "backend" },
  { id: "infra:postgres", label: "Postgres", kind: "infrastructure" },
];

function entry(id: string, service: string): LogEntry {
  return { id, source: service, service, level: "info", message: `Log ${id}` };
}

describe("aggregate log filters", () => {
  it.each([undefined, "cid-123"])(
    "copies only the selected log message with correlation ID %s and reports success without resizing the viewport",
    async (cid) => {
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
        440
      );
      vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
        800
      );
      const user = userEvent.setup();
      const clipboard = vi
        .spyOn(navigator.clipboard, "writeText")
        .mockResolvedValue();
      const success = vi.spyOn(toast, "success").mockReturnValue("copied");
      const message = 'Request failed\n{"reason":"missing tenant"}';
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(
          Response.json({
            entries: [
              { ...entry("1", "agreement"), cid, message },
              { ...entry("2", "consumer"), message: "Another log message" },
            ],
            cursors: { agreement: "1", consumer: "2" },
            resetSources: [],
          })
        )
      );
      render(
        <LogsPanel
          sources={sources}
          presets={[]}
          selectedSource=""
          selectedLevel=""
          onFiltersChange={vi.fn()}
        />
      );
      const log = await screen.findByText(message, {
        normalizer: (text) => text,
      });
      const row = log.closest('[role="listitem"]');
      if (!(row instanceof HTMLElement)) throw new Error("Log row missing");
      const viewport = screen.getByRole("list", {
        name: "Aggregate log entries",
      });
      viewport.scrollTop = 120;
      const copy = within(row).getByRole("button", { name: "Copy log line" });
      copy.focus();
      await user.keyboard("{Enter}");
      expect(clipboard).toHaveBeenCalledExactlyOnceWith(message);
      expect(success).toHaveBeenCalledWith("Log line copied");
      expect(screen.getByRole("list", { name: "Aggregate log entries" })).toBe(
        viewport
      );
      expect(viewport.scrollTop).toBe(120);
      expect(copy).toHaveFocus();
      expect(screen.queryByText("Log line copied")).not.toBeInTheDocument();
      if (cid) {
        await user.click(
          within(row).getByRole("button", {
            name: `Copy correlation ID ${cid}`,
          })
        );
        expect(clipboard).toHaveBeenLastCalledWith(cid);
        expect(success).toHaveBeenLastCalledWith("Correlation ID copied");
      }
    }
  );

  it("reports failed row clipboard access through a snackbar without replacing the log list", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(440);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("Clipboard unavailable")
    );
    const failure = vi.spyOn(toast, "error").mockReturnValue("copy-error");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          entries: [entry("1", "agreement")],
          cursors: { agreement: "1" },
          resetSources: [],
        })
      )
    );
    render(
      <LogsPanel
        sources={sources}
        presets={[]}
        selectedSource=""
        selectedLevel=""
        onFiltersChange={vi.fn()}
      />
    );
    const copy = await screen.findByRole("button", { name: "Copy log line" });
    const viewport = screen.getByRole("list", {
      name: "Aggregate log entries",
    });
    await user.click(copy);
    expect(failure).toHaveBeenCalledWith(
      "Clipboard access is unavailable. Download the logs or select the text manually."
    );
    expect(screen.getByRole("list", { name: "Aggregate log entries" })).toBe(
      viewport
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    { label: "All packages", value: "group:packages" },
    { label: "Infra", value: "group:infra" },
  ])(
    "offers $label as an aggregate source and retains the level",
    async ({ label, value }) => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => Response.json(emptyLogs));
      vi.stubGlobal("fetch", fetchMock);
      const onFiltersChange = vi.fn();
      const props = {
        sources,
        presets: [],
        selectedLevel: "error",
        onFiltersChange,
      };
      const { rerender } = render(<LogsPanel {...props} selectedSource="" />);
      const source = screen.getByRole("combobox", { name: "Source" });
      expect(within(source).getByRole("option", { name: label })).toHaveValue(
        value
      );
      await userEvent.setup().selectOptions(source, value);
      expect(onFiltersChange).toHaveBeenLastCalledWith(value, "error");
      rerender(<LogsPanel {...props} selectedSource={value} />);
      expect(source).toHaveValue(value);
      expect(
        within(source).getAllByRole("option", { name: label })
      ).toHaveLength(1);
      expect(
        within(source).queryByRole("option", { name: value })
      ).not.toBeInTheDocument();
      await waitFor(() =>
        expect(
          fetchMock.mock.calls.some(([input]) => {
            const query = new URL(String(input)).searchParams;
            return (
              query.get("source") === value && query.get("level") === "error"
            );
          })
        ).toBe(true)
      );
    }
  );

  it.each(["success", "empty", "error"])(
    "keeps the viewport, toolbar and focused filter during a slow %s transition without exporting previous data",
    async (outcome) => {
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
        440
      );
      vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(
        800
      );
      let finish: (response: Response) => void = () => undefined;
      const pending = new Promise<Response>((resolve) => {
        finish = resolve;
      });
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(
            Response.json({
              entries: Array.from({ length: 30 }, (_, index) =>
                entry(String(index + 1), "agreement")
              ),
              cursors: { agreement: "old:30" },
              resetSources: [],
            })
          )
          .mockReturnValueOnce(pending)
      );
      const props = {
        sources,
        presets: [],
        selectedLevel: "",
        onFiltersChange: vi.fn(),
      };
      const { rerender } = render(<LogsPanel {...props} selectedSource="" />);
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("30 lines")
      );
      const viewport = screen.getByRole("list", {
        name: "Aggregate log entries",
      });
      const source = screen.getByRole("combobox", { name: "Source" });
      const copy = screen.getByRole("button", { name: "Copy" });
      const download = screen.getByRole("button", { name: "Download" });
      viewport.scrollTop = 240;
      source.focus();
      rerender(<LogsPanel {...props} selectedSource="consumer" />);
      expect(screen.getByRole("list", { name: "Aggregate log entries" })).toBe(
        viewport
      );
      expect(viewport.scrollTop).toBe(240);
      expect(source).toHaveFocus();
      expect(screen.getByRole("button", { name: "Copy" })).toBe(copy);
      expect(copy).toBeDisabled();
      expect(download).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent("updating");
      expect(screen.getByRole("status")).toHaveTextContent("previous filter");
      expect(
        screen.queryByText("Loading log entries…")
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/No lines match/)).not.toBeInTheDocument();
      await act(async () => {
        finish(
          outcome === "error"
            ? Response.json({ error: "Logs unavailable" }, { status: 500 })
            : Response.json({
                entries: outcome === "empty" ? [] : [entry("31", "consumer")],
                cursors: { consumer: "new:1" },
                resetSources: [],
              })
        );
      });
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Refresh logs" })
        ).toBeEnabled()
      );
      expect(screen.getByRole("list", { name: "Aggregate log entries" })).toBe(
        viewport
      );
      expect(source).toHaveFocus();
      if (outcome === "error") {
        expect(screen.getByRole("alert")).toHaveTextContent("Logs unavailable");
        expect(screen.getByRole("status")).toHaveTextContent("previous filter");
        expect(copy).toBeDisabled();
        expect(download).toBeDisabled();
      } else if (outcome === "empty") {
        expect(screen.getByText(/No lines match/)).toBeVisible();
        expect(screen.getByRole("status")).toHaveTextContent("0 lines");
        expect(copy).toBeDisabled();
      } else {
        expect(screen.getByRole("status")).toHaveTextContent("1 lines");
        expect(copy).toBeEnabled();
        expect(download).toBeEnabled();
      }
    }
  );

  it("disables exports immediately while Search is being debounced", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async () =>
        Response.json({
          entries: [entry("1", "agreement")],
          cursors: { agreement: "1" },
          resetSources: [],
        })
      )
    );
    render(
      <LogsPanel
        sources={sources}
        presets={[]}
        selectedSource=""
        selectedLevel=""
        onFiltersChange={vi.fn()}
      />
    );
    const copy = screen.getByRole("button", { name: "Copy" });
    await waitFor(() => expect(copy).toBeEnabled());
    await userEvent
      .setup()
      .type(screen.getByRole("searchbox", { name: "Search logs" }), "CID-42");
    expect(copy).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("updating");
  });

  it("preserves list focus while updating and prevents copying a previous filter correlation ID", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(440);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
    let finish: (response: Response) => void = () => undefined;
    const next = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json({
            entries: [{ ...entry("1", "agreement"), cid: "previous-cid" }],
            cursors: { agreement: "old:1" },
            resetSources: [],
          })
        )
        .mockReturnValueOnce(next)
    );
    const props = {
      sources,
      presets: [],
      selectedLevel: "",
      onFiltersChange: vi.fn(),
    };
    const { rerender } = render(<LogsPanel {...props} selectedSource="" />);
    const cid = await screen.findByRole("button", {
      name: "Copy correlation ID previous-cid",
    });
    const line = screen.getByRole("button", { name: "Copy log line" });
    const viewport = screen.getByRole("list", {
      name: "Aggregate log entries",
    });
    viewport.focus();
    rerender(<LogsPanel {...props} selectedSource="consumer" />);
    expect(viewport).toHaveFocus();
    expect(cid).toBeDisabled();
    expect(line).toBeDisabled();
    await act(async () => finish(Response.json(emptyLogs)));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("0 lines")
    );
    expect(viewport).toHaveFocus();
    expect(
      screen.queryByRole("button", { name: "Copy correlation ID previous-cid" })
    ).not.toBeInTheDocument();
  });

  it("keeps current-filter exports available during an incremental refresh", async () => {
    let finish: (response: Response) => void = () => undefined;
    const next = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json({
            entries: [entry("1", "agreement")],
            cursors: { agreement: "1" },
            resetSources: [],
          })
        )
        .mockReturnValueOnce(next)
    );
    render(
      <LogsPanel
        sources={sources}
        presets={[]}
        selectedSource=""
        selectedLevel=""
        onFiltersChange={vi.fn()}
      />
    );
    const copy = screen.getByRole("button", { name: "Copy" });
    await waitFor(() => expect(copy).toBeEnabled());
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Refresh logs" }));
    expect(screen.getByRole("status")).toHaveTextContent("updating");
    expect(copy).toBeEnabled();
    expect(screen.getByRole("button", { name: "Download" })).toBeEnabled();
    expect(screen.getByRole("status")).not.toHaveTextContent("previous filter");
    await act(async () => finish(Response.json(emptyLogs)));
  });

  it("keeps an already empty viewport mounted without showing an initial skeleton on the next filter", async () => {
    let finish: (response: Response) => void = () => undefined;
    const next = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(emptyLogs))
        .mockReturnValueOnce(next)
    );
    const props = {
      sources,
      presets: [],
      selectedLevel: "",
      onFiltersChange: vi.fn(),
    };
    const { container, rerender } = render(
      <LogsPanel {...props} selectedSource="" />
    );
    await screen.findByText(
      "Logs will appear as packages, infrastructure and checks produce output."
    );
    const viewport = screen.getByRole("list", {
      name: "Aggregate log entries",
    });
    rerender(<LogsPanel {...props} selectedSource="consumer" />);
    expect(screen.getByRole("list", { name: "Aggregate log entries" })).toBe(
      viewport
    );
    expect(screen.getByText("Updating log entries…")).toBeVisible();
    expect(
      container.querySelector('[data-slot="skeleton"]')
    ).not.toBeInTheDocument();
    await act(async () => finish(Response.json(emptyLogs)));
    await screen.findByText(/No lines match/);
  });
  it("shows only Search, Source and Level and submits a correlation ID through free-text Search", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(emptyLogs));
    vi.stubGlobal("fetch", fetchMock);
    const onFiltersChange = vi.fn();
    render(
      <LogsPanel
        presets={statusFixture().presets}
        sources={sources}
        selectedSource="preset:backend"
        selectedLevel="error"
        onFiltersChange={onFiltersChange}
      />
    );
    expect(
      screen.queryByRole("combobox", { name: "Service" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Correlation ID" })
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("combobox").map((select) => select.getAttribute("id"))
    ).toEqual(["log-source", "log-level"]);
    const user = userEvent.setup();
    const search = screen.getByRole("searchbox", { name: "Search logs" });
    await user.type(search, "CID-42");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const query = new URL(String(input), "http://localhost").searchParams;
          return (
            query.get("search") === "CID-42" &&
            query.get("source") === "preset:backend" &&
            query.get("level") === "error"
          );
        })
      ).toBe(true)
    );
    for (const [input] of fetchMock.mock.calls) {
      const query = new URL(String(input), "http://localhost").searchParams;
      expect(query.has("service")).toBe(false);
      expect(query.has("cid")).toBe(false);
    }
    await user.click(screen.getByRole("button", { name: "Clear log filters" }));
    expect(search).toHaveValue("");
    expect(onFiltersChange).toHaveBeenLastCalledWith("", "");
  });
  it("offers Tenant Seeding without a duplicate seed packages source and retains the controlled level", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(emptyLogs));
    vi.stubGlobal("fetch", fetchMock);
    const onFiltersChange = vi.fn();
    const presets = [
      {
        id: "tenant-seeding",
        name: "Tenant Seeding",
        source: "shared",
        packages: statusFixture().seedPackages.map((name) => ({ name })),
      },
    ] satisfies Preset[];
    const { rerender } = render(
      <LogsPanel
        presets={presets}
        sources={sources}
        selectedSource=""
        selectedLevel="error"
        onFiltersChange={onFiltersChange}
      />
    );
    const source = screen.getByRole("combobox", { name: "Source" });
    expect(
      within(source).queryByRole("option", { name: "Seed packages" })
    ).not.toBeInTheDocument();
    expect(
      within(source).queryByRole("option", { name: "group:seed" })
    ).not.toBeInTheDocument();
    expect(
      within(source).getByRole("option", { name: "Tenant Seeding" })
    ).toHaveValue("preset:tenant-seeding");
    const user = userEvent.setup();
    await user.selectOptions(source, "preset:tenant-seeding");
    expect(onFiltersChange).toHaveBeenLastCalledWith(
      "preset:tenant-seeding",
      "error"
    );
    rerender(
      <LogsPanel
        presets={presets}
        sources={sources}
        selectedSource="preset:tenant-seeding"
        selectedLevel="error"
        onFiltersChange={onFiltersChange}
      />
    );
    expect(source).toHaveValue("preset:tenant-seeding");
    expect(
      within(source).getAllByRole("option", { name: "Tenant Seeding" })
    ).toHaveLength(1);
    expect(
      within(source).queryByRole("option", { name: "group:seed" })
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const query = new URL(String(input), "http://localhost").searchParams;
          return (
            query.get("source") === "preset:tenant-seeding" &&
            query.get("level") === "error"
          );
        })
      ).toBe(true)
    );
  });
  it("requests the controlled URL level and changes source, level and clear filters together", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(emptyLogs));
    vi.stubGlobal("fetch", fetchMock);
    const onFiltersChange = vi.fn();
    const presets = statusFixture().presets;
    const { rerender } = render(
      <LogsPanel
        presets={presets}
        sources={sources}
        selectedSource="preset:backend"
        selectedLevel="error"
        onFiltersChange={onFiltersChange}
      />
    );
    const level = screen.getByRole("combobox", { name: "Level" });
    expect(level).toHaveValue("error");
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
    const user = userEvent.setup();
    await user.selectOptions(level, "warn");
    expect(onFiltersChange).toHaveBeenLastCalledWith("preset:backend", "warn");
    rerender(
      <LogsPanel
        presets={presets}
        sources={sources}
        selectedSource="preset:backend"
        selectedLevel="warn"
        onFiltersChange={onFiltersChange}
      />
    );
    expect(level).toHaveValue("warn");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Source" }),
      "agreement"
    );
    expect(onFiltersChange).toHaveBeenLastCalledWith("agreement", "warn");
    await user.click(screen.getByRole("button", { name: "Clear log filters" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith("", "");
  });

  it("separates shared and local presets from package, infrastructure and runtime sources without duplicating the selected preset", async () => {
    const presets = statusFixture().presets;
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockImplementation(async () => Response.json(emptyLogs))
    );
    render(
      <LogsPanel
        presets={presets}
        sources={[
          ...sources,
          {
            id: "orchestration",
            label: "Orchestration",
            kind: "orchestration",
          },
        ]}
        selectedSource="preset:personal-core"
        selectedLevel=""
        onFiltersChange={vi.fn()}
      />
    );
    const source = screen.getByRole("combobox", { name: "Source" });
    const sharedPresets = within(source).getByRole("group", {
      name: "Shared presets",
    });
    const localPresets = within(source).getByRole("group", {
      name: "Local presets",
    });
    expect(
      within(sharedPresets).getByRole("option", { name: "Backend core" })
    ).toHaveValue("preset:backend");
    expect(
      within(localPresets).getByRole("option", { name: "My core" })
    ).toHaveValue("preset:personal-core");
    expect(
      within(sharedPresets).queryByRole("option", { name: "My core" })
    ).not.toBeInTheDocument();
    expect(
      within(localPresets).queryByRole("option", { name: "Backend core" })
    ).not.toBeInTheDocument();
    expect(
      within(source).queryByRole("option", { name: "preset:personal-core" })
    ).not.toBeInTheDocument();
    expect(source).toHaveValue("preset:personal-core");
    expect(
      within(
        within(source).getByRole("group", { name: "Packages" })
      ).getAllByRole("option")
    ).toHaveLength(2);
    expect(
      within(
        within(source).getByRole("group", { name: "Infrastructure" })
      ).getByRole("option", { name: "Postgres" })
    ).toBeInTheDocument();
    expect(
      within(
        within(source).getByRole("group", { name: "Runtime" })
      ).getAllByRole("option")
    ).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("0 lines")
    );
  });

  it("omits empty source groups and includes only the available shared preset when no local presets exist", () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockImplementation(async () => Response.json(emptyLogs))
    );
    const { rerender } = render(
      <LogsPanel
        presets={statusFixture().presets.filter(
          (preset) => preset.source === "shared"
        )}
        sources={[]}
        selectedSource="preset:backend"
        selectedLevel=""
        onFiltersChange={vi.fn()}
      />
    );
    const source = screen.getByRole("combobox", { name: "Source" });
    expect(within(source).getAllByRole("group")).toHaveLength(1);
    expect(
      within(source).getByRole("group", { name: "Shared presets" })
    ).toBeInTheDocument();
    expect(
      within(source).queryByRole("group", { name: "Local presets" })
    ).not.toBeInTheDocument();
    expect(
      within(source).queryByRole("option", { name: "My core" })
    ).not.toBeInTheDocument();
    rerender(
      <LogsPanel
        presets={statusFixture().presets.filter(
          (preset) => preset.source === "personal"
        )}
        sources={[]}
        selectedSource="preset:personal-core"
        selectedLevel=""
        onFiltersChange={vi.fn()}
      />
    );
    expect(within(source).getAllByRole("group")).toHaveLength(1);
    expect(
      within(source).getByRole("group", { name: "Local presets" })
    ).toBeInTheDocument();
    expect(
      within(source).queryByRole("group", { name: "Shared presets" })
    ).not.toBeInTheDocument();
    rerender(
      <LogsPanel
        presets={[]}
        sources={[]}
        selectedSource=""
        selectedLevel=""
        onFiltersChange={vi.fn()}
      />
    );
    expect(within(source).queryByRole("group")).not.toBeInTheDocument();
  });

  it("preserves Search and Level while navigating between preset sources without legacy filters", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(emptyLogs));
    vi.stubGlobal("fetch", fetchMock);
    const props = {
      presets: statusFixture().presets,
      sources,
      selectedLevel: "error",
      onFiltersChange: vi.fn(),
    };
    const { rerender } = render(
      <LogsPanel {...props} selectedSource="preset:backend" />
    );
    const user = userEvent.setup();
    await user.type(
      screen.getByRole("searchbox", { name: "Search logs" }),
      "CID-42"
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const query = new URL(String(input), "http://localhost").searchParams;
          return (
            query.get("source") === "preset:backend" &&
            query.get("search") === "CID-42" &&
            query.get("level") === "error"
          );
        })
      ).toBe(true)
    );
    rerender(<LogsPanel {...props} selectedSource="preset:personal-core" />);
    expect(screen.getByRole("searchbox", { name: "Search logs" })).toHaveValue(
      "CID-42"
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const query = new URL(String(input), "http://localhost").searchParams;
          return (
            query.get("source") === "preset:personal-core" &&
            query.get("search") === "CID-42" &&
            query.get("level") === "error" &&
            !query.has("service") &&
            !query.has("cid") &&
            !query.has("cursors")
          );
        })
      ).toBe(true)
    );
  });

  it("keeps unstructured log messages without an unknown severity badge", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(440);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          entries: [
            {
              ...entry("plain", "agreement"),
              level: "unknown",
              message: "Starting local process",
            },
            {
              ...entry("error", "agreement"),
              level: "error",
              message: "Connection failed",
            },
          ],
          cursors: { agreement: "2" },
          resetSources: [],
        })
      )
    );
    render(
      <LogsPanel
        presets={[]}
        sources={sources}
        selectedSource=""
        selectedLevel=""
        onFiltersChange={vi.fn()}
      />
    );
    const logs = await screen.findByRole("list", {
      name: "Aggregate log entries",
    });
    expect(
      await within(logs).findByText("Starting local process")
    ).toBeVisible();
    expect(within(logs).queryByText("unknown")).not.toBeInTheDocument();
    expect(within(logs).getByText("error", { exact: true })).toBeVisible();
  });
  it("requests a known source outside the current 500 lines and keeps its option when its result is empty", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const source = new URL(
          String(input),
          "http://localhost"
        ).searchParams.get("source");
        const entries =
          source === "consumer"
            ? [entry("501", "consumer")]
            : source === "infra:postgres"
              ? []
              : Array.from({ length: 500 }, (_, index) =>
                  entry(String(index + 1), "agreement")
                );
        return Response.json({
          entries,
          cursors: { agreement: "500", consumer: "501" },
          resetSources: [],
        });
      });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    const props = { presets: [], sources, selectedLevel: "", onFiltersChange };
    const { rerender } = render(<LogsPanel {...props} selectedSource="" />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("500 lines")
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Source" }),
      "consumer"
    );
    expect(onFiltersChange).toHaveBeenLastCalledWith("consumer", "");
    rerender(<LogsPanel {...props} selectedSource="consumer" />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("1 lines")
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Source" }),
      "infra:postgres"
    );
    expect(onFiltersChange).toHaveBeenLastCalledWith("infra:postgres", "");
    rerender(<LogsPanel {...props} selectedSource="infra:postgres" />);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("0 lines")
    );
    expect(screen.getByRole("combobox", { name: "Source" })).toHaveValue(
      "infra:postgres"
    );
    expect(
      screen.getByRole("option", { name: "Consumer" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Postgres" })
    ).toBeInTheDocument();
  });
});
