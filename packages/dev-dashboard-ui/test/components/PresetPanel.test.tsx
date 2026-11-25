import type { Package } from "pagopa-interop-dev-dashboard-contracts";

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PresetPanel } from "../../src/components/PresetPanel";
import { statusFixture } from "../fixtures";
import { renderWithProviders as render } from "../utils";

function renderPresets(saveSucceeds = true) {
  const fixture = statusFixture();
  const item = fixture.packages[2];
  const preset = {
    ...fixture.presets[0],
    packages: [{ name: item.name, watch: false }],
  };
  const onAction = vi.fn().mockResolvedValue(true);
  const onSave = vi.fn().mockResolvedValue(saveSucceeds);
  render(
    <PresetPanel
      presets={[preset]}
      packages={fixture.packages}
      busy={{}}
      onAction={onAction}
      onSave={onSave}
      onRemove={vi.fn()}
    />
  );
  return { item, preset, onAction, onSave };
}

function renderRuntimePreset(
  packages: Package[],
  members: string[],
  busy: Record<string, string> = {}
) {
  const fixture = statusFixture();
  const preset = {
    ...fixture.presets[0],
    packages: members.map((name) => ({ name })),
  };
  const onAction = vi.fn().mockResolvedValue(true);
  render(
    <PresetPanel
      presets={[preset]}
      packages={packages}
      busy={busy}
      onAction={onAction}
      onSave={vi.fn()}
      onRemove={vi.fn()}
    />
  );
  return {
    preset,
    onAction,
    article: screen.getByRole("article", { name: preset.name }),
  };
}

describe("preset package controls", () => {
  it("starts the frontend backend package preset without a frontend checkout", async () => {
    const fixture = statusFixture();
    const user = userEvent.setup();
    const onAction = vi.fn().mockResolvedValue(true);
    const preset = {
      ...fixture.presets[0],
      id: "frontend-full",
      name: "Frontend backend packages",
    };
    render(
      <PresetPanel
        presets={[preset]}
        packages={fixture.packages}
        busy={{}}
        onAction={onAction}
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    const article = screen.getByRole("article", { name: preset.name });
    expect(within(article).queryByRole("status")).not.toBeInTheDocument();
    const start = within(article).getByRole("button", {
      name: `Start ${preset.name}`,
    });
    expect(start).toBeEnabled();
    await user.click(start);
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      { type: "preset.start", id: preset.id },
      [`preset:${preset.id}`, `preset-start:${preset.id}`]
    );
  });
  it("counts all included packages even when filtered out and does not count watch changes", async () => {
    const fixture = statusFixture();
    const bff = fixture.packages[0];
    const tenant = fixture.packages[2];
    renderPresets();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "New preset" }));
    const dialog = screen.getByRole("dialog", { name: "Create local preset" });
    const selected = within(dialog).getByRole("status", {
      name: "Selected packages",
    });
    const search = within(dialog).getByRole("searchbox", {
      name: "Search packages",
    });
    expect(selected).toHaveTextContent("0 selected");
    await user.click(
      within(dialog).getByRole("checkbox", { name: `Include ${bff.label}` })
    );
    expect(selected).toHaveTextContent("1 selected");
    await user.click(
      within(dialog).getByRole("checkbox", { name: `Watch ${bff.label}` })
    );
    expect(selected).toHaveTextContent("1 selected");
    await user.type(search, tenant.name);
    expect(selected).toHaveTextContent("1 selected");
    await user.click(
      within(dialog).getByRole("checkbox", { name: `Include ${tenant.label}` })
    );
    expect(selected).toHaveTextContent("2 selected");
    await user.clear(search);
    await user.type(search, "no-match");
    expect(selected).toHaveTextContent("2 selected");
    await user.click(
      within(dialog).getByRole("button", { name: "Clear search" })
    );
    await user.click(
      within(dialog).getByRole("checkbox", { name: `Include ${tenant.label}` })
    );
    expect(selected).toHaveTextContent("1 selected");
    await user.click(
      within(dialog).getByRole("checkbox", { name: `Include ${bff.label}` })
    );
    expect(selected).toHaveTextContent("0 selected");
  });

  it("searches real package names and labels without losing hidden selections, watch choices or submitting on Enter", async () => {
    const fixture = statusFixture();
    const bff = fixture.packages[0];
    const tenant = fixture.packages[2];
    const { onSave } = renderPresets();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "New preset" }));
    const dialog = screen.getByRole("dialog", { name: "Create local preset" });
    const form = within(dialog).getByRole("form", { name: "Local preset" });
    expect(within(form).getByLabelText("Preset name")).toHaveFocus();
    await user.type(
      within(form).getByLabelText("Preset name"),
      "Filtered packages"
    );
    const search = within(form).getByRole("searchbox", {
      name: "Search packages",
    });
    await user.type(search, `  ${bff.name.toUpperCase()}  `);
    expect(
      within(form).getByRole("checkbox", { name: `Include ${bff.label}` })
    ).toBeVisible();
    expect(
      within(form).queryByRole("checkbox", { name: `Include ${tenant.label}` })
    ).not.toBeInTheDocument();
    await user.click(
      within(form).getByRole("checkbox", { name: `Include ${bff.label}` })
    );
    await user.click(
      within(form).getByRole("checkbox", { name: `Watch ${bff.label}` })
    );
    await user.click(search);
    await user.keyboard("{Enter}");
    expect(onSave).not.toHaveBeenCalled();
    expect(dialog).toBeVisible();
    await user.clear(search);
    await user.type(search, `  ${tenant.label.toUpperCase()}  `);
    expect(
      within(form).queryByRole("checkbox", { name: `Include ${bff.label}` })
    ).not.toBeInTheDocument();
    await user.click(
      within(form).getByRole("checkbox", { name: `Include ${tenant.label}` })
    );
    await user.clear(search);
    await user.type(search, "does-not-exist");
    expect(
      within(form).getByText("No packages match your search.")
    ).toBeVisible();
    expect(within(form).queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(
      within(form).getByRole("button", { name: "Clear search" })
    );
    expect(search).toHaveValue("");
    expect(
      within(form).getByRole("checkbox", { name: `Include ${bff.label}` })
    ).toBeChecked();
    expect(
      within(form).getByRole("checkbox", { name: `Watch ${bff.label}` })
    ).toBeChecked();
    expect(
      within(form).getByRole("checkbox", { name: `Include ${tenant.label}` })
    ).toBeChecked();
    await user.type(search, tenant.label);
    await user.click(within(form).getByRole("button", { name: "Save preset" }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      name: "Filtered packages",
      packages: [
        { name: bff.name, watch: true },
        { name: tenant.name, watch: false },
      ],
    });
  });

  it("preserves edited members and their watch choices when searching and saving a local preset", async () => {
    const fixture = statusFixture();
    const worker = fixture.packages[1];
    const tenant = fixture.packages[2];
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <PresetPanel
        presets={fixture.presets}
        packages={fixture.packages}
        busy={{}}
        onAction={vi.fn()}
        onSave={onSave}
        onRemove={vi.fn()}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit My core" }));
    const dialog = screen.getByRole("dialog", { name: "Edit local preset" });
    const form = within(dialog).getByRole("form", { name: "Local preset" });
    expect(within(form).getByLabelText("Preset name")).toHaveFocus();
    expect(
      within(form).getByRole("status", { name: "Selected packages" })
    ).toHaveTextContent("1 selected");
    await user.click(
      within(form).getByRole("checkbox", { name: `Watch ${worker.label}` })
    );
    const search = within(form).getByRole("searchbox", {
      name: "Search packages",
    });
    await user.type(search, tenant.name);
    await user.click(
      within(form).getByRole("checkbox", { name: `Include ${tenant.label}` })
    );
    await user.click(
      within(form).getByRole("checkbox", { name: `Watch ${tenant.label}` })
    );
    await user.click(
      within(form).getByRole("button", { name: "Clear search" })
    );
    expect(
      within(form).getByRole("checkbox", { name: `Include ${worker.label}` })
    ).toBeChecked();
    expect(
      within(form).getByRole("checkbox", { name: `Watch ${worker.label}` })
    ).toBeChecked();
    expect(
      within(form).getByRole("checkbox", { name: `Watch ${tenant.label}` })
    ).toBeChecked();
    await user.type(search, fixture.packages[0].name);
    await user.click(within(form).getByRole("button", { name: "Save preset" }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      id: "personal-core",
      name: "My core",
      packages: [
        { name: worker.name, watch: true },
        { name: tenant.name, watch: true },
      ],
    });
  });

  it.each(["start", "stop"])(
    "links a preset %s failure to only its error logs",
    (intent) => {
      const fixture = statusFixture();
      const onAction = vi.fn();
      render(
        <PresetPanel
          presets={fixture.presets}
          packages={fixture.packages}
          busy={{}}
          actionFailures={{
            "preset:backend": {
              kind: intent === "start" ? "preset.start" : "preset.stop",
              operationId: "failure",
              message: "Raw detail",
            },
          }}
          onAction={onAction}
          onSave={vi.fn()}
          onRemove={vi.fn()}
        />
      );
      const alert = within(
        screen.getByRole("article", { name: "Backend core" })
      ).getByRole("alert");
      expect(within(alert).getByRole("link", { name: "Logs" })).toHaveAttribute(
        "href",
        "/logs?source=preset%3Abackend&level=error"
      );
      expect(alert).not.toHaveTextContent("Raw detail");
      expect(onAction).not.toHaveBeenCalled();
    }
  );

  it("allows any catalogue package to be included with watch mode in a personal preset", async () => {
    const user = userEvent.setup();
    const { item, onSave } = renderPresets();
    await user.click(screen.getByRole("button", { name: "New preset" }));
    const dialog = screen.getByRole("dialog", { name: "Create local preset" });
    const form = within(dialog).getByRole("form", { name: "Local preset" });
    expect(
      within(form).queryByRole("checkbox", { name: /seed/i })
    ).not.toBeInTheDocument();
    await user.type(within(form).getByLabelText("Preset name"), "My packages");
    const include = within(form).getByRole("checkbox", {
      name: `Include ${item.label}`,
    });
    const watch = within(form).getByRole("checkbox", {
      name: `Watch ${item.label}`,
    });
    expect(include).toBeEnabled();
    expect(watch).toBeDisabled();
    await user.click(include);
    expect(watch).toBeEnabled();
    await user.click(watch);
    await user.click(within(form).getByRole("button", { name: "Save preset" }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      name: "My packages",
      packages: [{ name: item.name, watch: true }],
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(screen.queryByText("Needs configuration")).not.toBeInTheDocument();
  });

  it("starts a preset without a package support check", async () => {
    const user = userEvent.setup();
    const { preset, onAction } = renderPresets();
    const start = screen.getByRole("button", { name: `Start ${preset.name}` });
    expect(start).toBeEnabled();
    await user.click(start);
    expect(onAction).toHaveBeenCalledExactlyOnceWith(
      { type: "preset.start", id: preset.id },
      [`preset:${preset.id}`, `preset-start:${preset.id}`]
    );
    expect(
      screen.queryByText("One or more packages are unavailable locally.")
    ).not.toBeInTheDocument();
  });

  it.each(["Cancel", "Close dialog", "Escape"])(
    "dismisses the modal with %s and returns focus without saving",
    async (close) => {
      const user = userEvent.setup();
      const { onSave } = renderPresets();
      const trigger = screen.getByRole("button", { name: "New preset" });
      await user.click(trigger);
      const dialog = screen.getByRole("dialog", {
        name: "Create local preset",
      });
      expect(within(dialog).getByLabelText("Preset name")).toHaveFocus();
      if (close === "Escape") await user.keyboard("{Escape}");
      else
        await user.click(within(dialog).getByRole("button", { name: close }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      );
      expect(trigger).toHaveFocus();
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    }
  );

  it("keeps the modal and entered values open when saving fails", async () => {
    const user = userEvent.setup();
    const { item, onSave } = renderPresets(false);
    await user.click(screen.getByRole("button", { name: "New preset" }));
    const dialog = screen.getByRole("dialog", { name: "Create local preset" });
    await user.type(
      within(dialog).getByLabelText("Preset name"),
      "Retry preset"
    );
    await user.click(
      within(dialog).getByRole("checkbox", { name: `Include ${item.label}` })
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Save preset" })
    );
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(dialog).toBeVisible();
    expect(within(dialog).getByLabelText("Preset name")).toHaveValue(
      "Retry preset"
    );
    expect(
      within(dialog).getByRole("checkbox", { name: `Include ${item.label}` })
    ).toBeChecked();
  });

  it("separates shared and local presets and links to their packages without listing member names", () => {
    const fixture = statusFixture();
    render(
      <PresetPanel
        presets={fixture.presets}
        packages={fixture.packages}
        busy={{}}
        onAction={vi.fn()}
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    const shared = screen.getByRole("region", { name: "Shared presets" });
    const local = screen.getByRole("region", { name: "Local presets" });
    const sharedPreset = within(shared).getByRole("article", {
      name: "Backend core",
    });
    const localPreset = within(local).getByRole("article", { name: "My core" });
    expect(
      within(sharedPreset).queryByText("Includes seed")
    ).not.toBeInTheDocument();
    expect(within(sharedPreset).getByText("0/1 running")).toBeVisible();
    expect(within(localPreset).getByText("1/1 running")).toBeVisible();
    expect(
      within(sharedPreset).getByRole("link", {
        name: "View packages in Backend core",
      })
    ).toHaveAttribute("href", "/packages?preset=backend");
    expect(
      within(localPreset).getByRole("link", {
        name: "View packages in My core",
      })
    ).toHaveAttribute("href", "/packages?preset=personal-core");
    expect(
      within(sharedPreset).queryByRole("button", { name: "Edit Backend core" })
    ).not.toBeInTheDocument();
    expect(
      within(sharedPreset).queryByRole("button", {
        name: "Delete Backend core",
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(fixture.packages[0].name)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(fixture.packages[1].name)
    ).not.toBeInTheDocument();
    expect(
      within(localPreset).getByRole("button", { name: "Edit My core" })
    ).toBeEnabled();
  });

  it("omits the local section and its empty copy when only shared presets exist", () => {
    renderPresets();
    expect(
      screen.queryByRole("region", { name: "Local presets" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("No local presets yet.")).not.toBeInTheDocument();
  });

  it("shows Running and disables Start only when every declared member is running", async () => {
    const user = userEvent.setup();
    const fixture = statusFixture();
    const members = fixture.packages.slice(0, 2).map((item) => item.name);
    const packages: Package[] = fixture.packages.map((item, index) => ({
      ...item,
      state: index < 2 ? "running" : "failed",
    }));
    const { preset, onAction, article } = renderRuntimePreset(
      packages,
      members
    );
    expect(within(article).getByText("running")).toBeVisible();
    expect(within(article).getByText("2/2 running")).toBeVisible();
    const start = within(article).getByRole("button", {
      name: `Start ${preset.name}`,
    });
    expect(start).toBeDisabled();
    expect(
      within(article).getByRole("button", { name: `Stop ${preset.name}` })
    ).toBeEnabled();
    await user.click(start);
    expect(onAction).not.toHaveBeenCalled();
  });

  it.each(["stopped", "failed", "building", "starting"] satisfies Array<
    Package["state"]
  >)(
    "keeps an additive Start available when one member is %s and counts only running members",
    async (state) => {
      const user = userEvent.setup();
      const fixture = statusFixture();
      const packages: Package[] = fixture.packages.map((item, index) => ({
        ...item,
        state: index === 0 ? state : item.state,
      }));
      const members = packages.slice(0, 2).map((item) => item.name);
      const { preset, onAction, article } = renderRuntimePreset(
        packages,
        members
      );
      expect(within(article).queryByText("running")).not.toBeInTheDocument();
      expect(within(article).getByText("1/2 running")).toBeVisible();
      const start = within(article).getByRole("button", {
        name: `Start ${preset.name}`,
      });
      expect(start).toBeEnabled();
      expect(
        within(article).getByRole("button", { name: `Stop ${preset.name}` })
      ).toBeEnabled();
      await user.click(start);
      expect(onAction).toHaveBeenCalledExactlyOnceWith(
        { type: "preset.start", id: preset.id },
        [`preset:${preset.id}`, `preset-start:${preset.id}`]
      );
    }
  );

  it("does not consider a missing declared member running", () => {
    const fixture = statusFixture();
    const running = fixture.packages[1];
    const { preset, article } = renderRuntimePreset(
      [running],
      [running.name, "missing-package"]
    );
    expect(within(article).queryByText("running")).not.toBeInTheDocument();
    expect(within(article).getByText("1/2 running")).toBeVisible();
    expect(
      within(article).getByRole("button", { name: `Start ${preset.name}` })
    ).toBeEnabled();
  });

  it("does not consider an empty preset running and has nothing to stop", () => {
    const { preset, article } = renderRuntimePreset(
      statusFixture().packages,
      []
    );
    expect(within(article).queryByText("running")).not.toBeInTheDocument();
    expect(within(article).getByText("0/0 running")).toBeVisible();
    expect(
      within(article).getByRole("button", { name: `Start ${preset.name}` })
    ).toBeEnabled();
    expect(
      within(article).getByRole("button", { name: `Stop ${preset.name}` })
    ).toBeDisabled();
  });

  it.each(["building", "starting"] satisfies Array<Package["state"]>)(
    "permits Stop for a %s member without counting it as running",
    (state) => {
      const item = { ...statusFixture().packages[0], state };
      const { preset, article } = renderRuntimePreset([item], [item.name]);
      expect(within(article).getByText("0/1 running")).toBeVisible();
      expect(
        within(article).getByRole("button", { name: `Stop ${preset.name}` })
      ).toBeEnabled();
    }
  );

  it("does not confuse other preset work with Start or Stop loading", () => {
    const fixture = statusFixture();
    const { preset, article } = renderRuntimePreset(
      fixture.packages,
      [fixture.packages[0].name],
      {
        [`preset:${fixture.presets[0].id}`]: "deleting",
        "preset-editor": "saving",
      }
    );
    const start = within(article).getByRole("button", {
      name: `Start ${preset.name}`,
    });
    const stop = within(article).getByRole("button", {
      name: `Stop ${preset.name}`,
    });
    expect(start).toBeDisabled();
    expect(stop).toBeDisabled();
    expect(start).toHaveAttribute("aria-busy", "false");
    expect(stop).toHaveAttribute("aria-busy", "false");
    expect(within(article).queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Preset operation in progress…")
    ).not.toBeInTheDocument();
  });
});
