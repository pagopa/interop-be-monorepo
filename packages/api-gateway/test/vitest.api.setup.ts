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
            // eslint-disable-next-line functional/immutable-data
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
import { createApp } from "../src/app.js";
import { AgreementService } from "../src/services/agreementService.js";
import { AttributeService } from "../src/services/attributeService.js";
import { AuthorizationService } from "../src/services/authorizationService.js";
import { CatalogService } from "../src/services/catalogService.js";
import { NotifierEventsService } from "../src/services/notifierEventsService.js";
import { PurposeService } from "../src/services/purposeService.js";
import { TenantService } from "../src/services/tenantService.js";
import { ReadModelService } from "../src/services/readModelService.js";

export const mockAgreementService = {} as AgreementService;
export const mockAttributeService = {} as AttributeService;
export const mockAuthorizationService = {} as AuthorizationService;
export const mockCatalogService = {} as CatalogService;
export const mockNotifierEventsService = {} as NotifierEventsService;
export const mockPurposeService = {} as PurposeService;
export const mockTenantService = {} as TenantService;
export const mockReadModelService = {} as ReadModelService;

export const api = await createApp(
  {
    agreementService: mockAgreementService,
    attributeService: mockAttributeService,
    authorizationService: mockAuthorizationService,
    catalogService: mockCatalogService,
    notifierEventsService: mockNotifierEventsService,
    purposeService: mockPurposeService,
    tenantService: mockTenantService,
    readModelService: mockReadModelService,
  },
  (_req, _res, next): void => next()
);
