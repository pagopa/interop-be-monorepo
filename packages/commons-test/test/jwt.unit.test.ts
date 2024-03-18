/* eslint-disable functional/immutable-data */
import { readAuthDataFromJwtToken } from "pagopa-interop-commons";
import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";

describe("JWT tests", () => {
  const uiToken = jwt.sign(
    JSON.stringify({
      organizationId: "4D55696F-16C0-4968-854B-2B166397FC30",
      "user-roles": "admin",
      role: "admin",
      uid: "0fda033c-8e8e-48a9-a0fc-abba1f711fef",
      organization: {
        roles: [
          {
            role: "admin",
          },
        ],
      },
      externalId: {
        origin: "IPA",
        value: "C6D8116C-6B22-463C-8372-65B0CCF5A0F0",
      },
    }),
    "test-secret"
  );

  const m2mToken = jwt.sign(
    JSON.stringify({
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
    }),
    "test-secret"
  );

  const internalToken = jwt.sign(
    {
      aud: "refactor.dev.interop.pagopa.it/m2m",
      sub: "227cadc9-1a2c-4612-b100-a247b48d0464",
      role: "internal",
      nbf: 1710511524,
      iss: "refactor.dev.interop.pagopa.it",
      exp: 1810511523,
      iat: 1710511524,
      jti: "d0c42cfb-8a32-430f-95cf-085067b52695",
    },
    "test-secret"
  );

  describe("readAuthDataFromJwtToken", () => {
    it("should successfully read auth data from a UI token", async () => {
      expect(readAuthDataFromJwtToken(uiToken)).toEqual({
        externalId: {
          origin: "IPA",
          value: "C6D8116C-6B22-463C-8372-65B0CCF5A0F0",
        },
        organizationId: "4D55696F-16C0-4968-854B-2B166397FC30",
        userId: "0fda033c-8e8e-48a9-a0fc-abba1f711fef",
        userRoles: ["admin"],
      });
    });

    it("should successfully read auth data from a UI token with user-roles only", async () => {
      const token = jwt.sign(
        JSON.stringify({
          organizationId: "4D55696F-16C0-4968-854B-2B166397FC30",
          "user-roles": "admin,api",
        }),
        "test-secret"
      );

      expect(readAuthDataFromJwtToken(token)).toEqual({
        externalId: {
          origin: "",
          value: "",
        },
        organizationId: "4D55696F-16C0-4968-854B-2B166397FC30",
        userId: "",
        userRoles: ["admin", "api"],
      });
    });

    it("should successfully read auth data from a M2M token", async () => {
      expect(readAuthDataFromJwtToken(m2mToken)).toEqual({
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
      expect(readAuthDataFromJwtToken(internalToken)).toEqual({
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
      expect(readAuthDataFromJwtToken("invalid token")).toBeInstanceOf(Error);
    });
  });
});
