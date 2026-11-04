import type {
  DashboardAction,
  Package,
  Preset,
} from "pagopa-interop-dev-dashboard-contracts";

import { useState } from "react";

import type { PackageFilter } from "../router/packageFilter";
import type { WatchChange } from "./useDashboardActions";

export function usePackageSelection({
  packages,
  seedPackages,
  presets,
  filter,
  busy,
  watchChanges = {},
  onAction,
}: {
  packages: Package[];
  seedPackages: string[];
  presets: Preset[];
  filter: PackageFilter;
  busy: Record<string, string>;
  watchChanges?: Record<string, WatchChange>;
  onAction: (
    action: DashboardAction,
    key: string | string[]
  ) => Promise<boolean>;
}) {
  const filterValue =
    filter.kind === "preset"
      ? `preset:${filter.id}`
      : filter.kind === "all"
        ? ""
        : filter.kind;
  const [search, setSearch] = useState("");
  const [watchOrigins, setWatchOrigins] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<{
    scope: string;
    names: string[];
  }>({ scope: filterValue, names: [] });
  // A URL group change resets selection before rendering; polling preserves the same scope.
  if (selection.scope !== filterValue)
    setSelection({ scope: filterValue, names: [] });
  const selected = selection.scope === filterValue ? selection.names : [];
  const preset =
    filter.kind === "preset"
      ? presets.find((item) => item.id === filter.id)
      : undefined;
  const missingPreset = filter.kind === "preset" && !preset;
  const members =
    filter.kind === "seed"
      ? seedPackages
      : preset?.packages.map((member) => member.name);
  const visible = [...packages]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(
      (item) =>
        (filter.kind === "jobs"
          ? item.kind === "job"
          : filter.kind === "all" || members?.includes(item.name)) &&
        item.name.toLowerCase().includes(search.toLowerCase())
    );
  const selectedPackages = visible.filter((item) =>
    selected.includes(item.name)
  );
  function watchPending(item: Package) {
    return Boolean(busy[`package-watch:${item.name}`]);
  }
  function processPending(item: Package) {
    return (
      Boolean(busy[`package:${item.name}`]) ||
      (!watchPending(item) &&
        (item.state === "building" || item.state === "starting"))
    );
  }
  function pending(item: Package) {
    return watchPending(item) || processPending(item);
  }
  function active(item: Package) {
    return watchPending(item)
      ? (watchOrigins[item.name] ??
          (item.state === "running" || item.state === "starting"))
      : item.state === "running";
  }
  function watchValue(item: Package) {
    return watchChanges[item.name]?.watch ?? item.watch;
  }
  function watchStatus(item: Package) {
    const change = watchChanges[item.name];
    if (!change) return undefined;
    if (change.state === "pending") return "Queued";
    return active(item) ? "Restarting" : "Updating watch";
  }
  // A Watch change may restart a running child. Capture the local intent so its
  // Start/Stop label and icon stay stable until the Watch operation completes.
  function rememberWatchOrigins(names: string[]) {
    setWatchOrigins((previous) => ({
      ...previous,
      ...Object.fromEntries(
        packages
          .filter((item) => names.includes(item.name))
          .map((item) => [item.name, item.state === "running"])
      ),
    }));
  }
  function runWatch(name: string, watch: boolean) {
    rememberWatchOrigins([name]);
    void onAction(
      { type: "package.watch", name, watch },
      `package-watch:${name}`
    );
  }
  const idleSelection = selectedPackages.filter((item) => !pending(item));
  const startSelection = idleSelection.filter(
    (item) =>
      item.state === "stopped" ||
      item.state === "failed" ||
      (item.kind === "job" && item.state === "completed")
  );
  const startNames = startSelection.map((item) => item.name);
  const startJobsOnly =
    startSelection.length > 0 &&
    startSelection.every((item) => item.kind === "job");
  const stopNames = idleSelection
    .filter((item) => item.state === "running")
    .map((item) => item.name);
  const watchOnNames = idleSelection
    .filter((item) => !item.watch)
    .map((item) => item.name);
  const watchOffNames = idleSelection
    .filter((item) => item.watch)
    .map((item) => item.name);
  function clearSelection() {
    setSelection({ scope: filterValue, names: [] });
  }
  function changeSearch(value: string) {
    setSearch(value);
    clearSelection();
  }
  function selectAll(checked: boolean) {
    setSelection({
      scope: filterValue,
      names: checked ? visible.map((item) => item.name) : [],
    });
  }
  function selectPackage(name: string, checked: boolean) {
    setSelection({
      scope: filterValue,
      names: checked
        ? [...selected, name]
        : selected.filter((item) => item !== name),
    });
  }
  function runBulk(action: DashboardAction, names: string[]) {
    if (action.type === "packages.watch") rememberWatchOrigins(names);
    if (names.length)
      void onAction(
        action,
        names.map((name) =>
          action.type === "packages.watch"
            ? `package-watch:${name}`
            : `package:${name}`
        )
      );
  }
  return {
    search,
    changeSearch,
    filterValue,
    missingPreset,
    visible,
    selected,
    selectedCount: selectedPackages.length,
    allSelected:
      visible.length > 0 && selectedPackages.length === visible.length,
    startNames,
    startJobsOnly,
    stopNames,
    watchOnNames,
    watchOffNames,
    pending,
    processPending,
    watchPending,
    watchValue,
    watchStatus,
    active,
    runWatch,
    clearSelection,
    selectAll,
    selectPackage,
    runBulk,
  };
}
