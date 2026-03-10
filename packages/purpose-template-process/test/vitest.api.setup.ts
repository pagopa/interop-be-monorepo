/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { vi } from "vitest";
import { Request, Response, NextFunction } from "express";

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
            const jwtToken = jwtFromAuthHeader(req, genericLogger);
            const decoded = decodeJwtToken(jwtToken, genericLogger);
            const ctx = req.ctx || {};
            ctx.authData = readAuthDataFromJwtToken(
              decoded ??
                (() => {
                  throw new Error(
                    "JWT decoding failed: 'decoded' is null or undefined."
                  );
                })()
            );
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
  AppContext,
  decodeJwtToken,
  genericLogger,
  jwtFromAuthHeader,
  readAuthDataFromJwtToken,
} from "pagopa-interop-commons";
import { createApp } from "../src/app.js";
import { PurposeTemplateService } from "../src/services/purposeTemplateService.js";

export const purposeTemplateService = {} as PurposeTemplateService;

export const api = await createApp(purposeTemplateService);
