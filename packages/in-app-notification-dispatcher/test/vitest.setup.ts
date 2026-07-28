import { vi } from "vitest";

// Mock the getNotificationRecipients function from handlerCommons module
// to use a mocked implementation in tests.
vi.mock("pagopa-interop-notification-commons", async () => {
  const actual = await vi.importActual<
    typeof import("pagopa-interop-notification-commons")
  >("pagopa-interop-notification-commons");
  return {
    ...actual,
    getNotificationRecipients: vi.fn(),
  };
});
