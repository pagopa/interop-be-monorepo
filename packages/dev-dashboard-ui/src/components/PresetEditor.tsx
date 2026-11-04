import type {
  Package,
  Preset,
  PresetInput,
} from "pagopa-interop-dev-dashboard-contracts";

import { Search } from "lucide-react";

import { usePresetDraft } from "../hooks/usePresetEditor";
import { ErrorAlert } from "./common/ErrorAlert";
import { Toolbar } from "./common/Toolbar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Empty, EmptyDescription, EmptyHeader } from "./ui/empty";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "./ui/field";
import { Input } from "./ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type Props = {
  preset?: Preset;
  packages: Package[];
  busy: boolean;
  onSave: (input: PresetInput) => Promise<boolean>;
  onCancel: () => void;
  onClosed: () => void;
  error?: string;
};

export function PresetEditor({ onClosed, error, ...props }: Props) {
  const { preset, busy, onCancel } = props;
  const model = usePresetDraft(props);
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto"
        closeDisabled={busy}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {preset ? "Edit local preset" : "Create local preset"}
          </DialogTitle>
          <DialogDescription>Choose packages and watch mode.</DialogDescription>
        </DialogHeader>
        <form
          aria-label="Local preset"
          onSubmit={(event) => {
            event.preventDefault();
            void model.save();
          }}
        >
          <FieldGroup>
            {error && <ErrorAlert message={error} />}
            <Field data-disabled={busy}>
              <FieldLabel htmlFor="preset-name">Preset name</FieldLabel>
              <Input
                id="preset-name"
                autoFocus
                maxLength={100}
                required
                value={model.name}
                disabled={busy}
                onChange={(event) => model.setName(event.target.value)}
                placeholder="e.g. Agreement workflow"
              />
            </Field>
            <FieldSet disabled={busy} data-disabled={busy}>
              <FieldLegend className="sr-only">
                Packages and watch mode
              </FieldLegend>
              <Toolbar>
                <Field className="min-w-40 flex-1">
                  <FieldLabel
                    className="sr-only"
                    htmlFor="preset-package-search"
                  >
                    Search packages
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="preset-package-search"
                      type="search"
                      placeholder="Search packages by name"
                      value={model.search}
                      onChange={(event) => model.setSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.preventDefault();
                      }}
                    />
                    <InputGroupAddon>
                      <Search aria-hidden="true" />
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <Button
                  variant="outline"
                  disabled={!model.search}
                  onClick={() => model.setSearch("")}
                >
                  Clear search
                </Button>
                <Badge
                  variant="secondary"
                  format="count"
                  role="status"
                  aria-label="Selected packages"
                >
                  {model.members.length} selected
                </Badge>
              </Toolbar>
              <Table
                density="compact"
                className="table-fixed"
                containerClassName="h-72 overflow-y-scroll rounded-md border"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="w-20">
                      Include
                    </TableHead>
                    <TableHead scope="col">Package</TableHead>
                    <TableHead scope="col" className="w-20">
                      Watch
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {model.visiblePackages.map((item) => {
                    const member = model.members.find(
                      (entry) => entry.name === item.name
                    );
                    return (
                      <TableRow key={item.name}>
                        <TableCell>
                          <Checkbox
                            aria-label={`Include ${item.label}`}
                            checked={Boolean(member)}
                            onCheckedChange={(checked) =>
                              model.includePackage(item.name, checked === true)
                            }
                          />
                        </TableCell>
                        <TableCell className="break-words">
                          <code>{item.name}</code>
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            aria-label={`Watch ${item.label}`}
                            checked={member?.watch ?? false}
                            disabled={!member}
                            onCheckedChange={(checked) =>
                              model.changeWatch(item.name, checked === true)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!model.visiblePackages.length && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Empty>
                          <EmptyHeader>
                            <EmptyDescription>
                              No packages match your search.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </FieldSet>
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={onCancel}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy || !model.name.trim() || !model.members.length}
              >
                {busy ? "Saving…" : "Save preset"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
