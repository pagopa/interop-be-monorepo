import { fail } from "assert";
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { constants } from "http2";
import { InteropTokenGenerator, RateLimiter } from "pagopa-interop-commons";
import {
  getMockAuthData,
  getMockContext,
  getMockSessionClaims,
} from "pagopa-interop-commons-test";
import {
  ApiError,
  CorrelationId,
  generateId,
  invalidClaim,
  SelfcareId,
  TenantId,
  UserId,
  userRole,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { expect, describe, it, vi, afterEach } from "vitest";

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

const identityTokenJti = "identity-token-jti";
const identityTokenUid = generateId<UserId>();

const b64UrlEncode = (payload: object): string =>
  Buffer.from(JSON.stringify(payload)).toString("base64url");

// The signature is irrelevant, verifyJwtToken is mocked below
const jwtShapedIdentityToken = (claims: object): string =>
  [
    b64UrlEncode({ alg: "RS256", typ: "JWT" }),
    b64UrlEncode(claims),
    "signature",
  ].join(".");

const validIdentityToken = jwtShapedIdentityToken({
  jti: identityTokenJti,
  uid: identityTokenUid,
});

// Not among the tokens known by the verifyJwtToken mock, so its verification fails
const unverifiableIdentityTokenJti = "unverifiable-identity-token-jti";
const unverifiableIdentityToken = jwtShapedIdentityToken({
  jti: unverifiableIdentityTokenJti,
  uid: identityTokenUid,
});

const identityTokenWithForgingClaims = jwtShapedIdentityToken({
  jti: `${identityTokenJti}\nForged log line`,
  uid: identityTokenUid,
});

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
      decoded: getMockSessionClaims([userRole.ADMIN_ROLE], validSelfcareId),
    }))
    .with(identityTokenTenantNotFound, () => ({
      decoded: getMockSessionClaims([userRole.ADMIN_ROLE], selfcareIdNotFound),
    }))
    .with(identityTokenTenantLoginNotAllowed, () => ({
      decoded: getMockSessionClaims(
        [userRole.ADMIN_ROLE],
        selfcareIdTokenLoginNotAllowed
      ),
    }))
    .with(invalidTokenMissingUserRole, () => ({
      decoded: getMockSessionClaims([], validSelfcareId),
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
const { authorizationServiceBuilder } =
  await import("../src/services/authorizationService.js");

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
  // The context logger is shared, its spies must not leak into other tests
  vi.restoreAllMocks();
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

  it("should log the jti and uid claims of the identity token", async () => {
    const loggerSpy = vi.spyOn(mockContext.logger, "info");

    await authorizationService.getSessionToken(validIdentityToken, mockContext);

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `[JTI=${identityTokenJti}][UID=${identityTokenUid}]`
      )
    );
  });

  it("should log the identity token claims before verifying it, so that failed exchanges are traced too", async () => {
    const loggerSpy = vi.spyOn(mockContext.logger, "info");

    await expect(
      authorizationService.getSessionToken(
        unverifiableIdentityToken,
        mockContext
      )
    ).rejects.toThrowError();

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `[JTI=${unverifiableIdentityTokenJti}][UID=${identityTokenUid}]`
      )
    );
  });

  it("should not log identity token claims that could forge log lines", async () => {
    const infoSpy = vi.spyOn(mockContext.logger, "info");

    await expect(
      authorizationService.getSessionToken(
        identityTokenWithForgingClaims,
        mockContext
      )
    ).rejects.toThrowError();

    // The jti carries a newline, so it is discarded, while the uid is still logged
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining(`[JTI=undefined][UID=${identityTokenUid}]`)
    );
    expect(infoSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Forged log line")
    );
  });

  it("should not fail the exchange when the identity token claims cannot be read", async () => {
    const loggerSpy = vi.spyOn(mockContext.logger, "warn");

    // This token is not JWT shaped: the exchange must still fail on its own
    // validation, not on the logging
    await expect(
      authorizationService.getSessionToken(
        identityTokenTenantLoginNotAllowed,
        mockContext
      )
    ).rejects.toThrowError(
      tenantLoginNotAllowed(selfcareIdTokenLoginNotAllowed)
    );

    expect(loggerSpy).toHaveBeenCalledWith(
      "No loggable jti and uid claims in the identity token"
    );
  });
});
