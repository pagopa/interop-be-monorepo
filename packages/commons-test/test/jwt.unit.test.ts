/* eslint-disable @typescript-eslint/no-non-null-assertion */
import jwt from "jsonwebtoken";
import {
  readAuthDataFromJwtToken,
  authRole,
  AuthRole,
  UIAuthData,
  M2MAuthData,
  InternalAuthData,
  MaintenanceAuthData,
  userRole,
} from "pagopa-interop-commons";
import { invalidClaim } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { createPayload, generateToken } from "../src/mockedPayloadForToken.js";

describe("JWT tests", () => {
  describe("readAuthDataFromJwtToken", () => {
    it.each(Object.values(userRole))(
      "should successfully read data from a UI token with a single user role",
      async (role) => {
        const token = jwt.decode(generateToken([role]));

        expect(
          (readAuthDataFromJwtToken(token!) as UIAuthData).userRoles
        ).toEqual([role]);
      }
    );

    it.only("should successfully read auth data from a UI token with multiple comma separated user roles", async () => {
      const roles = [authRole.API_ROLE, authRole.SECURITY_ROLE];
      const token = jwt.decode(generateToken(roles)) as jwt.JwtPayload;

      expect(readAuthDataFromJwtToken(token) as UIAuthData).toStrictEqual({
        systemRole: undefined,
        organizationId: token?.organizationId,
        userId: token?.uid,
        userRoles: roles,
        selfcareId: token?.selfcareId,
        externalId: token?.externalId,
      });
    });

    it("should fail reading auth data from a UI token with invalid user roles", async () => {
      const token1 = jwt.decode(generateToken([""] as unknown as AuthRole[]));

      expect(() => {
        readAuthDataFromJwtToken(token1!);
      }).toThrowError(
        invalidClaim(
          "Validation error: Invalid enum value. Expected 'admin' | 'security' | 'api' | 'support', received '' at \"user-roles[0]\""
        )
      );

      const token2 = jwt.decode(
        generateToken(["invalid-role"] as unknown as AuthRole[])
      );

      expect(() => {
        readAuthDataFromJwtToken(token2!);
      }).toThrowError(
        invalidClaim(
          "Validation error: Invalid enum value. Expected 'admin' | 'security' | 'api' | 'support', received 'invalid-role' at \"user-roles[0]\""
        )
      );
    });

    it("should successfully read auth data from a M2M token", async () => {
      const token = jwt.decode(generateToken([authRole.M2M_ROLE]));

      expect(
        (readAuthDataFromJwtToken(token!) as M2MAuthData).systemRole
      ).toEqual(authRole.M2M_ROLE);
    });

    it("should successfully read auth data from a M2M admin token", async () => {
      const token = jwt.decode(generateToken([authRole.M2M_ADMIN_ROLE]));

      expect(
        (readAuthDataFromJwtToken(token!) as M2MAuthData).systemRole
      ).toEqual(authRole.M2M_ADMIN_ROLE);
    });

    it("should fail if some required fields are missing", async () => {
      const token1 = jwt.decode(
        jwt.sign(
          { ...createPayload([authRole.ADMIN_ROLE]), jti: undefined },
          "test-secret"
        )
      );

      expect(() => {
        readAuthDataFromJwtToken(token1!);
      }).toThrowError(invalidClaim(`Validation error: Required at "jti"`));

      const token2 = jwt.decode(
        jwt.sign(
          { ...createPayload([authRole.INTERNAL_ROLE]), aud: "" },
          "test-secret"
        )
      );

      expect(() => readAuthDataFromJwtToken(token2!)).toThrowError(
        invalidClaim(
          'Validation error: String must contain at least 1 character(s) at "aud"'
        )
      );
    });

    it("should successfully read auth data from an Internal token", async () => {
      const token = jwt.decode(generateToken([authRole.INTERNAL_ROLE]));

      expect(
        (readAuthDataFromJwtToken(token!) as InternalAuthData).systemRole
      ).toEqual(authRole.INTERNAL_ROLE);
    });

    it("should successfully read auth data from a Maintenance token", async () => {
      const token = jwt.decode(generateToken([authRole.MAINTENANCE_ROLE]));

      expect(
        (readAuthDataFromJwtToken(token!) as MaintenanceAuthData).systemRole
      ).toEqual(authRole.MAINTENANCE_ROLE);
    });

    it("should also accept audience as a JSON array", async () => {
      const token = jwt.decode(
        jwt.sign(
          {
            ...createPayload([authRole.ADMIN_ROLE]),
            aud: ["dev.interop.pagopa.it/ui", "interop.pagopa.it/ui"],
          },
          "test-secret"
        )
      );

      expect(token).toBeDefined();
    });
  });
});
