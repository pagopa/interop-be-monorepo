/* eslint-disable functional/immutable-data */
import jwt, { JwtPayload } from "jsonwebtoken";
import {
  genericLogger,
  JWTConfig,
  readAuthDataFromJwtToken,
  verifyJwtToken,
} from "pagopa-interop-commons";
import { invalidClaim } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { BRAND } from "zod";
import { randomArrayItem } from "../src/testUtils.js";

const config: JWTConfig = {
  wellKnownUrls: [
    "http://127.0.0.1:4500/jwks.json" as string & BRAND<"APIEndpoint">,
  ],
  acceptedAudiences: [
    "dev.interop.pagopa.it/ui",
    "dev.interop.pagopa.it/fake",
    "refactor.dev.interop.pagopa.it/m2m",
    "refactor.dev.interop.pagopa.it/fake",
  ],
  jwksCacheMaxAge: undefined,
};

const now = Math.floor(Date.now() / 1000); // Tempo attuale in secondi
const exp = now + 60 * 60 * 24 * 7; // +7 giorni

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
  exp,
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
  exp,
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
  exp,
  iat: 1710511524,
  jti: "d0c42cfb-8a32-430f-95cf-085067b52695",
};

const mockMaintenanceToken = {
  aud: "refactor.dev.interop.pagopa.it/fake",
  sub: "227cadc9-1a2c-4612-b100-a247b48d0464",
  role: "maintenance",
  nbf: 1710511524,
  iss: "refactor.dev.interop.pagopa.it",
  exp,
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
  exp,
  iat: 1710841859,
  jti: "e82bd774-9cac-4885-931b-015b2eb4e9a5",
};

const getMockSignedToken = (token: object): string => {
  const secret = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCTknFMga17eY18
fmXs+4kLNnerZGLte4yinxIpCoUTv7FuuOZ0zmkUr2DOetuwdavYUH7D0L+hIYEO
fi/Ioaac9ZHaVPMEP2WawSkRQo6zdmUxJumRYk4cIQuhyCriREAbGJ9Oh2p+Pi5q
QZYcEXMhD7v1BVjNnQH/d2xpRT0A45rtOCJX1tvKGRZVYbNPy4aGL4XzgzVXBWew
bwjc0j1iHA6z8lG5+6H5m8WdFw+5ZNUCBwNihlb3iale+XQrDyXZijJOuX3Gq8M4
5sD9rG7URam0k4P7rkFAMMb5gsy9/FX1+ciVfn2jqRtzYjqoW2u29kIYsM+z+MT6
Tz/qF8AnAgMBAAECggEAE9mletyQqOTDVuUrsbJuDz+O3lOdCQPO+Yr7JuEe4Hav
F80wVrLzKJCkrXGSPoy9hlXhj1ZziGmY0gnARLUV09Qmf99gZwheEvB7pTI2Psak
uvVYgrFd/2OkjGj/97qlgt+PgkEt3nhfxvQ2jGT+fwp+RmmnNdUyURpPz2M8XvOK
cwQYDbUD82CECMdMrB5ArwFBEjkQA4wu9LxOape4o/nFnQpYEuCf6r0ApH/W4sFY
fM2UVBw3gw3RdY4eOPN9zE8iSVIh67g6MrR4SIDgu04WDeD8h8omUt8AMNOE+8/z
9ie4jQal+gNksOdAMJPv2+lyMotZ9AR6tgFt1y0TXQKBgQDHklco/ZNnzhvDv3hE
syRmbl27Ij95ZLqrgYgOtSVex/SP0zL57hmfl9ouDJuKHv9KIxEYoPLSiZYaGxb3
knfyheRhhkwrm4ZAvzwJeCfYSQhN/6dkdcKDglxA33/HU1JtIHj/PH3Cv4gSrVh+
Ev2hRmiLWX/zXmENWj8t1CW21QKBgQC9TDKs5Yz6JrGICgvyf5YR/Jxt8u6reks+
QTCPO8gD006cDcZaTUrzUG+0ER1ZapcqE70J8HlgwsRXMW198cP4+iYu28jNwGRe
XcTwrC3/yw9R3P78sknTowvMmcQgZkQaSRrlADj3KJCkhQx6a91oZ+QPdq1arPXx
1fxMjeHRCwKBgQCIVR4ZsHBcP16UMF6Wf9Jj7w0040Z9RSSIOOqbMYAf6XTWM67l
MZRrg67WOmKezmITYTUyn/CBht/1YYAlC/fIw1KqlLXALHRgEsOOrHh7thhoQDc3
14JTmGAxKPz/S5pJVh+SLN60hWcNa0HCjnKZE6IjX7aaqGSgXIBAbGZ/KQKBgDxC
C0eacvwWYSELAa6aCq2DGlCtqmgPr/ALVGfkAdGl7Dok8GVCgX9etZA+endCRQhx
7BVD5X91wIZ5B3+1/Eo/ZvQ3pn5Ipiqb8tsiFCp++0t16/2Iy5OBLXpd4F7n7vnn
F5aaMYgL869LYyN9PqfDmoeJoblhoZDwKzY7XAztAoGADFYNznI/tIKivy+RirDa
PP7zEqMwiFmsDxOt4EuzrIi7ojWVrLeqjiP52eKk6EiOIOJ/7JXYEcEnVaZLwetq
4y6N91WUp/s++a97MUfWEdZ52ZJq1E3IhtsXvUM5kp4QsllPVMCpWRERhvn5wUkh
3IsB3ifrZ0jMf8rRv68Xeyo=
-----END PRIVATE KEY-----`;

  return jwt.sign(token, secret, {
    header: {
      alg: "RS256",
      kid: "ffcc9b5b-4612-49b1-9374-9d203a3834f2",
    },
  });
};

describe("JWT tests", () => {
  describe("verifyToken", () => {
    it("should successfully read data from a UI token with a single user role", async () => {
      const token = {
        ...mockUiToken,
        "user-roles": "admin",
      };
      const signedToken = getMockSignedToken(token);

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

      expect(decoded).toEqual(token);
    });

    it("should successfully read auth data from a UI token with multiple comma separated user roles", async () => {
      const token = {
        ...mockUiToken,
        "user-roles": "security,api",
      };
      const signedToken = getMockSignedToken(token);

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

      expect(decoded).toEqual(token);
    });

    it("should fail reading auth data from a UI token with invalid user roles", async () => {
      const signedToken = getMockSignedToken({
        ...mockUiToken,
        "user-roles": "api,invalid-role",
      });

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

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

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

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

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

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

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

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

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

      expect(decoded).toBeFalsy();
    });

    it("should successfully read auth data from an Internal token", async () => {
      const signedToken = getMockSignedToken(mockInternalToken);

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

      expect(decoded).toEqual(mockInternalToken);
    });

    it("should successfully read auth data from a Maintenance token", async () => {
      const signedToken = getMockSignedToken(mockMaintenanceToken);

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

      expect(decoded).toEqual(mockMaintenanceToken);
    });

    it("should fail when the token is invalid", async () => {
      const signedToken = getMockSignedToken({
        role: "invalid-role",
      });

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

      expect(decoded).toBeFalsy();
    });

    it("should successfully read auth data from a Support token", async () => {
      const signedToken = getMockSignedToken(mockSupportToken);

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

      expect(decoded).toEqual(mockSupportToken);
    });

    it("should fail reading auth data from a Support token with invalid user roles", async () => {
      const signedToken = getMockSignedToken({
        ...mockSupportToken,
        "user-roles": "support,invalid-role",
      });

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

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

      const { decoded } = await verifyJwtToken(
        signedToken,
        config,
        genericLogger
      );

      expect(decoded).toEqual(token);
    });
  });
});
