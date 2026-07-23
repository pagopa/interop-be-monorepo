/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Request, Response, NextFunction } from "express";
import http from "http";
import { afterAll, vi } from "vitest";

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
  jwtFromAuthHeader,
  genericLogger,
  readAuthDataFromJwtToken,
  decodeJwtToken,
  AppContext,
} from "pagopa-interop-commons";

import { createApp } from "../../src/app.js";
import { CatalogService } from "../../src/services/catalogService.js";

export const catalogService = {} as CatalogService;

const app = await createApp(catalogService);
// A single persistent HTTP server is created per test file process and reused
// across all tests in that file. This avoids creating a new server per request
// (supertest's default when passed an Express app), which causes TIME_WAIT port
// accumulation and socket exhaustion when many test files run in parallel.
export const api = http.createServer(app);
api.listen(0);

afterAll(async () => await api.close());
