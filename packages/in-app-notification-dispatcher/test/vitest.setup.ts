import { vi } from "vitest";

// Mock the getNotificationRecipients function from handlerCommons module
// to use a mocked implementation in tests.
vi.mock("../src/handlers/handlerCommons.ts", async () => {
  const actual = await vi.importActual<
    typeof import("../src/handlers/handlerCommons.ts")
  >("../src/handlers/handlerCommons.ts");
  return {
    ...actual,
    getNotificationRecipients: vi.fn(),
  };
});
