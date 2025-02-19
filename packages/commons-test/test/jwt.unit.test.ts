/* eslint-disable functional/immutable-data */
import jwt, { JwtPayload } from "jsonwebtoken";
import { readAuthDataFromJwtToken } from "pagopa-interop-commons";
import { invalidClaim } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { randomArrayItem } from "../src/testUtils.js";

const mockUiToken = {
  iss: "dev.interop.pagopa.it",
  externalId: {
    origin: "IPA",
    value: "5N2TR557",
  },
  "user-roles": "security,api",
  selfcareId: "1962d21c-c701-4805-93f6-53a877898756",
  organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
  aud: "dev.interop.pagopa.it/ui",
  uid: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
  nbf: 1710841859,
  organization: {
    id: "1962d21c-c701-4805-93f6-53a877898756",
    name: "PagoPA S.p.A.",
    roles: [
      {
        partyRole: "MANAGER",
        role: "admin",
      },
    ],
    fiscal_code: "15376371009",
    ipaCode: "5N2TR557",
  },
  name: "Mario",
  exp: 1810511523,
  iat: 1710841859,
  family_name: "Rossi",
  jti: "e82bd774-9cac-4885-931b-015b2eb4e9a5",
  email: "m.rossi@psp.it",
};

const mockM2MToken = {
  organizationId: "89804b2c-f62e-4867-87a4-3a82f2b03485",
  aud: "refactor.dev.interop.pagopa.it/m2m",
  sub: "227cadc9-1a2c-4612-b100-a247b48d0464",
  role: "m2m",
  nbf: 1710511524,
  iss: "refactor.dev.interop.pagopa.it",
  exp: 1810511523,
  iat: 1710511524,
  client_id: "227cadc9-1a2c-4612-b100-a247b48d0464",
  jti: "d0c42cfb-8a32-430f-95cf-085067b52695",
};

const mockInternalToken = {
  aud: "refactor.dev.interop.pagopa.it/m2m",
  sub: "227cadc9-1a2c-4612-b100-a247b48d0464",
  role: "internal",
  nbf: 1710511524,
  iss: "refactor.dev.interop.pagopa.it",
  exp: 1810511523,
  iat: 1710511524,
  jti: "d0c42cfb-8a32-430f-95cf-085067b52695",
};

const mockMaintenanceToken = {
  aud: "refactor.dev.interop.pagopa.it/fake",
  sub: "227cadc9-1a2c-4612-b100-a247b48d0464",
  role: "maintenance",
  nbf: 1710511524,
  iss: "refactor.dev.interop.pagopa.it",
  exp: 1810511523,
  iat: 1710511524,
  jti: "d0c42cfb-8a32-430f-95cf-085067b52695",
};

const mockSupportToken = {
  iss: "refactor.dev.interop.pagopa.it",
  externalId: {
    origin: "IPA",
    value: "5N2TR557",
  },
  "user-roles": "support",
  selfcareId: "1962d21c-c701-4805-93f6-53a877898756",
  organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
  aud: "dev.interop.pagopa.it/ui",
  uid: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
  nbf: 1710841859,
  organization: {
    roles: [
      {
        role: "support",
      },
    ],
    id: "1962d21c-c701-4805-93f6-53a877898756",
    name: "PagoPA S.p.A.",
  },
  exp: 1810511523,
  iat: 1710841859,
  jti: "e82bd774-9cac-4885-931b-015b2eb4e9a5",
};

const getMockSignedToken = (token: object): string =>
  jwt.sign(token, "test-secret");

describe("JWT tests", () => {
  describe("verifyToken", () => {
    it("should successfully read data from a UI token with a single user role", async () => {
      const token = {
        ...mockUiToken,
        "user-roles": "admin",
      };
      const signedToken = getMockSignedToken(token);

      const decoded = jwt.decode(signedToken, { json: true });

      expect(decoded).toEqual(token);
    });

    it("should successfully read auth data from a UI token with multiple comma separated user roles", async () => {
      const token = {
        ...mockUiToken,
        "user-roles": "security,api",
      };
      const signedToken = getMockSignedToken(token);

      const decoded = jwt.decode(signedToken, { json: true });

      expect(decoded).toEqual(token);
    });

    it("should fail reading auth data from a UI token with invalid user roles", async () => {
      const signedToken = getMockSignedToken({
        ...mockUiToken,
        "user-roles": "api,invalid-role",
      });

      const decoded = jwt.decode(signedToken, { json: true });

      expect(() => {
        readAuthDataFromJwtToken(decoded as string | JwtPayload);
      }).toThrowError(
        invalidClaim(
          "Validation error: Invalid enum value. Expected 'admin' | 'security' | 'api' | 'support', received 'invalid-role' at \"user-roles[1]\""
        )
      );
    });

    it("should fail reading auth data from a UI token with empty user roles", async () => {
      const signedToken = getMockSignedToken({
        ...mockUiToken,
        "user-roles": "",
      });

      const decoded = jwt.decode(signedToken, { json: true });

      expect(() => {
        readAuthDataFromJwtToken(decoded as string | JwtPayload);
      }).toThrowError(
        invalidClaim(
          'Validation error: String must contain at least 1 character(s) at "user-roles"'
        )
      );
    });

    it("should successfully read auth data from a M2M token", async () => {
      const signedToken = getMockSignedToken(mockM2MToken);

      const decoded = jwt.decode(signedToken, { json: true });

      expect(decoded).toEqual(mockM2MToken);
    });

    it("should fail if some required fields are missing", async () => {
      const mockToken = randomArrayItem([
        mockUiToken,
        mockM2MToken,
        mockInternalToken,
        mockMaintenanceToken,
      ]);
      const signedToken = getMockSignedToken({
        ...mockToken,
        jti: undefined,
      });

      const decoded = jwt.decode(signedToken, { json: true });

      expect(() => {
        readAuthDataFromJwtToken(decoded as string | JwtPayload);
      }).toThrowError(invalidClaim(`Validation error: Required at "jti"`));
    });

    it("should fail if the aud field is an empty string", async () => {
      const mockToken = randomArrayItem([
        mockUiToken,
        mockM2MToken,
        mockInternalToken,
        mockMaintenanceToken,
      ]);
      const signedToken = getMockSignedToken({
        ...mockToken,
        aud: "",
      });

      const decoded = jwt.decode(signedToken, { json: true });

      expect(() => readAuthDataFromJwtToken(decoded!)).toThrowError(
        invalidClaim(
          'Validation error: String must contain at least 1 character(s) at "aud"'
        )
      );
    });

    it("should successfully read auth data from an Internal token", async () => {
      const signedToken = getMockSignedToken(mockInternalToken);

      const decoded = jwt.decode(signedToken, { json: true });

      expect(decoded).toEqual(mockInternalToken);
    });

    it("should successfully read auth data from a Maintenance token", async () => {
      const signedToken = getMockSignedToken(mockMaintenanceToken);

      const decoded = jwt.decode(signedToken, { json: true });

      expect(decoded).toEqual(mockMaintenanceToken);
    });

    it("should fail when the token is invalid", async () => {
      const signedToken = getMockSignedToken({
        role: "invalid-role",
      });

      const decoded = jwt.decode(signedToken, { json: true });

      expect(() => readAuthDataFromJwtToken(decoded!)).toThrowError(
        invalidClaim(
          "Validation error: Invalid discriminator value. Expected 'm2m' | 'internal' | 'maintenance' |  at \"role\""
        )
      );
    });

    it("should successfully read auth data from a Support token", async () => {
      const signedToken = getMockSignedToken(mockSupportToken);

      const decoded = jwt.decode(signedToken, { json: true });

      expect(decoded).toEqual(mockSupportToken);
    });

    it("should fail reading auth data from a Support token with invalid user roles", async () => {
      const signedToken = getMockSignedToken({
        ...mockSupportToken,
        "user-roles": "support,invalid-role",
      });

      const decoded = jwt.decode(signedToken, { json: true });

      expect(() => {
        readAuthDataFromJwtToken(decoded as string | JwtPayload);
      }).toThrowError(
        invalidClaim(
          "Validation error: Invalid enum value. Expected 'admin' | 'security' | 'api' | 'support', received 'invalid-role' at \"user-roles[1]\""
        )
      );
    });

    it("should also accept audience as a JSON array", async () => {
      const mockToken = randomArrayItem([
        mockUiToken,
        mockM2MToken,
        mockInternalToken,
      ]);
      const token = {
        ...mockToken,
        aud: ["dev.interop.pagopa.it/ui", "dev.interop.pagopa.it/fake"],
      };
      const signedToken = getMockSignedToken(token);

      const decoded = jwt.decode(signedToken, { json: true });

      expect(decoded).toEqual(token);
    });
  });
});
