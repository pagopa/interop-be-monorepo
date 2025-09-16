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
  applicationAuditEndSessionTokenExchangeMiddleware: vi.fn(
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
  RateLimiter,
  initFileManager,
  rateLimiterMiddleware,
} from "pagopa-interop-commons";
import { createApp, createServices } from "../src/app.js";
import {
  AgreementProcessClient,
  AttributeProcessClient,
  AuthorizationProcessClient,
  CatalogProcessClient,
  DelegationProcessClient,
  EServiceTemplateProcessClient,
  NotificationConfigProcessClient,
  PurposeProcessClient,
  SelfcareV2InstitutionClient,
  SelfcareV2UserClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";
import { config } from "../src/config/config.js";

export const mockRateLimiter: RateLimiter = {
  rateLimitByOrganization: vi.fn().mockResolvedValue({
    limitReached: false,
    maxRequests: 100,
    rateInterval: 1000,
    remainingRequests: 99,
  }),
  getCountByOrganization: vi.fn(),
  getBurstCountByOrganization: vi.fn(),
};

export const clients = {
  tenantProcessClient: {
    tenant: {},
    tenantAttribute: {},
    selfcare: {},
  } as TenantProcessClient,
  attributeProcessClient: {} as AttributeProcessClient,
  catalogProcessClient: {} as CatalogProcessClient,
  agreementProcessClient: {} as AgreementProcessClient,
  purposeProcessClient: {} as PurposeProcessClient,
  authorizationClient: {
    client: {},
    producerKeychain: {},
    user: {},
    token: {},
  } as AuthorizationProcessClient,
  selfcareV2InstitutionClient: {} as SelfcareV2InstitutionClient,
  selfcareV2UserClient: {} as SelfcareV2UserClient,
  delegationProcessClient: {
    producer: {},
    consumer: {},
    delegation: {},
  } as DelegationProcessClient,
  eserviceTemplateProcessClient: {} as EServiceTemplateProcessClient,
  notificationConfigProcessClient: {} as NotificationConfigProcessClient,
};

const fileManager = initFileManager(config);
const authorizationServiceAllowList: string[] = [];

export const services = await createServices(
  clients,
  fileManager,
  mockRateLimiter,
  authorizationServiceAllowList
);

export const api = await createApp(
  services,
  rateLimiterMiddleware(mockRateLimiter)
);
