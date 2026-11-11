import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "../../src/components/ConfirmDialog";
import { Button } from "../../src/components/ui/button";

describe("destructive confirmation", () => {
  it("prevents duplicate confirmation or dismissal while the request is pending", async () => {
    let finish: () => void = () => undefined;
    const request = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const action = vi.fn(() => request);
    function Example() {
      const [busy, setBusy] = useState(false);
      return (
        <ConfirmDialog
          trigger={<Button>Reset</Button>}
          title="Confirm reset"
          description="Local data will be deleted."
          confirmLabel="Delete data"
          busy={busy}
          onConfirm={async () => {
            setBusy(true);
            await action();
            setBusy(false);
          }}
        />
      );
    }
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete data",
      })
    );
    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete data" });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute("aria-busy", "true");
    expect(within(confirm).getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Working…")).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel" })
    ).toBeDisabled();
    expect(
      within(dialog).queryByRole("button", { name: "Close dialog" })
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(dialog).toBeVisible();
    finish();
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Reset" })).toHaveFocus();
  });
});
