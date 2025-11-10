import { constants } from "http2";
import { fail } from "assert";
import { expect, describe, it, vi, afterEach } from "vitest";
import { InteropTokenGenerator, RateLimiter } from "pagopa-interop-commons";
import {
  ApiError,
  CorrelationId,
  generateId,
  invalidClaim,
  SelfcareId,
  TenantId,
} from "pagopa-interop-models";
import {
  getMockAuthData,
  getMockContext,
  getMockSessionClaims,
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

const validSelfcareId = generateId<SelfcareId>();
const selfcareIdNotFound = generateId<SelfcareId>();
const selfcareIdTokenLoginNotAllowed = generateId<SelfcareId>();

const validIdentityToken = "validIdentityToken";

const identityTokenTenantNotFound = "identityTokenTenantNotFound";
const identityTokenTenantLoginNotAllowed = "identityTokenTenantLoginNotAllowed";
const invalidTokenMissingUserRole = "missingUserRoleToken";

const sessionToken = "test-session-token";
const internalToken = "test-internal-token";

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

const rateLimiterStatus = {
  remaining: 100,
  reset: 1000,
  retryAfter: 1000,
};

// Mock implementation returns differents claims for each defined mock token
const verifyJwtTokenMockFn = vi.fn().mockImplementation((token: string) =>
  match(token)
    .with(validIdentityToken, () => ({
      decoded: getMockSessionClaims(validSelfcareId),
    }))
    .with(identityTokenTenantNotFound, () => ({
      decoded: getMockSessionClaims(selfcareIdNotFound),
    }))
    .with(identityTokenTenantLoginNotAllowed, () => ({
      decoded: getMockSessionClaims(selfcareIdTokenLoginNotAllowed),
    }))
    .with(invalidTokenMissingUserRole, () => ({
      decoded: getMockSessionClaims(validSelfcareId, []),
    }))
    .otherwise(() => ({
      error: JWT_PARSING_ERROR_MSG,
    }))
);

// Mocking verifyJwtToken function it's not scope of this test
vi.doMock("pagopa-interop-commons", async (originalImports) => ({
  // The `as` is needed (though the linter reports it as unneeded) for the `...` to pass type checking
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  ...((await originalImports()) as object),
  verifyJwtToken: verifyJwtTokenMockFn,
}));

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
              id: req.params.selfcareId,
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
    rateLimiterStatus,
  })),
} as unknown as RateLimiter;

// Using dynamic import to ensure that the pagopa-interop-commons mock is applied
const { authorizationServiceBuilder } = await import(
  "../src/services/authorizationService.js"
);

const authorizationService = authorizationServiceBuilder(
  interopTokenGeneratorMock,
  tenantProcessClientMock,
  [validSelfcareId],
  rateLimiterMock
);

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

afterEach(() => {
  verifyJwtTokenMockFn.mockClear();
});

describe("getSessionToken", async () => {
  it("should return a session token", async () => {
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
        rateLimiterStatus,
      },
    });
  });

  it("should throw invalidClaim error if the identity token is invalid", async () => {
    try {
      await authorizationService.getSessionToken(
        "genericInvalidToken",
        mockContext
      );
      fail("Expected invalidClaim error to be thrown ");
    } catch (error) {
      // In this case we want to check that the error is an instance of ApiError
      // and not the specifc error returned by Zod validation
      const expectedError = invalidClaim(JWT_PARSING_ERROR_MSG);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        code: expectedError.code,
        title: expectedError.title,
      });
    }
  });
  it("should throw missingUserRolesInIdentityToken error if missing userRoles in JWT", async () => {
    await expect(
      authorizationService.getSessionToken(
        invalidTokenMissingUserRole,
        mockContext
      )
    ).rejects.toThrowError(missingUserRolesInIdentityToken());
  });

  it("should throw tenantBySelfcareIdNotFound error if tenant not found by selfcareId", async () => {
    await expect(
      authorizationService.getSessionToken(
        identityTokenTenantNotFound,
        mockContext
      )
    ).rejects.toThrowError(tenantBySelfcareIdNotFound(selfcareIdNotFound));
  });

  it("should throw tenantLoginNotAllowed error if tenant's origin not allowed and selfcare id not included in allowed list", async () => {
    await expect(
      authorizationService.getSessionToken(
        identityTokenTenantLoginNotAllowed,
        mockContext
      )
    ).rejects.toThrowError(
      tenantLoginNotAllowed(selfcareIdTokenLoginNotAllowed)
    );
  });
});
