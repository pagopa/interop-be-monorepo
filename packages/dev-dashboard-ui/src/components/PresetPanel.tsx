import type {
  DashboardAction,
  Package,
  Preset,
  PresetInput,
} from "pagopa-interop-dev-dashboard-contracts";

import {
  Boxes,
  LoaderCircle,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router-dom";

import type { ActionFailure } from "../hooks/useDashboard";

import { usePresetEditor } from "../hooks/usePresetEditor";
import { paths } from "../router/paths";
import { ErrorAlert } from "./common/ErrorAlert";
import { Toolbar } from "./common/Toolbar";
import { ConfirmDialog } from "./ConfirmDialog";
import { PresetEditor } from "./PresetEditor";
import { StatusBadge } from "./StatusBadge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Empty, EmptyDescription, EmptyHeader } from "./ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "./ui/item";
import { Separator } from "./ui/separator";

type Props = {
  presets: Preset[];
  packages: Package[];
  busy: Record<string, string>;
  onAction: (
    action: DashboardAction,
    key: string | string[]
  ) => Promise<boolean>;
  onSave: (input: PresetInput) => Promise<boolean>;
  onRemove: (id: string) => Promise<void>;
  actionError?: string;
  actionFailures?: Record<string, ActionFailure>;
};

export function PresetPanel({
  presets,
  packages,
  busy,
  onAction,
  onSave,
  onRemove,
  actionError,
  actionFailures,
}: Props) {
  const editor = usePresetEditor();
  return (
    <Card role="region" aria-labelledby="presets-title">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle asChild>
          <h2 id="presets-title">Presets</h2>
        </CardTitle>
        <Button
          size="sm"
          disabled={Boolean(editor.value)}
          onClick={(event) => editor.open(undefined, event.currentTarget)}
        >
          <Plus data-icon="inline-start" aria-hidden="true" />
          New preset
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {editor.value && (
          <PresetEditor
            key={editor.value.preset?.id ?? "new"}
            preset={editor.value.preset}
            packages={packages}
            busy={Boolean(busy["preset-editor"])}
            onSave={onSave}
            onCancel={editor.close}
            onClosed={editor.restoreFocus}
            error={actionError}
          />
        )}
        {[
          { source: "shared", title: "Shared presets", id: "shared-presets" },
          { source: "personal", title: "Local presets", id: "local-presets" },
        ]
          .filter(
            (group) =>
              group.source === "shared" ||
              presets.some((preset) => preset.source === "personal")
          )
          .map((group, groupIndex) => (
            <Fragment key={group.source}>
              {groupIndex > 0 && <Separator />}
              <section aria-label={group.title} className="flex flex-col gap-3">
                <CardTitle asChild size="section">
                  <h3 id={group.id}>
                    {group.source === "shared" ? "Shared" : "Local"}
                  </h3>
                </CardTitle>
                <ItemGroup className="overflow-hidden rounded-md border">
                  {presets
                    .filter((preset) => preset.source === group.source)
                    .map((preset, index) => (
                      <PresetItem
                        key={preset.id}
                        preset={preset}
                        packages={packages}
                        busy={busy}
                        failure={actionFailures?.[`preset:${preset.id}`]}
                        first={index === 0}
                        editorOpen={Boolean(editor.value)}
                        onEdit={(button) => editor.open(preset, button)}
                        onAction={onAction}
                        onRemove={onRemove}
                      />
                    ))}
                </ItemGroup>
                {!presets.some((preset) => preset.source === group.source) && (
                  <Empty>
                    <EmptyHeader>
                      <EmptyDescription>
                        No shared presets available.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </section>
            </Fragment>
          ))}
      </CardContent>
    </Card>
  );
}

function PresetItem({
  preset,
  packages,
  busy,
  failure,
  first,
  editorOpen,
  onEdit,
  onAction,
  onRemove,
}: {
  preset: Preset;
  packages: Package[];
  busy: Record<string, string>;
  failure?: ActionFailure;
  first: boolean;
  editorOpen: boolean;
  onEdit: (trigger: HTMLButtonElement) => void;
  onAction: Props["onAction"];
  onRemove: Props["onRemove"];
}) {
  const members = preset.packages.map((member) =>
    packages.find((item) => item.name === member.name)
  );
  const running = members.filter(
    (member) => member?.state === "running"
  ).length;
  const active = members.some(
    (member) =>
      member?.state === "running" ||
      member?.state === "starting" ||
      member?.state === "building"
  );
  const allRunning =
    preset.packages.length > 0 && running === preset.packages.length;
  const key = `preset:${preset.id}`;
  const startKey = `preset-start:${preset.id}`;
  const stopKey = `preset-stop:${preset.id}`;
  const starting = Boolean(busy[startKey]);
  const stopping = Boolean(busy[stopKey]);
  const pending = Boolean(busy[key]) || starting || stopping;
  return (
    <>
      {!first && <Separator />}
      <Item
        asChild
        className="flex-col items-stretch lg:flex-row lg:items-center"
      >
        <article aria-label={preset.name}>
          <ItemContent>
            <Toolbar>
              <ItemTitle asChild>
                <h4>{preset.name}</h4>
              </ItemTitle>
              {allRunning && <StatusBadge state="running" />}
            </Toolbar>
            <ItemDescription>
              {running}/{preset.packages.length} running
            </ItemDescription>
            {failure && (
              <ErrorAlert
                message={
                  failure.kind === "preset.start"
                    ? "Startup failed"
                    : "Stop failed"
                }
                logsHref={`${paths.logs}?${new URLSearchParams({ source: `preset:${preset.id}`, level: "error" })}`}
              />
            )}
          </ItemContent>
          <ItemActions>
            <Button asChild size="sm" variant="outline">
              <Link
                to={`${paths.packages}?preset=${encodeURIComponent(preset.id)}`}
                aria-label={`View packages in ${preset.name}`}
              >
                <Boxes data-icon="inline-start" aria-hidden="true" />
                Packages
              </Link>
            </Button>
            <Button
              size="sm"
              className="w-20"
              disabled={pending || allRunning}
              aria-busy={starting}
              aria-label={`Start ${preset.name}`}
              onClick={() =>
                void onAction({ type: "preset.start", id: preset.id }, [
                  key,
                  startKey,
                ])
              }
            >
              {starting ? (
                <>
                  <LoaderCircle
                    data-icon="inline-start"
                    aria-hidden="true"
                    className="animate-spin"
                  />
                  <span className="sr-only" role="status">
                    Preset operation in progress
                  </span>
                </>
              ) : (
                <Play data-icon="inline-start" aria-hidden="true" />
              )}
              Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-20"
              disabled={pending || !active}
              aria-busy={stopping}
              aria-label={`Stop ${preset.name}`}
              onClick={() =>
                void onAction({ type: "preset.stop", id: preset.id }, [
                  key,
                  stopKey,
                ])
              }
            >
              {stopping ? (
                <>
                  <LoaderCircle
                    data-icon="inline-start"
                    aria-hidden="true"
                    className="animate-spin"
                  />
                  <span className="sr-only" role="status">
                    Preset operation in progress
                  </span>
                </>
              ) : (
                <Square data-icon="inline-start" aria-hidden="true" />
              )}
              Stop
            </Button>
            {preset.source === "personal" && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending || editorOpen}
                  aria-label={`Edit ${preset.name}`}
                  title="Edit preset"
                  onClick={(event) => onEdit(event.currentTarget)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={pending}
                      aria-label={`Delete ${preset.name}`}
                      title="Delete preset"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  }
                  title={`Delete ${preset.name}?`}
                  description="This removes the local preset. Its running packages remain active."
                  confirmLabel="Delete preset"
                  confirmIcon={Trash2}
                  busy={pending}
                  onConfirm={() => onRemove(preset.id)}
                />
              </>
            )}
          </ItemActions>
        </article>
      </Item>
    </>
  );
}
