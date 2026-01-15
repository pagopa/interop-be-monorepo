/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  decodeJwtToken,
  genericLogger,
  InternalAuthData,
  InteropJwtCommonPayload,
  InteropJwtMaintenancePayload,
  M2MAdminAuthData,
  M2MAuthData,
  M2MDPoPAuthData,
  MaintenanceAuthData,
  readAuthDataFromJwtToken,
  SerializedInteropJwtApiPayload,
  SerializedInteropJwtInternalPayload,
  SerializedInteropJwtUIPayload,
  systemRole,
  UIAuthData,
  UserRole,
  userRole,
} from "pagopa-interop-commons";
import { invalidClaim } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  createDPoPPayload,
  createPayload,
  createUserPayload,
  mockM2MAdminUserId,
  signPayload,
} from "../src/mockedPayloadForToken.js";
import { randomSubArray } from "../src/testUtils.js";

const mockUiTokenPaylod = createUserPayload(
  [userRole.SECURITY_ROLE, userRole.API_ROLE].join(",")
);
const expectedUiAuthData: UIAuthData = {
  systemRole: undefined,
  externalId: {
    origin: "IPA",
    value: "5N2TR557",
  },
  jti: mockUiTokenPaylod.jti,
  selfcareId: mockUiTokenPaylod.selfcareId,
  organizationId: mockUiTokenPaylod.organizationId,
  userId: mockUiTokenPaylod.uid,
  userRoles: mockUiTokenPaylod["user-roles"].split(",") as UserRole[],
};

const mockM2MTokenPayload: SerializedInteropJwtApiPayload = createPayload(
  systemRole.M2M_ROLE
);

const mockM2MDPoPTokenPayload: SerializedInteropJwtApiPayload =
  createDPoPPayload(systemRole.M2M_ROLE);

const expectedM2MAuthData: M2MAuthData = {
  clientId: mockM2MTokenPayload.client_id,
  systemRole: systemRole.M2M_ROLE,
  jti: mockM2MTokenPayload.jti,
  organizationId: mockM2MTokenPayload.organizationId,
};

const expectedM2MDPoPAuthData: M2MDPoPAuthData = {
  clientId: mockM2MDPoPTokenPayload.client_id,
  systemRole: systemRole.M2M_ROLE,
  jti: mockM2MDPoPTokenPayload.jti,
  organizationId: mockM2MDPoPTokenPayload.organizationId,
  cnf: { jkt: "dummy-jkt-value" },
};

const mockInternalTokenPayload: SerializedInteropJwtInternalPayload =
  createPayload(systemRole.INTERNAL_ROLE);

const expectedInternalAuthData: InternalAuthData = {
  jti: mockInternalTokenPayload.jti,
  systemRole: systemRole.INTERNAL_ROLE,
};

const mockMaintenanceTokenPayload: InteropJwtMaintenancePayload = createPayload(
  systemRole.MAINTENANCE_ROLE
);

const expectedMaintenanceAuthData: MaintenanceAuthData = {
  jti: mockMaintenanceTokenPayload.jti,
  systemRole: systemRole.MAINTENANCE_ROLE,
};

const mockSupportTokenPayload: SerializedInteropJwtUIPayload = createPayload(
  userRole.SUPPORT_ROLE
);

const expectedSupportAuthData: UIAuthData = {
  systemRole: undefined,
  jti: mockSupportTokenPayload.jti,
  externalId: {
    origin: "IPA",
    value: "5N2TR557",
  },
  selfcareId: mockSupportTokenPayload.selfcareId,
  organizationId: mockSupportTokenPayload.organizationId,
  userId: mockSupportTokenPayload.uid,
  userRoles: [userRole.SUPPORT_ROLE],
};

const mockM2MAdminTokenPayload: SerializedInteropJwtApiPayload = createPayload(
  systemRole.M2M_ADMIN_ROLE
);

const expectedM2MAdminAuthData: M2MAdminAuthData = {
  systemRole: systemRole.M2M_ADMIN_ROLE,
  jti: mockM2MAdminTokenPayload.jti,
  organizationId: mockM2MAdminTokenPayload.organizationId,
  userId: mockM2MAdminUserId,
  clientId: mockM2MAdminTokenPayload.client_id,
};

const getClaimsName = (token: object): string[] => {
  const commonClaims = InteropJwtCommonPayload.safeParse(token);
  if (!commonClaims.success) {
    expect.fail(`Invalid token provided for test: ${commonClaims.error}`);
  }
  return Object.keys(commonClaims.data);
};

const expectMissingClaimError =
  (payload: object) =>
  (claim: string): void => {
    /*
     * NOTE: "iat" claim cannot be deleted, it's mandatory for the token signature by
     * jwt.sign method in method signPayload used to prepare test's inputs,
     * function "decodeJwtToken" accepts a signed JWT token as string,
     * so this test will skip the check for this case.
     */
    if (claim === "iat") {
      return;
    }

    const invalidToken = { ...payload };
    // eslint-disable-next-line fp/no-delete, functional/immutable-data
    delete invalidToken[claim as keyof typeof invalidToken];

    expect(() => {
      readAuthDataFromJwtToken(
        decodeJwtToken(signPayload(invalidToken), genericLogger)!
      );
    }).toThrowError(`Validation error: Required at "${claim}"`);
  };

describe("JWT tests", () => {
  describe("readAuthDataFromJwtToken", () => {
    it("should successfully read data from a UI token with a single user role", async () => {
      const tokenPayload = decodeJwtToken(
        signPayload({
          ...mockUiTokenPaylod,
          "user-roles": "admin",
        }),
        genericLogger
      );

      const expectedUIAuthData: UIAuthData = {
        ...expectedUiAuthData,
        userRoles: ["admin"],
      };

      expect(readAuthDataFromJwtToken(tokenPayload!)).toEqual(
        expectedUIAuthData
      );
    });

    it("should successfully read auth data from a UI token with multiple comma separated user roles", async () => {
      // constant contains a randomically number of user roles picked from the enum UserRole
      const userRoles = randomSubArray(Object.values(userRole));
      const tokenPayload = decodeJwtToken(
        signPayload({
          ...mockUiTokenPaylod,
          "user-roles": userRoles.join(","),
        }),
        genericLogger
      );

      const expectedUIAuthData: UIAuthData = {
        ...expectedUiAuthData,
        userRoles,
      };

      expect(readAuthDataFromJwtToken(tokenPayload!)).toEqual(
        expectedUIAuthData
      );
    });

    it("should fail reading auth data from a UI token with invalid user roles", async () => {
      const tokenPayload = decodeJwtToken(
        signPayload({
          ...mockUiTokenPaylod,
          "user-roles": "api,invalid-role",
        }),
        genericLogger
      );

      expect(() => {
        readAuthDataFromJwtToken(tokenPayload!);
      }).toThrowError(/.*Validation error: .*Invalid enum value.*/);
    });

    it("should fail reading auth data from a UI token with empty user roles", async () => {
      const tokenPayload = decodeJwtToken(
        signPayload({
          ...mockUiTokenPaylod,
          "user-roles": "",
        }),
        genericLogger
      );

      expect(() => {
        readAuthDataFromJwtToken(tokenPayload!);
      }).toThrowError(
        invalidClaim(
          'Validation error: String must contain at least 1 character(s) at "user-roles"'
        )
      );
    });

    it("should successfully read auth data from a M2M token", async () => {
      const tokenPayload = decodeJwtToken(
        signPayload(mockM2MTokenPayload),
        genericLogger
      );

      expect(readAuthDataFromJwtToken(tokenPayload!)).toEqual(
        expectedM2MAuthData
      );
    });

    it.only("should successfully read auth data from a M2M token DPoP bound", async () => {
      const tokenPayload = decodeJwtToken(
        signPayload(mockM2MDPoPTokenPayload),
        genericLogger
      );

      expect(readAuthDataFromJwtToken(tokenPayload!)).toEqual(
        expectedM2MDPoPAuthData
      );
    });

    it("should successfully read auth data from a M2M admin token", async () => {
      const token = decodeJwtToken(
        signPayload(mockM2MAdminTokenPayload),
        genericLogger
      );

      expect(readAuthDataFromJwtToken(token!)).toEqual(
        expectedM2MAdminAuthData
      );
    });

    describe("Missing claims in M2M Token", () => {
      it.each(getClaimsName(mockM2MTokenPayload))(
        "should fails if missing common claim %s",
        expectMissingClaimError(mockM2MTokenPayload)
      );
    });

    describe("Missing claims in Internal Token", () => {
      it.each(getClaimsName(mockInternalTokenPayload))(
        "should fails if missing common claim %s",
        expectMissingClaimError(mockInternalTokenPayload)
      );
    });

    describe("Missing claims in Maintenance Token", () => {
      it.each(getClaimsName(mockMaintenanceTokenPayload))(
        "should fails if missing common claim %s",
        expectMissingClaimError(mockMaintenanceTokenPayload)
      );
    });

    describe("Missing claims in UI Token", () => {
      it.each(getClaimsName(mockUiTokenPaylod))(
        "should fails if missing common claim %s",
        expectMissingClaimError(mockUiTokenPaylod)
      );
    });

    it.each([
      mockM2MTokenPayload,
      mockInternalTokenPayload,
      mockMaintenanceTokenPayload,
      mockUiTokenPaylod,
    ])("should fail if the 'aud' claim is an empty string", (token) => {
      const invalidToken = decodeJwtToken(
        signPayload({
          ...token,
          aud: "",
        }),
        genericLogger
      );

      expect(() => readAuthDataFromJwtToken(invalidToken!)).toThrowError(
        invalidClaim(
          'Validation error: String must contain at least 1 character(s) at "aud"'
        )
      );
    });

    it("should successfully read auth data from an Internal token", async () => {
      const tokenPayload = decodeJwtToken(
        signPayload(mockInternalTokenPayload),
        genericLogger
      );

      expect(readAuthDataFromJwtToken(tokenPayload!)).toEqual(
        expectedInternalAuthData
      );
    });

    it("should successfully read auth data from a Maintenance token", async () => {
      const tokenPayload = decodeJwtToken(
        signPayload(mockMaintenanceTokenPayload),
        genericLogger
      );

      expect(readAuthDataFromJwtToken(tokenPayload!)).toEqual(
        expectedMaintenanceAuthData
      );
    });

    it("should fail when the token is invalid", async () => {
      const tokenPayload = decodeJwtToken(
        signPayload({
          role: "invalid-role",
        }),
        genericLogger
      );

      expect(() => readAuthDataFromJwtToken(tokenPayload!)).toThrowError(
        /Validation error: .*Invalid literal value.*/
      );
    });

    it("should successfully read auth data from a Support token", async () => {
      const tokenPayload = decodeJwtToken(
        signPayload(mockSupportTokenPayload),
        genericLogger
      );

      expect(readAuthDataFromJwtToken(tokenPayload!)).toEqual(
        expectedSupportAuthData
      );
    });

    it("should fail reading auth data from a Support token with invalid user roles", async () => {
      const tokenPayload = decodeJwtToken(
        signPayload({
          ...mockSupportTokenPayload,
          "user-roles": "support,invalid-role",
        }),
        genericLogger
      );

      expect(() => {
        readAuthDataFromJwtToken(tokenPayload!);
      }).toThrowError(/.*Validation error: .*Invalid enum value.*/);
    });

    it("should also accept audience as a JSON array", async () => {
      const tokenPayload = decodeJwtToken(
        signPayload({
          ...mockUiTokenPaylod,
          aud: ["dev.interop.pagopa.it/ui", "interop.pagopa.it/ui"],
        }),
        genericLogger
      );

      const authData = readAuthDataFromJwtToken(tokenPayload!);

      expect(authData).toMatchObject(expectedUiAuthData);
    });
  });
});
