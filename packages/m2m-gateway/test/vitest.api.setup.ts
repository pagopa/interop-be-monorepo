/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, vi } from "vitest";
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
  jwtFromAuthHeader,
  genericLogger,
  readAuthDataFromJwtToken,
  decodeJwtToken,
  AppContext,
  rateLimiterMiddleware,
  RateLimiter,
} from "pagopa-interop-commons";
import { mockM2MAdminUserId } from "pagopa-interop-commons-test";
import { createApp } from "../src/app.js";
import { AgreementService } from "../src/services/agreementService.js";
import { AttributeService } from "../src/services/attributeService.js";
import { ClientService } from "../src/services/clientService.js";
import { DelegationService } from "../src/services/delegationService.js";
import { EserviceService } from "../src/services/eserviceService.js";
import { EserviceTemplateService } from "../src/services/eserviceTemplateService.js";
import { PurposeService } from "../src/services/purposeService.js";
import { TenantService } from "../src/services/tenantService.js";
import { KeyService } from "../src/services/keyService.js";
import { ProducerKeychainService } from "../src/services/producerKeychainService.js";
import { EventService } from "../src/services/eventService.js";

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

export const mockGetClientAdminId = vi
  .fn()
  .mockResolvedValue(mockM2MAdminUserId);

beforeEach(() => {
  mockGetClientAdminId.mockClear();
});

export const mockClientService = {
  getClientAdminId: mockGetClientAdminId,
} as unknown as ClientService;
// ^ Mocking getClientAdminId here to make the m2m auth data validation middleware
// pass in all the api tests

/*
Don't mock any other method in the following services here.
Mock directly in the test files, only the methods you need.
*/
export const mockDelegationService = {} as DelegationService;
export const mockPurposeService = {} as PurposeService;
export const mockTenantService = {} as TenantService;
export const mockAttributeService = {} as AttributeService;
export const mockEServiceTemplateService = {} as EserviceTemplateService;
export const mockAgreementService = {} as AgreementService;
export const mockEserviceService = {} as EserviceService;
export const mockKeyService = {} as KeyService;
export const mockProducerKeychainService = {} as ProducerKeychainService;
export const mockEventService = {} as EventService;

export const api = await createApp(
  {
    agreementService: mockAgreementService,
    attributeService: mockAttributeService,
    clientService: mockClientService,
    delegationService: mockDelegationService,
    eserviceTemplateService: mockEServiceTemplateService,
    eserviceService: mockEserviceService,
    purposeService: mockPurposeService,
    tenantService: mockTenantService,
    keyService: mockKeyService,
    producerKeychainService: mockProducerKeychainService,
    eventService: mockEventService,
  },
  rateLimiterMiddleware(mockRateLimiter)
);
