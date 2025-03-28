/* eslint-disable sonarjs/no-identical-functions */
import {
  AppContext,
  InternalAuthData,
  M2MAuthData,
  MaintenanceAuthData,
  UIAuthData,
  validateAuthorization,
} from "pagopa-interop-commons";
import { describe, expect, it } from "vitest";
import { generateId, unauthorizedError } from "pagopa-interop-models";
import { getMockContext } from "../src/testUtils.js";

describe("validateAuthorization", () => {
  const mockContext: AppContext<UIAuthData> = getMockContext({});

  it(`should validate the authorization for "m2m" auth data`, () => {
    const ctx: AppContext<M2MAuthData> = {
      ...mockContext,
      authData: {
        tokenType: "m2m",
        organizationId: generateId(),
      },
    };
    expect(() => validateAuthorization(ctx, ["m2m"])).not.toThrow();
    expect(() => validateAuthorization(ctx, ["m2m", "internal"])).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["m2m", "maintenance"])
    ).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["m2m", "internal", "ui"], ["admin"])
    ).not.toThrow();
  });

  it(`should validate the authorization for "internal" auth data`, () => {
    const ctx: AppContext<InternalAuthData> = {
      ...mockContext,
      authData: {
        tokenType: "internal",
      },
    };
    expect(() => validateAuthorization(ctx, ["internal"])).not.toThrow();
    expect(() => validateAuthorization(ctx, ["internal", "m2m"])).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["internal", "maintenance", "m2m"])
    ).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["internal", "ui"], ["admin"])
    ).not.toThrow();
  });

  it(`should validate the authorization for "maintenance" auth data`, () => {
    const ctx: AppContext<MaintenanceAuthData> = {
      ...mockContext,
      authData: {
        tokenType: "maintenance",
      },
    };

    expect(() => validateAuthorization(ctx, ["maintenance"])).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["maintenance", "internal"])
    ).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["maintenance", "m2m", "internal"])
    ).not.toThrow();
    expect(() =>
      validateAuthorization(
        ctx,
        ["maintenance", "m2m", "internal", "ui"],
        ["admin"]
      )
    ).not.toThrow();
  });

  it(`should validate the authorization for "ui" auth data with user roles ["admin"]`, () => {
    const ctx: AppContext<UIAuthData> = {
      ...mockContext,
      authData: {
        ...mockContext.authData,
        tokenType: "ui",
        userRoles: ["admin"],
      },
    };
    expect(() => validateAuthorization(ctx, ["ui"], ["admin"])).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["ui", "m2m"], ["admin"])
    ).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["ui", "m2m"], ["admin", "security"])
    ).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["ui", "m2m", "internal"], ["admin"])
    ).not.toThrow();
    expect(() =>
      validateAuthorization(
        ctx,
        ["ui", "m2m", "internal", "maintenance"],
        ["admin", "security", "api"]
      )
    ).not.toThrow();
  });

  it(`should validate the authorization for "ui" auth data with user roles ["admin", "security"]`, () => {
    const ctx: AppContext<UIAuthData> = {
      ...mockContext,
      authData: {
        ...mockContext.authData,
        tokenType: "ui",
        userRoles: ["admin", "security"],
      },
    };
    expect(() => validateAuthorization(ctx, ["ui"], ["admin"])).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["ui"], ["security"])
    ).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["ui", "m2m"], ["admin"])
    ).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["ui", "m2m"], ["admin", "security"])
    ).not.toThrow();
    expect(() =>
      validateAuthorization(ctx, ["ui", "m2m", "internal"], ["security"])
    ).not.toThrow();
    expect(() =>
      validateAuthorization(
        ctx,
        ["ui", "m2m", "internal", "maintenance"],
        ["admin", "security", "api"]
      )
    ).not.toThrow();
  });

  it(`should throw unauthorizedError for "ui" auth data with user roles ["support"]`, () => {
    const ctx: AppContext<UIAuthData> = {
      ...mockContext,
      authData: {
        ...mockContext.authData,
        tokenType: "ui",
        userRoles: ["support"],
      },
    };
    expect(() => validateAuthorization(ctx, ["ui"], ["admin"])).toThrowError(
      unauthorizedError(
        `Invalid token type "ui" and user roles ["support"] for this operation`
      )
    );
    expect(() =>
      validateAuthorization(ctx, ["ui", "m2m"], ["admin"])
    ).toThrowError(
      unauthorizedError(
        `Invalid token type "ui" and user roles ["support"] for this operation`
      )
    );
    expect(() =>
      validateAuthorization(ctx, ["ui", "m2m"], ["admin", "security"])
    ).toThrowError(
      unauthorizedError(
        `Invalid token type "ui" and user roles ["support"] for this operation`
      )
    );
    expect(() => validateAuthorization(ctx, ["m2m", "internal"])).toThrowError(
      unauthorizedError(`Invalid token type "ui" for this operation`)
    );
    expect(() => validateAuthorization(ctx, ["maintenance"])).toThrowError(
      unauthorizedError(`Invalid token type "ui" for this operation`)
    );
  });

  it(`should throw unauthorizedError for "m2m" auth data`, () => {
    const ctx: AppContext<M2MAuthData> = {
      ...mockContext,
      authData: {
        tokenType: "m2m",
        organizationId: generateId(),
      },
    };
    expect(() => validateAuthorization(ctx, ["internal"])).toThrowError(
      unauthorizedError(`Invalid token type "m2m" for this operation`)
    );
    expect(() => validateAuthorization(ctx, ["maintenance"])).toThrowError(
      unauthorizedError(`Invalid token type "m2m" for this operation`)
    );
    expect(() => validateAuthorization(ctx, ["ui"], ["admin"])).toThrowError(
      unauthorizedError(`Invalid token type "m2m" for this operation`)
    );
    expect(() =>
      validateAuthorization(ctx, ["ui", "internal"], ["admin"])
    ).toThrowError(
      unauthorizedError(`Invalid token type "m2m" for this operation`)
    );
    expect(() =>
      validateAuthorization(ctx, ["ui", "maintenance"], ["admin", "security"])
    ).toThrowError(
      unauthorizedError(`Invalid token type "m2m" for this operation`)
    );
  });

  it(`should throw unauthorizedError for "internal" auth data`, () => {
    const ctx: AppContext<InternalAuthData> = {
      ...mockContext,
      authData: {
        tokenType: "internal",
      },
    };
    expect(() => validateAuthorization(ctx, ["m2m"])).toThrowError(
      unauthorizedError(`Invalid token type "internal" for this operation`)
    );
    expect(() => validateAuthorization(ctx, ["maintenance"])).toThrowError(
      unauthorizedError(`Invalid token type "internal" for this operation`)
    );
    expect(() => validateAuthorization(ctx, ["ui"], ["admin"])).toThrowError(
      unauthorizedError(`Invalid token type "internal" for this operation`)
    );
    expect(() =>
      validateAuthorization(ctx, ["ui", "m2m"], ["admin"])
    ).toThrowError(
      unauthorizedError(`Invalid token type "internal" for this operation`)
    );
    expect(() =>
      validateAuthorization(ctx, ["ui", "m2m"], ["admin", "security"])
    ).toThrowError(
      unauthorizedError(`Invalid token type "internal" for this operation`)
    );
  });

  it(`should throw unauthorizedError for "maintenance" auth data`, () => {
    const ctx: AppContext<MaintenanceAuthData> = {
      ...mockContext,
      authData: {
        tokenType: "maintenance",
      },
    };
    expect(() => validateAuthorization(ctx, ["m2m"])).toThrowError(
      unauthorizedError(`Invalid token type "maintenance" for this operation`)
    );
    expect(() => validateAuthorization(ctx, ["internal"])).toThrowError(
      unauthorizedError(`Invalid token type "maintenance" for this operation`)
    );
    expect(() => validateAuthorization(ctx, ["ui"], ["admin"])).toThrowError(
      unauthorizedError(`Invalid token type "maintenance" for this operation`)
    );
    expect(() =>
      validateAuthorization(ctx, ["ui", "m2m"], ["admin"])
    ).toThrowError(
      unauthorizedError(`Invalid token type "maintenance" for this operation`)
    );
    expect(() =>
      validateAuthorization(ctx, ["ui", "m2m"], ["admin", "security"])
    ).toThrowError(
      unauthorizedError(`Invalid token type "maintenance" for this operation`)
    );
  });
});
