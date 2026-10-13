import type { LogSource, Preset } from "pagopa-interop-dev-dashboard-contracts";

import { Copy, Download, FilterX, RefreshCw, Search } from "lucide-react";

import { useLogFilters } from "../hooks/useLogFilters";
import { ErrorAlert } from "./common/ErrorAlert";
import { Toolbar } from "./common/Toolbar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Empty, EmptyDescription, EmptyHeader } from "./ui/empty";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "./ui/native-select";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";
import { VirtualizedLogs } from "./VirtualizedLogs";

type Props = {
  sources: LogSource[];
  presets: Preset[];
  selectedSource: string;
  selectedLevel: string;
  onFiltersChange: (source: string, level: string) => void;
};

export function LogsPanel(props: Props) {
  const { selectedSource, selectedLevel } = props;
  const model = useLogFilters(props);
  const { entries, loading, hasResolved, isPreviousData, error, refresh } =
    model.logs;
  return (
    <Card
      role="region"
      aria-labelledby="logs-title"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle asChild>
          <h2 id="logs-title">Aggregate logs</h2>
        </CardTitle>
        <Toolbar>
          <Badge
            role="status"
            variant="outline"
            className="shrink-0 whitespace-nowrap"
            title={
              isPreviousData
                ? "Showing lines from the previous filter"
                : undefined
            }
          >
            {entries.length} lines
            {loading ? " · updating" : isPreviousData ? " · update failed" : ""}
            {isPreviousData && (
              <span className="sr-only"> · previous filter</span>
            )}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            disabled={!entries.length || isPreviousData}
            onClick={() =>
              void model.copy(
                entries.map((entry) => entry.message).join("\n"),
                "Logs copied"
              )
            }
          >
            <Copy data-icon="inline-start" aria-hidden="true" />
            Copy
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!entries.length || isPreviousData}
            onClick={model.download}
          >
            <Download data-icon="inline-start" aria-hidden="true" />
            Download
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Refresh logs"
            title="Refresh logs"
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        </Toolbar>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,2fr)_minmax(160px,1fr)_120px_auto]">
          <Field>
            <FieldLabel htmlFor="log-search">Search logs</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="log-search"
                type="search"
                value={model.search}
                onChange={(event) => model.setSearch(event.target.value)}
                placeholder="Message or correlation ID"
              />
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="log-source">Source</FieldLabel>
            <NativeSelect
              id="log-source"
              value={selectedSource}
              onChange={(event) => model.changeSource(event.target.value)}
            >
              <NativeSelectOption value="">All sources</NativeSelectOption>
              <NativeSelectOption value="group:packages">
                All packages
              </NativeSelectOption>
              <NativeSelectOption value="group:infra">Infra</NativeSelectOption>
              <NativeSelectOption value="group:seed">
                Seed packages
              </NativeSelectOption>
              {selectedSource &&
                selectedSource !== "group:seed" &&
                selectedSource !== "group:packages" &&
                selectedSource !== "group:infra" &&
                !model.sourceGroups.some((group) =>
                  group.sources.some((source) => source.id === selectedSource)
                ) && (
                  <NativeSelectOption value={selectedSource}>
                    {selectedSource}
                  </NativeSelectOption>
                )}
              {model.sourceGroups.map((group) => (
                <NativeSelectOptGroup key={group.label} label={group.label}>
                  {group.sources.map((source) => (
                    <NativeSelectOption key={source.id} value={source.id}>
                      {source.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="log-level">Level</FieldLabel>
            <NativeSelect
              id="log-level"
              value={selectedLevel}
              onChange={(event) => model.changeLevel(event.target.value)}
            >
              <NativeSelectOption value="">All levels</NativeSelectOption>
              {["error", "warn", "info", "debug", "unknown"].map((level) => (
                <NativeSelectOption key={level} value={level}>
                  {level}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Button
            className="self-end"
            variant="outline"
            disabled={!model.hasFilters}
            aria-label="Clear log filters"
            title="Clear log filters"
            onClick={model.clearFilters}
          >
            <FilterX data-icon="inline-start" aria-hidden="true" />
            <span className="xl:sr-only">Clear filters</span>
          </Button>
        </FieldGroup>
        {error && <ErrorAlert message={error} />}
      </CardContent>
      <Separator />
      <CardContent className="relative min-h-0 flex-1 p-0">
        <VirtualizedLogs
          entries={entries}
          copyDisabled={isPreviousData}
          onCopyLine={(value) => model.copy(value, "Log line copied")}
          onCopyCid={(value) => model.copy(value, "Correlation ID copied")}
        />
        {!entries.length && (
          <Empty className="pointer-events-none absolute inset-0 h-full">
            <EmptyHeader>
              {loading && !hasResolved && <Skeleton className="h-4 w-44" />}
              <EmptyDescription>
                {loading
                  ? hasResolved
                    ? "Updating log entries…"
                    : "Loading log entries…"
                  : model.hasFilters
                    ? "No lines match these filters. Clear the filters or wait for new logs."
                    : "Logs will appear as packages, infrastructure and checks produce output."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
