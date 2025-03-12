import { vi } from "vitest";

vi.mock("pagopa-interop-commons", async () => {
  const actual = await vi.importActual<typeof import("pagopa-interop-commons")>(
    "pagopa-interop-commons"
  );

  return {
    ...actual,
    authenticationMiddleware: vi.fn(
      () =>
        // Return a middleware function that simply calls next()
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        (
          req: { ctx: { authData: { userRoles: string[] } } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          res: any,
          next: () => void
        ) => {
          req.ctx = { authData: { userRoles: ["admin"] } };
          next();
        }
    ),
  };
});

import app from "../src/app.js";

export const api = app;
