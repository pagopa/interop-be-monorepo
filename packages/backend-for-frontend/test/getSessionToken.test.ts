import { constants } from "http2";
import { fail } from "assert";
import { expect, describe, it, vi, afterEach } from "vitest";
import { InteropTokenGenerator, RateLimiter } from "pagopa-interop-commons";
import {
  ApiError,
  CorrelationId,
  generateId,
  invalidClaim,
  TenantId,
} from "pagopa-interop-models";
import {
  getMockAuthData,
  getMockContext,
  getMockJWTClaims,
} from "pagopa-interop-commons-test";
import { match } from "ts-pattern";
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { TenantProcessClient } from "../src/clients/clientsProvider.js";
import {
  missingUserRolesInIdentityToken,
  tenantBySelfcareIdNotFound,
  tenantLoginNotAllowed,
} from "../src/model/errors.js";
const { HTTP_STATUS_NOT_FOUND } = constants;

const JWT_PARSING_ERROR_MSG = "Validation error: Required";

const validSelfcareId = generateId<TenantId>();
const validIdentityToken = "validIdentityToken";

const selfcareIdNotFound = "TENANT_BY_SELFCARE_NOT_FOUND";
const identityTokenTenantNotFound = "identityTokenTenantNotFound";

const sessionToken = "test-session-token";
const internalToken = "test-internal-token";

const invalidTokenMissingUserRole = "missingUserRoleToken";

const tenantNotFoundAxiosApiError = new AxiosError(
  "Tenant Not Found",
  "404",
  undefined,
  undefined,
  {
    status: HTTP_STATUS_NOT_FOUND,
    data: {},
    statusText: "Not Found",
    config: {} as InternalAxiosRequestConfig,
    headers: {},
  }
);

const reateLimiterStatus = {
  remaining: 100,
  reset: 1000,
  retryAfter: 1000,
};

// Mock implementation returns differents claims for each defined mock tokens
const verifyJwtTokenMockFn = vi.fn().mockImplementation((token: string) =>
  match(token)
    .with(validIdentityToken, () => ({
      decoded: getMockJWTClaims({ id: validSelfcareId }),
    }))
    .with(identityTokenTenantNotFound, () => {
      const claims = getMockJWTClaims({ id: selfcareIdNotFound });
      return {
        decoded: {
          ...claims,
          organization: {
            ...claims.organization,
            id: selfcareIdNotFound,
          },
        },
      };
    })
    .with(invalidTokenMissingUserRole, () => {
      const claims = getMockJWTClaims({ id: validSelfcareId });
      return {
        decoded: {
          ...claims,
          organization: {
            ...claims.organization,
            roles: [],
          },
        },
      };
    })
    .otherwise(() => ({
      error: JWT_PARSING_ERROR_MSG,
    }))
);

// Mocking verifyJwtToken function it's not scope of this test
vi.doMock("pagopa-interop-commons", async (originalImports) => {
  const actual: object = await originalImports();
  return {
    ...actual,
    verifyJwtToken: verifyJwtTokenMockFn,
  };
});

describe("getSessionToken", async () => {
  const { authorizationServiceBuilder } = await import(
    "../src/services/authorizationService.js"
  );

  const tenantProcessClientMock: TenantProcessClient = {
    selfcare: {
      getTenantBySelfcareId: vi
        .fn()
        .mockImplementation((req: { params: { selfcareId: string } }) =>
          match(req.params.selfcareId)
            .with(selfcareIdNotFound, () =>
              Promise.reject(tenantNotFoundAxiosApiError)
            )
            .otherwise(() =>
              Promise.resolve({
                id: validSelfcareId,
                externalId: {
                  origin: "ipa",
                  value: "ipa-value",
                },
              })
            )
        ),
    },
  } as unknown as TenantProcessClient;

  const interopTokenGeneratorMock = {
    generateSessionToken: vi.fn().mockReturnValue({
      serialized: sessionToken,
    }),
    generateInternalToken: vi.fn().mockReturnValue({
      serialized: internalToken,
    }),
  } as unknown as InteropTokenGenerator;

  const rateLimiterMock = {
    rateLimitByOrganization: vi.fn().mockImplementation((tenantId: string) => ({
      limitReached: false,
      rateLimitedTenantId: tenantId,
      rateLimiterStatus: reateLimiterStatus,
    })),
  } as unknown as RateLimiter;

  afterEach(() => {
    verifyJwtTokenMockFn.mockClear();
  });

  const authData = getMockAuthData(generateId<TenantId>());
  const headers = {
    "X-Correlation-Id": generateId<CorrelationId>(),
    "X-Forwarded-For": "test-ip",
    Authorization: `Bearer test-token`,
  };
  const mockContext = {
    ...getMockContext({ authData }),
    headers,
  };

  it("should return a session token", async () => {
    const authorizationService = authorizationServiceBuilder(
      interopTokenGeneratorMock,
      tenantProcessClientMock,
      [validSelfcareId],
      rateLimiterMock
    );

    const result = await authorizationService.getSessionToken(
      validIdentityToken,
      mockContext
    );

    expect(result).toMatchObject({
      limitReached: false,
      sessionToken: {
        session_token: sessionToken,
      },
      rateLimiterStatus: {
        rateLimitedTenantId: validSelfcareId,
        rateLimiterStatus: reateLimiterStatus,
      },
    });
  });

  it("should throw invalidClaim error if the identity token is invalid", async () => {
    const authorizationService = authorizationServiceBuilder(
      interopTokenGeneratorMock,
      tenantProcessClientMock,
      [validSelfcareId],
      rateLimiterMock
    );

    try {
      await authorizationService.getSessionToken(
        "genericInvalidToken",
        mockContext
      );
      fail("Expected invalidClaim error to be thrown ");
    } catch (error) {
      // In this case we want to check that the error is an instance of ApiError
      // and not specifc error during zod validation
      const expectedError = invalidClaim(JWT_PARSING_ERROR_MSG);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        code: expectedError.code,
        title: expectedError.title,
      });
    }
  });
  it("should throw missingUserRolesInIdentityToken error if missing userRoles in JWT", async () => {
    const authorizationService = authorizationServiceBuilder(
      interopTokenGeneratorMock,
      tenantProcessClientMock,
      [validSelfcareId],
      rateLimiterMock
    );

    await expect(
      authorizationService.getSessionToken(
        invalidTokenMissingUserRole,
        mockContext
      )
    ).rejects.toThrowError(missingUserRolesInIdentityToken());
  });

  it("should throw tenantBySelfcareIdNotFound error if tenant not found by selfcareId", async () => {
    const authorizationService = authorizationServiceBuilder(
      interopTokenGeneratorMock,
      tenantProcessClientMock,
      [validSelfcareId],
      rateLimiterMock
    );

    await expect(
      authorizationService.getSessionToken(
        identityTokenTenantNotFound,
        mockContext
      )
    ).rejects.toThrowError(tenantBySelfcareIdNotFound(selfcareIdNotFound));
  });

  it("should throw tenantLoginNotAllowed error if tenant's origin not allowed and selfcare id not included in allowed list", async () => {
    vi.doMock("../config/config.js", async (originalImports) => {
      const actual: object = await originalImports();
      return {
        ...actual,
        tenantAllowedOrigins: ["a-different-origin"],
      };
    });

    const authorizationService = authorizationServiceBuilder(
      interopTokenGeneratorMock,
      tenantProcessClientMock,
      ["another-selfecareId-allowed"],
      rateLimiterMock
    );

    await expect(
      authorizationService.getSessionToken(validIdentityToken, mockContext)
    ).rejects.toThrowError(tenantLoginNotAllowed(validSelfcareId));
  });
});
