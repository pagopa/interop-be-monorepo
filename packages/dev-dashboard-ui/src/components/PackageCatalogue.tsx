import type {
  DashboardAction,
  Package,
  Preset,
} from "pagopa-interop-dev-dashboard-contracts";

import {
  Eye,
  EyeOff,
  LoaderCircle,
  Play,
  Search,
  Square,
  Terminal,
} from "lucide-react";

import type { WatchChange } from "../hooks/useDashboardActions";
import type { PackageFilter } from "../router/packageFilter";

import { usePackageSelection } from "../hooks/usePackageSelection";
import { ErrorAlert } from "./common/ErrorAlert";
import { Toolbar } from "./common/Toolbar";
import { StatusBadge } from "./StatusBadge";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader } from "./ui/empty";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from "./ui/native-select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type Props = {
  packages: Package[];
  seedPackages: string[];
  presets: Preset[];
  filter: PackageFilter;
  onFilterChange: (filter: PackageFilter) => void;
  busy: Record<string, string>;
  watchChanges?: Record<string, WatchChange>;
  onAction: (
    action: DashboardAction,
    key: string | string[]
  ) => Promise<boolean>;
  onLogs: (source: string) => void;
  actionError?: string;
  onDismissError?: () => void;
};

export function PackageCatalogue(props: Props) {
  const {
    packages,
    presets,
    onFilterChange,
    onAction,
    onLogs,
    actionError,
    onDismissError,
  } = props;
  const model = usePackageSelection(props);
  return (
    <Card role="region" aria-labelledby="packages-title">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle asChild>
          <h2 id="packages-title">Package catalogue</h2>
        </CardTitle>
        <Badge variant="outline">
          {model.visible.length} of {packages.length} packages
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FieldGroup className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <Field>
            <FieldLabel htmlFor="package-search">Find a package</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="package-search"
                type="search"
                placeholder="Package name"
                value={model.search}
                onChange={(event) => model.changeSearch(event.target.value)}
              />
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="package-group">Group</FieldLabel>
            <NativeSelect
              id="package-group"
              value={model.filterValue}
              onChange={(event) => {
                const value = event.target.value;
                onFilterChange(
                  value === "jobs"
                    ? { kind: "jobs" }
                    : value === "seed"
                      ? { kind: "seed" }
                      : value.startsWith("preset:")
                        ? { kind: "preset", id: value.slice("preset:".length) }
                        : { kind: "all" }
                );
              }}
            >
              <NativeSelectOption value="">All packages</NativeSelectOption>
              <NativeSelectOption value="jobs">Jobs</NativeSelectOption>
              <NativeSelectOption value="seed">
                Seed packages
              </NativeSelectOption>
              {model.missingPreset && (
                <NativeSelectOption value={model.filterValue}>
                  Unavailable preset
                </NativeSelectOption>
              )}
              <NativeSelectOptGroup label="Shared presets">
                {presets
                  .filter((preset) => preset.source === "shared")
                  .map((preset) => (
                    <NativeSelectOption
                      key={preset.id}
                      value={`preset:${preset.id}`}
                    >
                      {preset.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelectOptGroup>
              {presets.some((preset) => preset.source === "personal") && (
                <NativeSelectOptGroup label="Local presets">
                  {presets
                    .filter((preset) => preset.source === "personal")
                    .map((preset) => (
                      <NativeSelectOption
                        key={preset.id}
                        value={`preset:${preset.id}`}
                      >
                        {preset.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelectOptGroup>
              )}
            </NativeSelect>
          </Field>
        </FieldGroup>
        <Toolbar
          role="group"
          aria-label="Selected package actions"
          className="justify-between gap-3"
        >
          <Badge variant="secondary" format="count" aria-live="polite">
            {model.selectedCount} selected
          </Badge>
          <Toolbar className="ml-auto justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!model.startNames.length}
              aria-label={
                model.startJobsOnly
                  ? "Run selected jobs"
                  : "Start selected packages"
              }
              onClick={() =>
                model.runBulk(
                  { type: "packages.start", names: model.startNames },
                  model.startNames
                )
              }
            >
              <Play data-icon="inline-start" aria-hidden="true" />
              {model.startJobsOnly ? "Run" : "Start"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!model.stopNames.length}
              aria-label="Stop selected packages"
              onClick={() =>
                model.runBulk(
                  { type: "packages.stop", names: model.stopNames },
                  model.stopNames
                )
              }
            >
              <Square data-icon="inline-start" aria-hidden="true" />
              Stop
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!model.watchOnNames.length}
              aria-label="Enable watch for selected packages"
              onClick={() =>
                model.runBulk(
                  {
                    type: "packages.watch",
                    names: model.watchOnNames,
                    watch: true,
                  },
                  model.watchOnNames
                )
              }
            >
              <Eye data-icon="inline-start" aria-hidden="true" />
              Watch on
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!model.watchOffNames.length}
              aria-label="Disable watch for selected packages"
              onClick={() =>
                model.runBulk(
                  {
                    type: "packages.watch",
                    names: model.watchOffNames,
                    watch: false,
                  },
                  model.watchOffNames
                )
              }
            >
              <EyeOff data-icon="inline-start" aria-hidden="true" />
              Watch off
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!model.selectedCount}
              onClick={model.clearSelection}
            >
              Clear selection
            </Button>
          </Toolbar>
        </Toolbar>
        {actionError && (
          <ErrorAlert message={actionError} onDismiss={onDismissError} />
        )}
        <Table density="compact" className="min-w-[760px]">
          <TableCaption className="sr-only">
            Backend packages and process controls
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-12">
                <span className="sr-only">Select</span>
                <Checkbox
                  aria-label="Select all visible packages"
                  checked={
                    model.selectedCount > 0 && !model.allSelected
                      ? "indeterminate"
                      : model.allSelected
                  }
                  disabled={!model.visible.length}
                  onCheckedChange={(checked) =>
                    model.selectAll(checked === true)
                  }
                />
              </TableHead>
              <TableHead scope="col">Name</TableHead>
              <TableHead scope="col">Port</TableHead>
              <TableHead scope="col" className="w-40 min-w-40">
                State
              </TableHead>
              <TableHead scope="col" className="w-20">
                Watch
              </TableHead>
              <TableHead scope="col" className="text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.visible.map((item) => {
              const key = `package:${item.name}`;
              const isPending = model.pending(item);
              const processPending = model.processPending(item);
              const watchPending = model.watchPending(item);
              const watchStatus = model.watchStatus(item);
              const active = model.active(item);
              const actionLabel = active
                ? "Stop"
                : item.kind === "job"
                  ? "Run"
                  : "Start";
              return (
                <TableRow
                  key={item.name}
                  aria-selected={model.selected.includes(item.name)}
                  data-state={
                    model.selected.includes(item.name) ? "selected" : undefined
                  }
                >
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${item.name}`}
                      checked={model.selected.includes(item.name)}
                      onCheckedChange={(checked) =>
                        model.selectPackage(item.name, checked === true)
                      }
                    />
                  </TableCell>
                  <TableCell className="max-w-[360px] break-words font-normal">
                    <code>{item.name}</code>
                  </TableCell>
                  <TableCell>{item.port ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge
                      state={watchStatus ?? item.state}
                      pending={Boolean(watchStatus)}
                      id={watchStatus ? `watch-status-${item.name}` : undefined}
                    />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      aria-label={`Watch ${item.name}`}
                      checked={model.watchValue(item)}
                      disabled={isPending}
                      aria-busy={watchPending}
                      aria-describedby={
                        watchStatus ? `watch-status-${item.name}` : undefined
                      }
                      onCheckedChange={(checked) =>
                        model.runWatch(item.name, checked === true)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Toolbar className="justify-end">
                      <Button
                        variant={active ? "outline" : "default"}
                        size="sm"
                        className="w-20"
                        disabled={isPending}
                        disabledAppearance={
                          watchPending && !processPending ? "preserve" : "muted"
                        }
                        aria-busy={processPending}
                        aria-label={`${actionLabel} ${item.name}`}
                        onClick={() =>
                          void onAction(
                            {
                              type: active ? "package.stop" : "package.start",
                              name: item.name,
                            },
                            key
                          )
                        }
                      >
                        {processPending ? (
                          <>
                            <LoaderCircle
                              data-icon="inline-start"
                              aria-hidden="true"
                              className="animate-spin"
                            />
                            <span className="sr-only" role="status">
                              Package operation in progress
                            </span>
                          </>
                        ) : active ? (
                          <Square data-icon="inline-start" aria-hidden="true" />
                        ) : (
                          <Play data-icon="inline-start" aria-hidden="true" />
                        )}
                        {actionLabel}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Logs for ${item.name}`}
                        onClick={() => onLogs(item.name)}
                      >
                        <Terminal data-icon="inline-start" aria-hidden="true" />
                        Logs
                      </Button>
                    </Toolbar>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {!model.visible.length && (
          <Empty>
            <EmptyHeader>
              <EmptyDescription>
                {model.missingPreset
                  ? "This preset is no longer available."
                  : "No packages match these filters."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
