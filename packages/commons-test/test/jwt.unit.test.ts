/* eslint-disable @typescript-eslint/no-non-null-assertion */
import jwt from "jsonwebtoken";
import {
  InternalAuthData,
  InteropJwtCommonPayload,
  InteropJwtMaintenancePayload,
  M2MAdminAuthData,
  M2MAuthData,
  MaintenanceAuthData,
  readAuthDataFromJwtToken,
  SerializedInteropJwtApiPayload,
  SerializedInteropJwtInternalPayload,
  SerializedInteropJwtUIPayload,
  systemRole,
  UIAuthData,
  userRole,
} from "pagopa-interop-commons";
import { invalidClaim, unsafeBrandId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import {
  createPayload,
  createUserPayload,
  signPayload,
} from "../src/mockedPayloadForToken.js";
import { randomSubArray } from "../src/testUtils.js";

const mockUiTokenPaylod = createUserPayload();
const expectedUiAuthData: UIAuthData = {
  systemRole: undefined,
  externalId: {
    origin: "IPA",
    value: "5N2TR557",
  },
  selfcareId: mockUiTokenPaylod.selfcareId,
  organizationId: mockUiTokenPaylod.organizationId,
  userId: mockUiTokenPaylod.uid,
  userRoles: [userRole.SECURITY_ROLE, userRole.API_ROLE],
};

const mockM2MTokenPayload: SerializedInteropJwtApiPayload = createPayload(
  systemRole.M2M_ROLE
);

const expectedM2MAuthData: M2MAuthData = {
  systemRole: systemRole.M2M_ROLE,
  organizationId: mockM2MTokenPayload.organizationId,
};

const mockInternalTokenPayload: SerializedInteropJwtInternalPayload =
  createPayload(systemRole.INTERNAL_ROLE);

const expectedInternalAuthData: InternalAuthData = {
  systemRole: systemRole.INTERNAL_ROLE,
};

const mockMaintenanceTokenPayload: InteropJwtMaintenancePayload = createPayload(
  systemRole.MAINTENANCE_ROLE
);

const expectedMaintenanceAuthData: MaintenanceAuthData = {
  systemRole: systemRole.MAINTENANCE_ROLE,
};

const mockSupportTokenPayload: SerializedInteropJwtUIPayload = createPayload(
  userRole.SUPPORT_ROLE
);

const expectedSupportAuthData: UIAuthData = {
  systemRole: undefined,
  externalId: {
    origin: "IPA",
    value: "5N2TR557",
  },
  selfcareId: mockSupportTokenPayload.selfcareId,
  organizationId: mockSupportTokenPayload.organizationId,
  userId: mockSupportTokenPayload.uid,
  userRoles: [userRole.SUPPORT_ROLE],
};

const mockM2MAdminTokenPayload: SerializedInteropJwtApiPayload = {
  ...mockM2MTokenPayload,
  role: systemRole.M2M_ADMIN_ROLE,
  adminId: unsafeBrandId("f07ddb8f-17f9-47d4-b31e-35d1ac10e521"),
};

const expectedM2MAdminAuthData: M2MAdminAuthData = {
  systemRole: systemRole.M2M_ADMIN_ROLE,
  organizationId: mockM2MAdminTokenPayload.organizationId,
  userId: mockM2MAdminTokenPayload.adminId,
  clientId: mockM2MAdminTokenPayload.client_id,
};

const getClaimsName = (token: object): string[] => {
  const commonClaims = InteropJwtCommonPayload.safeParse(token);
  if (!commonClaims.success) {
    expect.fail(`Invalid token provided for test: ${commonClaims.error}`);
  }
  // Exclude 'iat' claim as it causes jwt.sign and jwt.decode functions
  // to fail with null values in the test execution context
  return Object.keys(commonClaims.data).filter((c) => c !== "iat");
};

describe("JWT tests", () => {
  describe("readAuthDataFromJwtToken", () => {
    it("should successfully read data from a UI token with a single user role", async () => {
      const tokenPayload = jwt.decode(
        signPayload({
          ...mockUiTokenPaylod,
          "user-roles": "admin",
        })
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
      const tokenPayload = jwt.decode(
        signPayload({
          ...mockUiTokenPaylod,
          "user-roles": userRoles.join(","),
        })
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
      const tokenPayload = jwt.decode(
        signPayload({
          ...mockUiTokenPaylod,
          "user-roles": "api,invalid-role",
        })
      );

      expect(() => {
        readAuthDataFromJwtToken(tokenPayload!);
      }).toThrowError(/.*Validation error: Invalid enum value.*/);
    });

    it("should fail reading auth data from a UI token with empty user roles", async () => {
      const tokenPayload = jwt.decode(
        signPayload({
          ...mockUiTokenPaylod,
          "user-roles": "",
        })
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
      const tokenPayload = jwt.decode(signPayload(mockM2MTokenPayload));

      expect(readAuthDataFromJwtToken(tokenPayload!)).toEqual(
        expectedM2MAuthData
      );
    });

    it("should successfully read auth data from a M2M admin token", async () => {
      const token = jwt.decode(signPayload(mockM2MAdminTokenPayload));

      expect(readAuthDataFromJwtToken(token!)).toEqual(
        expectedM2MAdminAuthData
      );
    });

    describe("Missing claims in M2M Token", () => {
      it.each(getClaimsName(mockM2MTokenPayload))(
        "should fails if missing common claim %s",
        (claim) => {
          const invalidToken = { ...mockM2MTokenPayload };
          // eslint-disable-next-line fp/no-delete, functional/immutable-data
          delete invalidToken[claim as keyof typeof invalidToken];

          expect(() => {
            readAuthDataFromJwtToken(jwt.decode(signPayload(invalidToken))!);
          }).toThrowError(`Validation error: Required at "${claim}"`);
        }
      );
    });

    describe("Missing claims in Internal Token", () => {
      it.each(getClaimsName(mockInternalTokenPayload))(
        "should fails if missing common claim %s",
        (claim) => {
          const invalidToken = { ...mockInternalTokenPayload };
          // eslint-disable-next-line fp/no-delete, functional/immutable-data
          delete invalidToken[claim as keyof typeof invalidToken];

          // eslint-disable-next-line sonarjs/no-identical-functions
          expect(() => {
            readAuthDataFromJwtToken(jwt.decode(signPayload(invalidToken))!);
          }).toThrowError(`Validation error: Required at "${claim}"`);
        }
      );
    });

    describe("Missing claims in Maintenance Token", () => {
      it.each(getClaimsName(mockMaintenanceTokenPayload))(
        "should fails if missing common claim %s",
        (claim) => {
          const invalidToken = { ...mockMaintenanceTokenPayload };
          // eslint-disable-next-line fp/no-delete, functional/immutable-data
          delete invalidToken[claim as keyof typeof invalidToken];

          // eslint-disable-next-line sonarjs/no-identical-functions
          expect(() => {
            readAuthDataFromJwtToken(jwt.decode(signPayload(invalidToken))!);
          }).toThrowError(`Validation error: Required at "${claim}"`);
        }
      );
    });

    describe("Missing claims in UI Token", () => {
      it.each(getClaimsName(mockUiTokenPaylod))(
        "should fails if missing common claim %s",
        (claim) => {
          const invalidToken = { ...mockUiTokenPaylod };
          // eslint-disable-next-line fp/no-delete, functional/immutable-data
          delete invalidToken[claim as keyof typeof invalidToken];

          // eslint-disable-next-line sonarjs/no-identical-functions
          expect(() => {
            readAuthDataFromJwtToken(jwt.decode(signPayload(invalidToken))!);
          }).toThrowError(`Validation error: Required at "${claim}"`);
        }
      );
    });

    it.each([
      mockM2MTokenPayload,
      mockInternalTokenPayload,
      mockMaintenanceTokenPayload,
      mockUiTokenPaylod,
    ])("should fail if the 'aud' claim is an empty string", (token) => {
      const invalidToken = jwt.decode(
        signPayload({
          ...token,
          aud: "",
        })
      );

      expect(() => readAuthDataFromJwtToken(invalidToken!)).toThrowError(
        invalidClaim(
          'Validation error: String must contain at least 1 character(s) at "aud"'
        )
      );
    });

    it("should successfully read auth data from an Internal token", async () => {
      const tokenPayload = jwt.decode(signPayload(mockInternalTokenPayload));

      expect(readAuthDataFromJwtToken(tokenPayload!)).toEqual(
        expectedInternalAuthData
      );
    });

    it("should successfully read auth data from a Maintenance token", async () => {
      const tokenPayload = jwt.decode(signPayload(mockMaintenanceTokenPayload));

      expect(readAuthDataFromJwtToken(tokenPayload!)).toEqual(
        expectedMaintenanceAuthData
      );
    });

    it("should fail when the token is invalid", async () => {
      const tokenPayload = jwt.decode(
        signPayload({
          role: "invalid-role",
        })
      );

      expect(() => readAuthDataFromJwtToken(tokenPayload!)).toThrowError(
        /Validation error: Invalid discriminator value.*/
      );
    });

    it("should successfully read auth data from a Support token", async () => {
      const tokenPayload = jwt.decode(signPayload(mockSupportTokenPayload));

      expect(readAuthDataFromJwtToken(tokenPayload!)).toEqual(
        expectedSupportAuthData
      );
    });

    it("should fail reading auth data from a Support token with invalid user roles", async () => {
      const tokenPayload = jwt.decode(
        signPayload({
          ...mockSupportTokenPayload,
          "user-roles": "support,invalid-role",
        })
      );

      expect(() => {
        readAuthDataFromJwtToken(tokenPayload!);
      }).toThrowError(/.*Validation error: Invalid enum value.*/);
    });

    it("should also accept audience as a JSON array", async () => {
      const tokenPayload = jwt.decode(
        signPayload({
          ...mockUiTokenPaylod,
          aud: ["dev.interop.pagopa.it/ui", "interop.pagopa.it/ui"],
        })
      );

      const authData = readAuthDataFromJwtToken(tokenPayload!);

      expect(authData).toMatchObject(expectedUiAuthData);
    });
  });
});
