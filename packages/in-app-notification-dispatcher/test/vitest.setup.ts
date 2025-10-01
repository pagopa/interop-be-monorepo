import { vi } from "vitest";

vi.mock("../src/handlers/handlerCommons.ts", async () => {
  const actual = await vi.importActual<
    typeof import("../src/handlers/handlerCommons.ts")
  >("../src/handlers/handlerCommons.ts");
  return {
    ...actual,
    getNotificationRecipients: vi.fn(),
  };
});
