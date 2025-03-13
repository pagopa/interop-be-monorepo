import { vi } from "vitest";
import { Request, Response, NextFunction } from "express";

vi.mock("pagopa-interop-commons", async () => {
  const actual = await vi.importActual<typeof import("pagopa-interop-commons")>(
    "pagopa-interop-commons"
  );
  return {
    ...actual,
    authenticationMiddleware: vi.fn(
      () =>
        async (
          req: Request,
          _res: Response,
          next: NextFunction
        ): Promise<unknown> => {
          try {
            const jwtToken = jwtFromAuthHeader(req, genericLogger);
            const decoded = decodeJwtToken(jwtToken, genericLogger);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ctx = (req as any).ctx || {};
            ctx.authData = readAuthDataFromJwtToken(decoded ? decoded : "");
            return next();
          } catch (error) {
            next(error);
          }
          return next();
        }
    ),
  };
});

import {
  jwtFromAuthHeader,
  genericLogger,
  readAuthDataFromJwtToken,
  decodeJwtToken,
} from "pagopa-interop-commons";
import app from "../src/app.js";

export const api = app;
