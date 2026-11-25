import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it } from "vitest";

import { NotificationProvider } from "../../src/providers/NotificationProvider";

describe("notifications", () => {
  afterEach(() => toast.dismiss());

  it("allows a notification to be closed before automatic dismissal", async () => {
    render(
      <NotificationProvider>
        <button
          type="button"
          onClick={() =>
            toast.success("Operation completed", { duration: Infinity })
          }
        >
          Notify
        </button>
      </NotificationProvider>
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Notify" }));
    expect(await screen.findByText("Operation completed")).toBeVisible();
    const close = screen.getByRole("button", { name: "Close notification" });
    // Sonner requests pointer capture; jsdom does not implement this browser API.
    close.setPointerCapture = () => undefined;
    await user.click(close);
    await waitFor(() =>
      expect(screen.queryByText("Operation completed")).not.toBeInTheDocument()
    );
  });
});
