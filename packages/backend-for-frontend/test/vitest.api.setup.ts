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
    rateLimiterMiddleware: vi.fn(
      () =>
        async (
          _req: Request,
          _res: Response,
          next: NextFunction
        ): Promise<unknown> =>
          next()
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
import { AgreementService } from "../src/services/agreementService.js";
import { AttributeService } from "../src/services/attributeService.js";
import { AuthorizationService } from "../src/services/authorizationService.js";
import { CatalogService } from "../src/services/catalogService.js";
import { ClientService } from "../src/services/clientService.js";
import { DelegationService } from "../src/services/delegationService.js";
import { EServiceTemplateService } from "../src/services/eserviceTemplateService.js";
import { ProducerKeychainService } from "../src/services/producerKeychainService.js";
import { PurposeService } from "../src/services/purposeService.js";
import { SelfcareService } from "../src/services/selfcareService.js";
import { TenantService } from "../src/services/tenantService.js";
import { ToolsService } from "../src/services/toolService.js";
import { createApp } from "../src/app.js";

export const agreementService = {} as AgreementService;
export const attributeService = {} as AttributeService;
export const authorizationService = {} as AuthorizationService;
export const authorizationServiceForSupport = {} as AuthorizationService;
export const catalogService = {} as CatalogService;
export const clientService = {} as ClientService;
export const delegationService = {} as DelegationService;
export const eServiceTemplateService = {} as EServiceTemplateService;
export const producerKeychainService = {} as ProducerKeychainService;
export const purposeService = {} as PurposeService;
export const selfcareService = {} as SelfcareService;
export const tenantService = {} as TenantService;
export const toolsService = {} as ToolsService;

export const api = await createApp(
  {
    agreementService,
    attributeService,
    authorizationService,
    authorizationServiceForSupport,
    catalogService,
    clientService,
    delegationService,
    eServiceTemplateService,
    producerKeychainService,
    purposeService,
    selfcareService,
    tenantService,
    toolsService,
  },
  (_req, _res, next): void => next()
);
