import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InfrastructurePanel } from "../../components/InfrastructurePanel";
import { statusFixture } from "../fixtures";

describe("infrastructure actions", () => {
  it("places compact Reset, Stop and Start actions in order and requires confirmation before deleting data", async () => {
    const onAction = vi.fn().mockResolvedValue(true);
    render(
      <InfrastructurePanel
        infrastructure={statusFixture().infrastructure}
        busy={{}}
        onAction={onAction}
        onLogs={vi.fn()}
      />
    );
    const actions = screen.getByRole("group", {
      name: "Infrastructure actions",
    });
    expect(
      within(actions)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Reset", "Stop", "Start"]);
    expect(
      screen.queryByRole("region", { name: "Reset local data" })
    ).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(
      within(actions).getByRole("button", { name: "Reset infrastructure" })
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete local infrastructure data?",
    });
    expect(onAction).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onAction).not.toHaveBeenCalled();
    await user.click(
      within(actions).getByRole("button", { name: "Reset infrastructure" })
    );
    await user.click(
      screen.getByRole("button", { name: "Delete data and reset" })
    );
    await waitFor(() =>
      expect(onAction).toHaveBeenCalledExactlyOnceWith(
        { type: "infra.reset", confirm: true },
        ["infra", "infra-reset"]
      )
    );
  });

  it("keeps only Reset busy and blocks infrastructure controls while reset is running", () => {
    render(
      <InfrastructurePanel
        infrastructure={statusFixture().infrastructure}
        busy={{ "infra-reset": "reset-operation" }}
        onAction={vi.fn()}
        onLogs={vi.fn()}
      />
    );
    const actions = screen.getByRole("group", {
      name: "Infrastructure actions",
    });
    const reset = within(actions).getByRole("button", {
      name: "Reset infrastructure",
    });
    expect(reset).toHaveAttribute("aria-busy", "true");
    expect(reset).toBeDisabled();
    for (const name of ["Start infrastructure", "Stop infrastructure"]) {
      expect(within(actions).getByRole("button", { name })).toBeDisabled();
      expect(within(actions).getByRole("button", { name })).toHaveAttribute(
        "aria-busy",
        "false"
      );
    }
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
