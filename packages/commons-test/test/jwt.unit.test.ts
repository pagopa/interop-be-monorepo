/* eslint-disable functional/immutable-data */
import jwt from "jsonwebtoken";
import {
  genericLogger,
  readAuthDataFromJwtToken,
} from "pagopa-interop-commons";
import { invalidClaim } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { P, match } from "ts-pattern";
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

const mockMaintenanceToken = {
  aud: "refactor.dev.interop.pagopa.it/m2m,refactor.dev.interop.pagopa.it/fake",
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
  aud: "dev.interop.pagopa.it/ui,dev.interop.pagopa.it/fake",
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
  exp: 1710928259,
  iat: 1710841859,
  jti: "e82bd774-9cac-4885-931b-015b2eb4e9a5",
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
      expect(readAuthDataFromJwtToken(token, undefined, genericLogger)).toEqual(
        {
          externalId: {
            origin: "IPA",
            value: "5N2TR557",
          },
          selfcareId: "1962d21c-c701-4805-93f6-53a877898756",
          organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
          userId: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
          userRoles: ["admin"],
        }
      );
    });

    it("should successfully read auth data from a UI token with multiple comma separated user roles", async () => {
      const token = getMockSignedToken({
        ...mockUiToken,
        "user-roles": "security,api",
      });

      expect(readAuthDataFromJwtToken(token, undefined, genericLogger)).toEqual(
        {
          externalId: {
            origin: "IPA",
            value: "5N2TR557",
          },
          selfcareId: "1962d21c-c701-4805-93f6-53a877898756",
          organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
          userId: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
          userRoles: ["security", "api"],
        }
      );
    });

    it("should fail reading auth data from a UI token with invalid user roles", async () => {
      const token = getMockSignedToken({
        ...mockUiToken,
        "user-roles": "api,invalid-role",
      });

      expect(() =>
        readAuthDataFromJwtToken(token, undefined, genericLogger)
      ).toThrowError(
        invalidClaim(
          "Validation error: Invalid enum value. Expected 'admin' | 'security' | 'api' | 'support', received 'invalid-role' at \"user-roles[1]\""
        )
      );
    });

    it("should fail reading auth data from a UI token with empty user roles", async () => {
      const token = getMockSignedToken({
        ...mockUiToken,
        "user-roles": "",
      });

      expect(() =>
        readAuthDataFromJwtToken(token, undefined, genericLogger)
      ).toThrowError(
        invalidClaim(
          'Validation error: String must contain at least 1 character(s) at "user-roles"'
        )
      );
    });

    it("should successfully read auth data from a M2M token", async () => {
      const token = getMockSignedToken(mockM2MToken);
      expect(readAuthDataFromJwtToken(token, undefined, genericLogger)).toEqual(
        {
          externalId: {
            origin: "",
            value: "",
          },
          organizationId: "89804b2c-f62e-4867-87a4-3a82f2b03485",
          selfcareId: "",
          userId: "",
          userRoles: ["m2m"],
        }
      );
    });

    it("should fail if some required fields are missing", () => {
      const mockToken = randomArrayItem([
        mockUiToken,
        mockM2MToken,
        mockInternalToken,
        mockMaintenanceToken,
      ]);
      const token = getMockSignedToken({
        ...mockToken,
        aud: undefined,
        jti: undefined,
      });

      expect(() =>
        readAuthDataFromJwtToken(token, undefined, genericLogger)
      ).toThrowError(
        invalidClaim(`Validation error: Required at "aud"; Required at "jti"`)
      );
    });

    it("should fail if the aud field is an empty string", () => {
      const mockToken = randomArrayItem([
        mockUiToken,
        mockM2MToken,
        mockInternalToken,
        mockMaintenanceToken,
      ]);
      const token = getMockSignedToken({
        ...mockToken,
        aud: "",
      });

      expect(() =>
        readAuthDataFromJwtToken(token, undefined, genericLogger)
      ).toThrowError(
        invalidClaim(
          'Validation error: String must contain at least 1 character(s) at "aud"'
        )
      );
    });

    it("should successfully read auth data from an Internal token", async () => {
      const token = getMockSignedToken(mockInternalToken);
      expect(readAuthDataFromJwtToken(token, undefined, genericLogger)).toEqual(
        {
          externalId: {
            origin: "",
            value: "",
          },
          organizationId: "",
          selfcareId: "",
          userId: "",
          userRoles: ["internal"],
        }
      );
    });

    it("should successfully read auth data from a Maintenance token", async () => {
      const token = getMockSignedToken(mockMaintenanceToken);
      expect(readAuthDataFromJwtToken(token, undefined, genericLogger)).toEqual(
        {
          externalId: {
            origin: "",
            value: "",
          },
          organizationId: "",
          selfcareId: "",
          userId: "",
          userRoles: ["maintenance"],
        }
      );
    });

    it("should fail when the token is invalid", async () => {
      const token = getMockSignedToken({
        role: "invalid-role",
      });

      expect(() =>
        readAuthDataFromJwtToken(token, undefined, genericLogger)
      ).toThrowError(
        invalidClaim(
          "Validation error: Invalid discriminator value. Expected 'm2m' | 'internal' | 'maintenance' |  at \"role\""
        )
      );
    });

    it("should successfully read auth data from a Support token", async () => {
      const token = getMockSignedToken(mockSupportToken);
      expect(readAuthDataFromJwtToken(token, undefined, genericLogger)).toEqual(
        {
          externalId: {
            origin: "IPA",
            value: "5N2TR557",
          },
          organizationId: "69e2865e-65ab-4e48-a638-2037a9ee2ee7",
          selfcareId: "1962d21c-c701-4805-93f6-53a877898756",
          userId: "f07ddb8f-17f9-47d4-b31e-35d1ac10e521",
          userRoles: ["support"],
        }
      );
    });

    it("should fail reading auth data from a Support token with invalid user roles", async () => {
      const token = getMockSignedToken({
        ...mockSupportToken,
        "user-roles": "support,invalid-role",
      });

      expect(() =>
        readAuthDataFromJwtToken(token, undefined, genericLogger)
      ).toThrowError(
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
      const token = getMockSignedToken({
        ...mockToken,
        aud: ["dev.interop.pagopa.it/ui", "dev.interop.pagopa.it/fake"],
      });

      const authData = readAuthDataFromJwtToken(
        token,
        undefined,
        genericLogger
      );
      expect(authData).toMatchObject({
        userRoles: match(mockToken)
          .with({ role: P.not(P.nullish) }, (t) => [t.role])
          .with({ "user-roles": P.not(P.nullish) }, (t) =>
            t["user-roles"].split(",")
          )
          .otherwise(() => {
            throw new Error("Unexpected user roles in token");
          }),
      });
    });
  });
});
