import type { Package } from "pagopa-interop-dev-dashboard-contracts";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { WatchChange } from "../../src/hooks/useDashboardActions";
import type { PackageFilter } from "../../src/router/packageFilter";

import { PackageCatalogue } from "../../src/components/PackageCatalogue";
import { seedPackagesFixture, statusFixture } from "../fixtures";

const packageName = "pagopa-interop-backend-for-frontend";

function renderCatalogue(
  busy: Record<string, string> = {},
  packages = statusFixture().packages,
  initialFilter: PackageFilter = { kind: "all" },
  presets = statusFixture().presets,
  seedPackages = statusFixture().seedPackages
) {
  const onAction = vi.fn().mockResolvedValue(true);
  const onLogs = vi.fn();
  function Catalogue() {
    const [filter, setFilter] = useState(initialFilter);
    return (
      <PackageCatalogue
        packages={packages}
        presets={presets}
        seedPackages={seedPackages}
        filter={filter}
        onFilterChange={setFilter}
        busy={busy}
        onAction={onAction}
        onLogs={onLogs}
      />
    );
  }
  render(<Catalogue />);
  return { packages, onAction, onLogs };
}

describe("package catalogue", () => {
  it.each([
    { state: "stopped", label: "Run" },
    { state: "completed", label: "Run" },
    { state: "failed", label: "Run" },
    { state: "running", label: "Stop" },
  ] satisfies Array<{ state: Package["state"]; label: "Run" | "Stop" }>)(
    "offers $label for a $state job using the existing package action",
    async ({ state, label }) => {
      const user = userEvent.setup();
      const job: Package = {
        ...statusFixture().packages[0],
        name: "notification-job",
        kind: "job",
        state,
      };
      const { onAction } = renderCatalogue({}, [job]);
      const row = within(screen.getByRole("row", { name: /notification-job/ }));
      const control = row.getByRole("button", { name: `${label} ${job.name}` });
      expect(control).toBeEnabled();
      expect(control).toHaveTextContent(label);
      expect(
        row.getByRole("checkbox", { name: `Watch ${job.name}` })
      ).toBeEnabled();
      if (state === "completed") {
        expect(row.getByText("Completed")).toHaveClass("bg-success-subtle");
      }
      await user.click(control);
      expect(onAction).toHaveBeenCalledExactlyOnceWith(
        {
          type: label === "Stop" ? "package.stop" : "package.start",
          name: job.name,
        },
        `package:${job.name}`
      );
    }
  );

  it("reruns completed jobs in bulk, skips busy and running targets, and keeps Start for mixed eligible packages", async () => {
    const user = userEvent.setup();
    const fixture = statusFixture();
    const jobs: Package[] = [
      {
        ...fixture.packages[0],
        name: "completed-job",
        kind: "job",
        state: "completed",
      },
      {
        ...fixture.packages[0],
        name: "failed-job",
        kind: "job",
        state: "failed",
      },
      { ...fixture.packages[0], name: "busy-job", kind: "job" },
      {
        ...fixture.packages[0],
        name: "running-job",
        kind: "job",
        state: "running",
      },
    ];
    const { onAction } = renderCatalogue({ "package:busy-job": "operation" }, [
      ...fixture.packages,
      ...jobs,
    ]);
    for (const item of [...jobs, fixture.packages[1]])
      await user.click(
        screen.getByRole("checkbox", { name: `Select ${item.name}` })
      );
    const run = screen.getByRole("button", { name: "Run selected jobs" });
    expect(run).toHaveTextContent("Run");
    await user.click(run);
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      { type: "packages.start", names: ["completed-job", "failed-job"] },
      ["package:completed-job", "package:failed-job"]
    );
    await user.click(
      screen.getByRole("checkbox", { name: `Select ${packageName}` })
    );
    expect(
      screen.queryByRole("button", { name: "Run selected jobs" })
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Start selected packages" })
    );
    expect(onAction).toHaveBeenLastCalledWith(
      {
        type: "packages.start",
        names: ["completed-job", "failed-job", packageName],
      },
      ["package:completed-job", "package:failed-job", `package:${packageName}`]
    );
  });

  it("filters Jobs independently of a preset named jobs and intersects search with selection", async () => {
    const user = userEvent.setup();
    const fixture = statusFixture();
    const jobs: Package[] = [
      {
        ...fixture.packages[0],
        name: "completed-job",
        kind: "job",
        state: "completed",
      },
      {
        ...fixture.packages[0],
        name: "running-job",
        kind: "job",
        state: "running",
      },
    ];
    const { onAction } = renderCatalogue(
      {},
      [...fixture.packages, ...jobs],
      { kind: "all" },
      [
        ...fixture.presets,
        { ...fixture.presets[0], id: "jobs", name: "My job preset" },
      ]
    );
    const group = screen.getByRole("combobox", { name: "Group" });
    expect(screen.getByRole("option", { name: "Jobs" })).toHaveValue("jobs");
    expect(screen.getByRole("option", { name: "My job preset" })).toHaveValue(
      "preset:jobs"
    );
    await user.selectOptions(group, "jobs");
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(
      screen.queryByRole("row", { name: new RegExp(packageName) })
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", { name: "Select all visible packages" })
    );
    expect(screen.getByText("2 selected")).toBeVisible();
    const search = screen.getByRole("searchbox", { name: "Find a package" });
    await user.type(search, "COMPLETED");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("0 selected")).toBeVisible();
    await user.click(
      screen.getByRole("checkbox", { name: "Select all visible packages" })
    );
    await user.click(screen.getByRole("button", { name: "Run selected jobs" }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      { type: "packages.start", names: ["completed-job"] },
      ["package:completed-job"]
    );
    await user.selectOptions(group, "preset:jobs");
    expect(group).toHaveValue("preset:jobs");
    expect(screen.getByText("0 selected")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(1);
    await user.clear(search);
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(
      screen.getByRole("row", { name: new RegExp(packageName) })
    ).toBeVisible();
    await user.selectOptions(group, "seed");
    expect(screen.getAllByRole("row")).toHaveLength(3);
    await user.selectOptions(group, "preset:personal-core");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(
      screen.getByRole("row", { name: new RegExp(fixture.packages[1].name) })
    ).toBeVisible();
  });

  it.each([
    { watch: true, state: "running" },
    { watch: false, state: "running" },
    { watch: true, state: "starting" },
    { watch: false, state: "starting" },
  ] satisfies Array<{ watch: boolean; state: "running" | "starting" }>)(
    "shows requested watch=$watch with row-level progress for a $state package while the server still reports the old preference",
    ({ watch, state }) => {
      const fixture = statusFixture();
      const restarting = { ...fixture.packages[1], state, watch: !watch };
      const queued = { ...fixture.packages[0], watch: !watch };
      const props = {
        packages: [restarting, queued],
        seedPackages: fixture.seedPackages,
        presets: fixture.presets,
        filter: { kind: "all" } satisfies PackageFilter,
        onFilterChange: vi.fn(),
        onAction: vi.fn(),
        onLogs: vi.fn(),
        busy: {
          [`package-watch:${restarting.name}`]: "watch-operation",
          [`package-watch:${queued.name}`]: "watch-operation",
        },
        watchChanges: {
          [restarting.name]: { watch, state: "running" },
          [queued.name]: { watch, state: "pending" },
        } satisfies Record<string, WatchChange>,
      };
      const { rerender } = render(<PackageCatalogue {...props} />);
      for (const item of props.packages) {
        const row = within(
          screen.getByRole("row", { name: new RegExp(item.name) })
        );
        const cells = row.getAllByRole("cell");
        const status = item.name === restarting.name ? "Restarting" : "Queued";
        expect(within(cells[3]).getByRole("status")).toHaveTextContent(status);
        expect(cells[4].textContent).toBe("");
        const checkbox = screen.getByRole("checkbox", {
          name: `Watch ${item.name}`,
        });
        expect(checkbox).toHaveAttribute("aria-checked", String(watch));
        expect(checkbox).toBeDisabled();
        expect(checkbox).toHaveAttribute("aria-busy", "true");
        expect(checkbox).toHaveAccessibleDescription(status);
      }
      expect(
        within(
          screen.getByRole("row", { name: new RegExp(restarting.name) })
        ).getByRole("status")
      ).toHaveTextContent("Restarting");
      expect(
        screen.getByRole("button", { name: `Stop ${restarting.name}` })
      ).toBeDisabled();
      expect(
        within(
          screen.getByRole("row", { name: new RegExp(queued.name) })
        ).getByRole("status")
      ).toHaveTextContent("Queued");
      rerender(
        <PackageCatalogue
          {...props}
          packages={props.packages.map((item) => ({
            ...item,
            state: "failed",
          }))}
          busy={{}}
          watchChanges={{}}
        />
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      for (const item of props.packages) {
        const row = within(
          screen.getByRole("row", { name: new RegExp(item.name) })
        );
        expect(row.getAllByRole("cell")[3]).toHaveTextContent("failed");
        const checkbox = screen.getByRole("checkbox", {
          name: `Watch ${item.name}`,
        });
        expect(checkbox).toHaveAttribute("aria-checked", String(!watch));
        expect(checkbox).toBeEnabled();
      }
    }
  );

  it("describes a watch update on a stopped package without claiming a restart", () => {
    const fixture = statusFixture();
    const item = fixture.packages[0];
    render(
      <PackageCatalogue
        packages={[item]}
        seedPackages={fixture.seedPackages}
        presets={fixture.presets}
        filter={{ kind: "all" }}
        onFilterChange={vi.fn()}
        onAction={vi.fn()}
        onLogs={vi.fn()}
        busy={{ [`package-watch:${item.name}`]: "watch-operation" }}
        watchChanges={{ [item.name]: { watch: true, state: "running" } }}
      />
    );
    const cells = within(
      screen.getByRole("row", { name: new RegExp(item.name) })
    ).getAllByRole("cell");
    expect(within(cells[3]).getByRole("status")).toHaveTextContent(
      "Updating watch"
    );
    expect(cells[4].textContent).toBe("");
    expect(
      screen.getByRole("checkbox", { name: `Watch ${item.name}` })
    ).toBeChecked();
  });

  it.each(["request", "watch-operation"])(
    "keeps Start/Stop stable while Watch is pending at %s and blocks conflicting selections",
    async (operationId) => {
      const user = userEvent.setup();
      const { onAction, onLogs } = renderCatalogue({
        [`package-watch:${packageName}`]: operationId,
      });
      const row = screen.getByRole("row", { name: new RegExp(packageName) });
      const start = within(row).getByRole("button", {
        name: `Start ${packageName}`,
      });
      expect(start).toBeDisabled();
      expect(start).toHaveAttribute("aria-busy", "false");
      expect(within(start).queryByRole("status")).not.toBeInTheDocument();
      expect(start).toHaveTextContent("Start");
      const watch = within(row).getByRole("checkbox", {
        name: `Watch ${packageName}`,
      });
      expect(watch).toBeDisabled();
      expect(watch).toHaveAttribute("aria-busy", "true");
      await user.click(
        within(row).getByRole("checkbox", { name: `Select ${packageName}` })
      );
      for (const name of [
        "Start selected packages",
        "Stop selected packages",
        "Enable watch for selected packages",
        "Disable watch for selected packages",
      ]) {
        expect(screen.getByRole("button", { name })).toBeDisabled();
      }
      await user.click(start);
      await user.click(watch);
      expect(onAction).not.toHaveBeenCalled();
      await user.click(
        within(row).getByRole("button", { name: `Logs for ${packageName}` })
      );
      expect(onLogs).toHaveBeenCalledExactlyOnceWith(packageName);
    }
  );
  it.each(["single", "bulk"])(
    "retains the running package Stop control while an accepted %s Watch action restarts it",
    async (scope) => {
      const user = userEvent.setup();
      const fixture = statusFixture();
      const item = fixture.packages[1];
      const onAction = vi.fn().mockResolvedValue(true);
      const props = {
        packages: fixture.packages,
        seedPackages: fixture.seedPackages,
        presets: fixture.presets,
        filter: { kind: "all" } satisfies PackageFilter,
        onFilterChange: vi.fn(),
        busy: {},
        onAction,
        onLogs: vi.fn(),
      };
      const { rerender } = render(<PackageCatalogue {...props} />);
      if (scope === "single") {
        await user.click(
          screen.getByRole("checkbox", { name: `Watch ${item.name}` })
        );
        expect(onAction).toHaveBeenCalledExactlyOnceWith(
          { type: "package.watch", name: item.name, watch: false },
          `package-watch:${item.name}`
        );
      } else {
        await user.click(
          screen.getByRole("checkbox", { name: `Select ${item.name}` })
        );
        await user.click(
          screen.getByRole("button", {
            name: "Disable watch for selected packages",
          })
        );
        expect(onAction).toHaveBeenCalledExactlyOnceWith(
          { type: "packages.watch", names: [item.name], watch: false },
          [`package-watch:${item.name}`]
        );
      }
      rerender(
        <PackageCatalogue
          {...props}
          busy={{ [`package-watch:${item.name}`]: "watch-operation" }}
          packages={fixture.packages.map((entry) =>
            entry.name === item.name
              ? { ...entry, state: "starting", watch: false }
              : entry
          )}
        />
      );
      const stop = screen.getByRole("button", { name: `Stop ${item.name}` });
      expect(stop).toBeDisabled();
      expect(stop).toHaveAttribute("aria-busy", "false");
      expect(within(stop).queryByRole("status")).not.toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: `Watch ${item.name}` })
      ).toHaveAttribute("aria-busy", "true");
      rerender(
        <PackageCatalogue
          {...props}
          packages={fixture.packages.map((entry) =>
            entry.name === item.name
              ? { ...entry, state: "running", watch: false }
              : entry
          )}
        />
      );
      expect(
        screen.getByRole("button", { name: `Stop ${item.name}` })
      ).toBeEnabled();
    }
  );
  it("shows the manifest name, port, state and watch with only package controls", () => {
    const { packages } = renderCatalogue();
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent)
    ).toEqual(["Select", "Name", "Port", "State", "Watch", "Actions"]);
    const row = screen.getByRole("row", { name: new RegExp(packageName) });
    expect(
      within(row)
        .getAllByRole("cell")
        .slice(1, 4)
        .map((cell) => cell.textContent)
    ).toEqual([packageName, "3600", "stopped"]);
    expect(
      within(row).getByRole("checkbox", { name: `Watch ${packageName}` })
    ).not.toBeChecked();
    expect(
      within(row)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Start", "Logs"]);
    expect(screen.queryByText(packages[0].label)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Kind")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/prerequisites|Needs configuration|PID/)
    ).not.toBeInTheDocument();
  });

  it("starts only the selected package and forwards watch, stop and logs to their own handlers", async () => {
    const user = userEvent.setup();
    const { packages, onAction, onLogs } = renderCatalogue();
    await user.click(
      screen.getByRole("button", { name: `Start ${packageName}` })
    );
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      { type: "package.start", name: packageName },
      `package:${packageName}`
    );
    await user.click(
      screen.getByRole("checkbox", { name: `Watch ${packageName}` })
    );
    expect(onAction).toHaveBeenLastCalledWith(
      { type: "package.watch", name: packageName, watch: true },
      `package-watch:${packageName}`
    );
    await user.click(
      screen.getByRole("button", { name: `Stop ${packages[1].name}` })
    );
    expect(onAction).toHaveBeenLastCalledWith(
      { type: "package.stop", name: packages[1].name },
      `package:${packages[1].name}`
    );
    await user.click(
      screen.getByRole("button", { name: `Logs for ${packageName}` })
    );
    expect(onLogs).toHaveBeenCalledExactlyOnceWith(packageName);
    expect(onAction).toHaveBeenCalledTimes(3);
  });

  it("allows every idle package to start and change watch mode", async () => {
    const user = userEvent.setup();
    const { packages, onAction } = renderCatalogue();
    const item = packages[2];
    const row = screen.getByRole("row", { name: new RegExp(item.name) });
    expect(
      within(row).getByRole("button", { name: `Start ${item.name}` })
    ).toBeEnabled();
    expect(
      within(row).getByRole("checkbox", { name: `Watch ${item.name}` })
    ).toBeEnabled();
    expect(within(row).getAllByRole("cell")[2]).toHaveTextContent("—");
    await user.click(
      within(row).getByRole("button", { name: `Start ${item.name}` })
    );
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      { type: "package.start", name: item.name },
      `package:${item.name}`
    );
  });

  it("disables only the busy package controls while keeping its logs available", async () => {
    const user = userEvent.setup();
    const { packages, onAction, onLogs } = renderCatalogue({
      [`package:${packageName}`]: "operation",
    });
    const start = screen.getByRole("button", { name: `Start ${packageName}` });
    expect(start).toBeDisabled();
    expect(start).toHaveAttribute("aria-busy", "true");
    expect(within(start).getByRole("status")).toHaveTextContent(
      "Package operation in progress"
    );
    expect(start).toHaveTextContent("Start");
    expect(screen.queryByText("Working…")).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: `Watch ${packageName}` })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: `Stop ${packages[1].name}` })
    ).toBeEnabled();
    await user.click(start);
    expect(onAction).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: `Logs for ${packageName}` })
    );
    expect(onLogs).toHaveBeenCalledExactlyOnceWith(packageName);
  });

  it("finds a package by its manifest name and shows an empty result for no match", async () => {
    const user = userEvent.setup();
    renderCatalogue();
    const search = screen.getByRole("searchbox", { name: "Find a package" });
    await user.type(search, "BACKEND-FOR-FRONTEND");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(
      screen.getByRole("row", { name: new RegExp(packageName) })
    ).toBeVisible();
    await user.clear(search);
    await user.type(search, "does-not-exist");
    expect(screen.getAllByRole("row")).toHaveLength(1);
    expect(screen.getByText(/No packages match/)).toBeVisible();
  });

  it("selects only visible rows, exposes mixed selection and clears selection when search changes", async () => {
    const user = userEvent.setup();
    const { packages, onAction } = renderCatalogue();
    const selectAll = screen.getByRole("checkbox", {
      name: "Select all visible packages",
    });
    expect(
      screen.getByRole("button", { name: "Start selected packages" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Stop selected packages" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Enable watch for selected packages" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Disable watch for selected packages",
      })
    ).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", { name: `Select ${packageName}` })
    );
    expect(selectAll).toBePartiallyChecked();
    expect(selectAll).toHaveAttribute("aria-checked", "mixed");
    expect(screen.getByText("1 selected")).toBeVisible();
    await user.click(selectAll);
    expect(selectAll).toBeChecked();
    for (const item of packages) {
      expect(
        screen.getByRole("checkbox", { name: `Select ${item.name}` })
      ).toBeChecked();
    }
    await user.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(selectAll).not.toBeChecked();
    expect(screen.getByText("0 selected")).toBeVisible();
    await user.click(
      screen.getByRole("checkbox", { name: `Select ${packageName}` })
    );
    await user.type(
      screen.getByRole("searchbox", { name: "Find a package" }),
      "tenant"
    );
    expect(screen.getByText("0 selected")).toBeVisible();
    await user.click(selectAll);
    expect(screen.getByText("1 selected")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Start selected packages" })
    );
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      { type: "packages.start", names: [packages[2].name] },
      [`package:${packages[2].name}`]
    );
  });

  it("submits one request per bulk action with only selected eligible package names and busy keys", async () => {
    const user = userEvent.setup();
    const fixture = statusFixture();
    const packages: typeof fixture.packages = [
      ...fixture.packages.slice(0, 2),
      { ...fixture.packages[2], state: "failed" },
      { ...fixture.packages[0], name: "busy-package" },
      { ...fixture.packages[0], name: "unselected-package" },
    ];
    const { onAction } = renderCatalogue(
      { "package:busy-package": "operation" },
      packages
    );
    for (const item of packages.slice(0, 4)) {
      await user.click(
        screen.getByRole("checkbox", { name: `Select ${item.name}` })
      );
    }
    await user.click(
      screen.getByRole("button", { name: "Start selected packages" })
    );
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      { type: "packages.start", names: [packages[0].name, packages[2].name] },
      [`package:${packages[0].name}`, `package:${packages[2].name}`]
    );
    await user.click(
      screen.getByRole("button", { name: "Stop selected packages" })
    );
    expect(onAction).toHaveBeenLastCalledWith(
      { type: "packages.stop", names: [packages[1].name] },
      [`package:${packages[1].name}`]
    );
    await user.click(
      screen.getByRole("button", { name: "Enable watch for selected packages" })
    );
    expect(onAction).toHaveBeenLastCalledWith(
      {
        type: "packages.watch",
        names: [packages[0].name, packages[2].name],
        watch: true,
      },
      [`package-watch:${packages[0].name}`, `package-watch:${packages[2].name}`]
    );
    await user.click(
      screen.getByRole("button", {
        name: "Disable watch for selected packages",
      })
    );
    expect(onAction).toHaveBeenLastCalledWith(
      { type: "packages.watch", names: [packages[1].name], watch: false },
      [`package-watch:${packages[1].name}`]
    );
    expect(onAction).toHaveBeenCalledTimes(4);
  });

  it("groups preset choices and intersects membership with search and bulk selection", async () => {
    const user = userEvent.setup();
    const { packages, onAction } = renderCatalogue();
    const preset = screen.getByRole("combobox", { name: "Group" });
    expect(
      within(screen.getByRole("group", { name: "Shared presets" })).getByRole(
        "option",
        { name: "Backend core" }
      )
    ).toHaveValue("preset:backend");
    expect(
      within(screen.getByRole("group", { name: "Local presets" })).getByRole(
        "option",
        { name: "My core" }
      )
    ).toHaveValue("preset:personal-core");
    await user.selectOptions(preset, "preset:backend");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(
      screen.queryByRole("row", { name: new RegExp(packages[1].name) })
    ).not.toBeInTheDocument();
    const search = screen.getByRole("searchbox", { name: "Find a package" });
    await user.type(search, "tenant");
    expect(screen.getAllByRole("row")).toHaveLength(1);
    await user.clear(search);
    await user.click(
      screen.getByRole("checkbox", { name: "Select all visible packages" })
    );
    await user.click(
      screen.getByRole("button", { name: "Start selected packages" })
    );
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      { type: "packages.start", names: [packageName] },
      [`package:${packageName}`]
    );
    await user.selectOptions(preset, "preset:personal-core");
    expect(screen.getByText("0 selected")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Start selected packages" })
    ).toBeDisabled();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    await user.click(
      screen.getByRole("checkbox", { name: "Select all visible packages" })
    );
    await user.click(
      screen.getByRole("button", { name: "Stop selected packages" })
    );
    expect(onAction).toHaveBeenLastCalledWith(
      { type: "packages.stop", names: [packages[1].name] },
      [`package:${packages[1].name}`]
    );
    await user.click(
      screen.getByRole("button", {
        name: "Disable watch for selected packages",
      })
    );
    expect(onAction).toHaveBeenLastCalledWith(
      { type: "packages.watch", names: [packages[1].name], watch: false },
      [`package-watch:${packages[1].name}`]
    );
  });

  it("keeps a missing preset empty until All packages is explicitly selected", async () => {
    const user = userEvent.setup();
    const { packages, onAction } = renderCatalogue(
      {},
      statusFixture().packages,
      { kind: "preset", id: "removed" }
    );
    const preset = screen.getByRole("combobox", { name: "Group" });
    expect(preset).toHaveValue("preset:removed");
    expect(
      screen.getByRole("option", { name: "Unavailable preset" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(1);
    expect(
      screen.getByRole("checkbox", { name: "Select all visible packages" })
    ).toBeDisabled();
    expect(
      screen.getByText("This preset is no longer available.")
    ).toBeVisible();
    await user.selectOptions(preset, "");
    expect(screen.getAllByRole("row")).toHaveLength(packages.length + 1);
    expect(screen.getByText("0 selected")).toBeVisible();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("omits the local preset option group when no local preset exists", () => {
    const fixture = statusFixture();
    renderCatalogue(
      {},
      fixture.packages,
      { kind: "all" },
      fixture.presets.filter((preset) => preset.source === "shared")
    );
    expect(
      screen.getByRole("group", { name: "Shared presets" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Local presets" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Backend core" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "My core" })
    ).not.toBeInTheDocument();
  });

  it("shows every seed member across states and intersects the group with search and bulk actions", async () => {
    const fixture = seedPackagesFixture();
    const user = userEvent.setup();
    const { onAction, onLogs } = renderCatalogue(
      {},
      fixture.packages,
      { kind: "seed" },
      fixture.presets,
      fixture.seedPackages
    );
    const group = screen.getByRole("combobox", { name: "Group" });
    expect(group).toHaveValue("seed");
    expect(screen.getByRole("option", { name: "Seed packages" })).toHaveValue(
      "seed"
    );
    expect(screen.getAllByRole("row")).toHaveLength(5);
    for (const name of fixture.seedPackages)
      expect(screen.getByRole("row", { name: new RegExp(name) })).toBeVisible();
    expect(
      screen.queryByRole("row", { name: new RegExp(packageName) })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Start ${fixture.seedPackages[2]}` })
    ).toHaveAttribute("aria-busy", "true");
    await user.click(
      screen.getByRole("button", {
        name: `Logs for ${fixture.seedPackages[2]}`,
      })
    );
    expect(onLogs).toHaveBeenCalledExactlyOnceWith(fixture.seedPackages[2]);
    await user.click(
      screen.getByRole("checkbox", { name: "Select all visible packages" })
    );
    expect(screen.getByText("4 selected")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Start selected packages" })
    );
    const startNames = [
      fixture.seedPackages[1],
      fixture.seedPackages[3],
    ].sort();
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      { type: "packages.start", names: startNames },
      startNames.map((name) => `package:${name}`)
    );
    await user.click(
      screen.getByRole("button", { name: "Stop selected packages" })
    );
    expect(onAction).toHaveBeenLastCalledWith(
      { type: "packages.stop", names: [fixture.seedPackages[0]] },
      [`package:${fixture.seedPackages[0]}`]
    );
    await user.type(
      screen.getByRole("searchbox", { name: "Find a package" }),
      "tenant"
    );
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("0 selected")).toBeVisible();
    await user.click(
      screen.getByRole("checkbox", { name: "Select all visible packages" })
    );
    await user.click(
      screen.getByRole("button", { name: "Start selected packages" })
    );
    expect(onAction).toHaveBeenLastCalledWith(
      { type: "packages.start", names: [fixture.seedPackages[1]] },
      [`package:${fixture.seedPackages[1]}`]
    );
    await user.selectOptions(group, "preset:backend");
    expect(screen.getByText("0 selected")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(1);
    await user.clear(screen.getByRole("searchbox", { name: "Find a package" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    await user.selectOptions(group, "");
    expect(screen.getAllByRole("row")).toHaveLength(6);
  });

  it("retains selection through equivalent filter objects and status polls, then distinguishes a preset named seed", async () => {
    const fixture = seedPackagesFixture();
    const onAction = vi.fn();
    const onFilterChange = vi.fn();
    const onLogs = vi.fn();
    const props = {
      packages: fixture.packages,
      seedPackages: fixture.seedPackages,
      presets: [{ ...fixture.presets[0], id: "seed", name: "Seed preset" }],
      busy: {},
      onAction,
      onFilterChange,
      onLogs,
    };
    const user = userEvent.setup();
    const view = render(
      <PackageCatalogue {...props} filter={{ kind: "seed" }} />
    );
    const selectedName = fixture.seedPackages[0];
    await user.click(
      screen.getByRole("checkbox", { name: `Select ${selectedName}` })
    );
    expect(screen.getByText("1 selected")).toBeVisible();
    view.rerender(
      <PackageCatalogue
        {...props}
        filter={{ kind: "seed" }}
        packages={fixture.packages.map((item) => ({
          ...item,
          state: "running",
        }))}
        seedPackages={[...fixture.seedPackages]}
        presets={[...props.presets]}
      />
    );
    expect(
      screen.getByRole("checkbox", { name: `Select ${selectedName}` })
    ).toBeChecked();
    expect(screen.getByText("1 selected")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(5);
    const group = screen.getByRole("combobox", { name: "Group" });
    expect(screen.getByRole("option", { name: "Seed preset" })).toHaveValue(
      "preset:seed"
    );
    await user.selectOptions(group, "preset:seed");
    expect(onFilterChange).toHaveBeenCalledExactlyOnceWith({
      kind: "preset",
      id: "seed",
    });
    view.rerender(
      <PackageCatalogue {...props} filter={{ kind: "preset", id: "seed" }} />
    );
    expect(group).toHaveValue("preset:seed");
    expect(screen.getByText("0 selected")).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(
      screen.getByRole("row", { name: new RegExp(packageName) })
    ).toBeVisible();
  });
});
