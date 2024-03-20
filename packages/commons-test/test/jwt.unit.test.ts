/* eslint-disable functional/immutable-data */
import { readAuthDataFromJwtToken } from "pagopa-interop-commons";
import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";

const mockUiToken = {
  iss: "dev.interop.pagopa.it",
  externalId: {
    origin: "IPA",
    value: "5N2TR557",
  },
  "user-roles": "security,api",
  selfcareId: "1962d21c-c701-4805-93f6-53a877898756",
  organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
  aud: "dev.interop.pagopa.it/ui,dev.interop.pagopa.it/fake",
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
  exp: 1710928259,
  iat: 1710841859,
  family_name: "Rossi",
  jti: "e82bd774-9cac-4885-931b-015b2eb4e9a5",
  email: "m.rossi@psp.it",
};

const mockM2MToken = {
  organizationId: "89804b2c-f62e-4867-87a4-3a82f2b03485",
  aud: "refactor.dev.interop.pagopa.it/m2m,refactor.dev.interop.pagopa.it/fake",
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
  aud: "refactor.dev.interop.pagopa.it/m2m,refactor.dev.interop.pagopa.it/fake",
  sub: "227cadc9-1a2c-4612-b100-a247b48d0464",
  role: "internal",
  nbf: 1710511524,
  iss: "refactor.dev.interop.pagopa.it",
  exp: 1810511523,
  iat: 1710511524,
  jti: "d0c42cfb-8a32-430f-95cf-085067b52695",
};

const getMockSignedToken = (token: object): string =>
  jwt.sign(token, "test-secret");

describe("JWT tests", () => {
  describe("readAuthDataFromJwtToken", () => {
    it("should successfully read auth data from a UI token with a single user role", async () => {
      const token = getMockSignedToken({
        ...mockUiToken,
        "user-roles": "admin",
      });
      expect(readAuthDataFromJwtToken(token)).toEqual({
        externalId: {
          origin: "IPA",
          value: "5N2TR557",
        },
        organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
        userId: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
        userRoles: ["admin"],
      });
    });

    it("should successfully read auth data from a UI token with multiple comma separated user roles", async () => {
      const token = getMockSignedToken({
        ...mockUiToken,
        "user-roles": "security,api",
      });

      expect(readAuthDataFromJwtToken(token)).toEqual({
        externalId: {
          origin: "IPA",
          value: "5N2TR557",
        },
        organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
        userId: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
        userRoles: ["security", "api"],
      });
    });

    it("should successfully read auth data from a M2M token", async () => {
      const token = getMockSignedToken(mockM2MToken);
      expect(readAuthDataFromJwtToken(token)).toEqual({
        externalId: {
          origin: "",
          value: "",
        },
        organizationId: "89804b2c-f62e-4867-87a4-3a82f2b03485",
        userId: "",
        userRoles: ["m2m"],
      });
    });

    it("should successfully read auth data from an internal token", async () => {
      const token = getMockSignedToken(mockInternalToken);
      expect(readAuthDataFromJwtToken(token)).toEqual({
        externalId: {
          origin: "",
          value: "",
        },
        organizationId: "",
        userId: "",
        userRoles: ["internal"],
      });
    });

    it("should return an error when the token is invalid", async () => {
      const token = getMockSignedToken({
        role: "invalid-role",
      });
      expect(readAuthDataFromJwtToken(token)).toBeInstanceOf(Error);
    });
  });
});
