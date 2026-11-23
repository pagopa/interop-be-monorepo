/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { NextFunction, Request, Response } from "express";
import { vi } from "vitest";

vi.mock("pagopa-interop-application-audit", async () => ({
  applicationAuditBeginMiddleware: vi.fn(
    async () => (_req: Request, _res: Response, next: NextFunction) => next()
  ),
  applicationAuditEndMiddleware: vi.fn(
    async () => (_req: Request, _res: Response, next: NextFunction) => next()
  ),
}));

vi.mock("pagopa-interop-commons", async () => {
  const actual = await vi.importActual<typeof import("pagopa-interop-commons")>(
    "pagopa-interop-commons"
  );

  return {
    ...actual,
    authenticationMiddleware: vi.fn(
      () =>
        async (
          req: Request & { ctx: AppContext },
          _res: Response,
          next: NextFunction
        ): Promise<unknown> => {
          try {
            const token = jwtFromAuthHeader(req, genericLogger);
            const decoded = decodeJwtToken(token, genericLogger);
            if (decoded == null) {
              throw new Error("JWT decoding failed");
            }
            // eslint-disable-next-line functional/immutable-data
            req.ctx.authData = readAuthDataFromJwtToken(decoded);
            return next();
          } catch (error) {
            return next(error);
          }
        }
    ),
  };
});

import {
  AppContext,
  decodeJwtToken,
  genericLogger,
  jwtFromAuthHeader,
  readAuthDataFromJwtToken,
} from "pagopa-interop-commons";
