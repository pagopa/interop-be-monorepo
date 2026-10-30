import type { LogSource, Preset } from "pagopa-interop-dev-dashboard-contracts";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useIncrementalLogs } from "./useIncrementalLogs";

const groupByPackageStorageKey = "pdnd-dev-dashboard.logs.groupByPackage";

function useDebouncedValue(value: string) {
  const [debounced, setDebounced] = useState(value);
  // Coalesce typing into one request and cancel the pending timer when input changes or unmounts.
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), 250);
    return () => window.clearTimeout(timeout);
  }, [value]);
  return debounced;
}

export function useLogFilters({
  sources,
  presets,
  selectedSource,
  selectedLevel,
  onFiltersChange,
}: {
  sources: LogSource[];
  presets: Preset[];
  selectedSource: string;
  selectedLevel: string;
  onFiltersChange: (source: string, level: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [groupByPackage, setGroupByPackage] = useState(() => {
    try {
      return window.localStorage.getItem(groupByPackageStorageKey) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(
        groupByPackageStorageKey,
        String(groupByPackage)
      );
    } catch {
      // Grouping remains available when browser storage is blocked or full.
    }
  }, [groupByPackage]);
  const debouncedSearch = useDebouncedValue(search);
  const logs = useIncrementalLogs({
    source: selectedSource,
    level: selectedLevel,
    search: debouncedSearch,
  });
  const isPreviousData = logs.isPreviousData || search !== debouncedSearch;
  const sourceGroups = [
    {
      label: "Shared presets",
      sources: presets
        .filter((preset) => preset.source === "shared")
        .map((preset) => ({ id: `preset:${preset.id}`, label: preset.name })),
    },
    {
      label: "Local presets",
      sources: presets
        .filter((preset) => preset.source === "personal")
        .map((preset) => ({ id: `preset:${preset.id}`, label: preset.name })),
    },
    {
      label: "Packages",
      sources: sources.filter((source) => source.kind === "backend"),
    },
    {
      label: "Infrastructure",
      sources: sources.filter((source) => source.kind === "infrastructure"),
    },
    {
      label: "Runtime",
      sources: sources.filter(
        (source) =>
          source.kind !== "backend" && source.kind !== "infrastructure"
      ),
    },
  ].filter((group) => group.sources.length > 0);
  function changeSource(value: string) {
    onFiltersChange(value, selectedLevel);
  }
  function changeLevel(value: string) {
    onFiltersChange(selectedSource, value);
  }
  function clearFilters() {
    onFiltersChange("", "");
    setSearch("");
  }
  async function copy(value: string, feedback: string) {
    if (isPreviousData) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(feedback);
    } catch {
      toast.error(
        "Clipboard access is unavailable. Download the logs or select the text manually."
      );
    }
  }
  function download() {
    if (isPreviousData) return;
    const text = logs.entries
      .map(
        (entry) =>
          `${entry.timestamp ?? ""}${entry.level === "unknown" ? "" : ` [${entry.level}]`} ${entry.source} ${entry.message}${entry.cid ? ` CID=${entry.cid}` : ""}`
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pdnd-local-logs.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return {
    search,
    setSearch,
    groupByPackage,
    setGroupByPackage,
    sourceGroups,
    logs: {
      ...logs,
      isPreviousData,
      loading: logs.loading || search !== debouncedSearch,
    },
    hasFilters: Boolean(selectedSource || selectedLevel || search),
    changeSource,
    changeLevel,
    clearFilters,
    copy,
    download,
  };
}
