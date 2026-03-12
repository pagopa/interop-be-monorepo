/* eslint-disable sonarjs/no-identical-functions */
import { describe, expect, it } from "vitest";
import {
  AppContext,
  AuthRole,
  InternalAuthData,
  M2MAuthData,
  MaintenanceAuthData,
  NonEmptyArray,
  UIAuthData,
  validateAuthorization,
} from "pagopa-interop-commons";
import { generateId, unauthorizedError } from "pagopa-interop-models";
import { getMockContext } from "../src/testUtils.js";

describe("validateAuthorization", () => {
  const mockContext: AppContext<UIAuthData> = getMockContext({});

  it.each<{ authRoles: NonEmptyArray<AuthRole> }>([
    { authRoles: ["m2m"] },
    { authRoles: ["m2m", "admin"] },
    { authRoles: ["m2m", "admin", "api"] },
    { authRoles: ["m2m", "admin", "internal"] },
  ])(
    "should succeed when called with 'm2m' auth data and auth roles $authRoles",
    ({ authRoles }) => {
      const ctx: AppContext<M2MAuthData> = {
        ...mockContext,
        authData: {
          clientId: generateId(),
          jti: generateId(),
          systemRole: "m2m",
          organizationId: generateId(),
        },
      };

      expect(() => validateAuthorization(ctx, authRoles)).not.toThrow();
    }
  );

  it.each<{ authRoles: NonEmptyArray<AuthRole> }>([
    { authRoles: ["admin"] },
    { authRoles: ["admin", "api"] },
    { authRoles: ["admin", "internal"] },
    { authRoles: ["admin", "m2m", "internal"] },
  ])(
    "should succeed when called with 'admin' auth data and auth roles $authRoles",
    ({ authRoles }) => {
      const ctx: AppContext<UIAuthData> = {
        ...mockContext,
        authData: {
          ...mockContext.authData,
          userRoles: ["admin"],
        },
      };

      expect(() => validateAuthorization(ctx, authRoles)).not.toThrow();
    }
  );

  it.each<{ authRoles: NonEmptyArray<AuthRole> }>([
    { authRoles: ["api"] },
    { authRoles: ["api", "internal"] },
    { authRoles: ["api", "m2m"] },
    { authRoles: ["api", "admin"] },
    { authRoles: ["api", "security", "internal"] },
    { authRoles: ["security", "m2m"] },
    { authRoles: ["security", "admin"] },
    { authRoles: ["security", "internal"] },
  ])(
    "should succeed when called with ['api', 'security'] auth data and auth roles $authRoles",
    ({ authRoles }) => {
      const ctx: AppContext<UIAuthData> = {
        ...mockContext,
        authData: {
          ...mockContext.authData,
          userRoles: ["api", "security"],
        },
      };

      expect(() => validateAuthorization(ctx, authRoles)).not.toThrow();
    }
  );

  it.each<{ authRoles: NonEmptyArray<AuthRole> }>([
    { authRoles: ["internal"] },
    { authRoles: ["internal", "m2m"] },
    { authRoles: ["internal", "admin"] },
    { authRoles: ["internal", "api", "security"] },
  ])(
    "should succeed when called with 'internal' auth data and auth roles $authRoles",
    ({ authRoles }) => {
      const ctx: AppContext<InternalAuthData> = {
        ...mockContext,
        authData: {
          jti: generateId(),
          systemRole: "internal",
        },
      };

      expect(() => validateAuthorization(ctx, authRoles)).not.toThrow();
    }
  );

  it.each<{ authRoles: NonEmptyArray<AuthRole> }>([
    { authRoles: ["maintenance"] },
    { authRoles: ["maintenance", "m2m"] },
    { authRoles: ["maintenance", "admin"] },
    { authRoles: ["maintenance", "api", "security"] },
    { authRoles: ["maintenance", "internal"] },
    { authRoles: ["maintenance", "admin", "internal"] },
  ])(
    "should throw an error when called with 'maintenance' auth data and auth roles $authRoles",
    ({ authRoles }) => {
      const ctx: AppContext<MaintenanceAuthData> = {
        ...mockContext,
        authData: {
          jti: generateId(),
          systemRole: "maintenance",
        },
      };

      expect(() => validateAuthorization(ctx, authRoles)).not.toThrow();
    }
  );

  it.each<{ authRoles: NonEmptyArray<AuthRole> }>([
    { authRoles: ["admin", "api"] },
    { authRoles: ["security"] },
    { authRoles: ["security", "internal"] },
    { authRoles: ["admin", "internal"] },
    { authRoles: ["api", "security", "maintenance"] },
  ])(
    "should throw an error when called with 'm2m' auth data and auth roles $authRoles",
    ({ authRoles }) => {
      const ctx: AppContext<M2MAuthData> = {
        ...mockContext,
        authData: {
          clientId: generateId(),
          jti: generateId(),
          systemRole: "m2m",
          organizationId: generateId(),
        },
      };

      expect(() => validateAuthorization(ctx, authRoles)).toThrowError(
        unauthorizedError(`Invalid role "m2m" for this operation`)
      );
    }
  );

  it.each<{ authRoles: NonEmptyArray<AuthRole> }>([
    { authRoles: ["m2m"] },
    { authRoles: ["api", "security"] },
    { authRoles: ["internal", "api"] },
    { authRoles: ["maintenance", "support", "api"] },
  ])(
    "should throw an error when called with 'admin' auth data and auth roles $authRoles",
    ({ authRoles }) => {
      const ctx: AppContext<UIAuthData> = {
        ...mockContext,
        authData: {
          ...mockContext.authData,
          userRoles: ["admin"],
        },
      };

      expect(() => validateAuthorization(ctx, authRoles)).toThrowError(
        unauthorizedError(`Invalid roles ["admin"] for this operation`)
      );
    }
  );

  it.each<{ authRoles: NonEmptyArray<AuthRole> }>([
    { authRoles: ["m2m"] },
    { authRoles: ["admin", "internal"] },
    { authRoles: ["support", "admin", "m2m"] },
    { authRoles: ["internal", "m2m", "admin", "support"] },
  ])(
    "should throw an error when called with ['api', 'security'] auth data and auth roles $authRoles",
    ({ authRoles }) => {
      const ctx: AppContext<UIAuthData> = {
        ...mockContext,
        authData: {
          ...mockContext.authData,
          userRoles: ["api", "security"],
        },
      };

      expect(() => validateAuthorization(ctx, authRoles)).toThrowError(
        unauthorizedError(`Invalid roles ["api","security"] for this operation`)
      );
    }
  );

  it.each<{ authRoles: NonEmptyArray<AuthRole> }>([
    { authRoles: ["m2m"] },
    { authRoles: ["admin", "api"] },
    { authRoles: ["security", "admin"] },
    { authRoles: ["api", "m2m", "admin", "support"] },
    { authRoles: ["m2m", "admin", "maintenance"] },
  ])(
    "should throw an error when called with 'internal' auth data and auth roles $authRoles",
    ({ authRoles }) => {
      const ctx: AppContext<InternalAuthData> = {
        ...mockContext,
        authData: {
          jti: generateId(),
          systemRole: "internal",
        },
      };

      expect(() => validateAuthorization(ctx, authRoles)).toThrowError(
        unauthorizedError(`Invalid role "internal" for this operation`)
      );
    }
  );

  it.each<{ authRoles: NonEmptyArray<AuthRole> }>([
    { authRoles: ["m2m"] },
    { authRoles: ["admin", "api"] },
    { authRoles: ["security", "admin"] },
    { authRoles: ["api", "m2m", "admin", "support"] },
    { authRoles: ["internal", "m2m", "admin"] },
  ])(
    "should throw an error when called with 'maintenance' auth data and auth roles $authRoles",
    ({ authRoles }) => {
      const ctx: AppContext<MaintenanceAuthData> = {
        ...mockContext,
        authData: {
          jti: generateId(),
          systemRole: "maintenance",
        },
      };

      expect(() => validateAuthorization(ctx, authRoles)).toThrowError(
        unauthorizedError(`Invalid role "maintenance" for this operation`)
      );
    }
  );
  it("should throw a meaningful error when m2m token is used but m2m-admin is required", () => {
    const ctx: AppContext<M2MAuthData> = {
      ...mockContext,
      authData: {
        clientId: generateId(),
        jti: generateId(),
        systemRole: "m2m",
        organizationId: generateId(),
      },
    };

    expect(() => validateAuthorization(ctx, ["m2m-admin"])).toThrowError(
      unauthorizedError(
        `Admin user not set for Client ${ctx.authData.clientId} with M2M role. In case it is already set, regenerate the m2m token.`
      )
    );
  });
});
