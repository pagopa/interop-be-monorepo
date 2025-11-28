/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  InternalAuthData,
  M2MAuthData,
  MaintenanceAuthData,
  UIAuthData,
  getUserInfoFromAuthData,
  AuthDataUserInfo,
  M2MAdminAuthData,
} from "pagopa-interop-commons";
import { generateId, unsafeBrandId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

const mockUiAuthData: UIAuthData = {
  systemRole: undefined,
  externalId: {
    origin: "IPA",
    value: "5N2TR557",
  },
  jti: generateId(),
  selfcareId: unsafeBrandId("1962d21c-c701-4805-93f6-53a877898756"),
  organizationId: unsafeBrandId("69e2865e-65ab-4e48-a638-2037a9ee2ee7"),
  userId: unsafeBrandId("f07ddb8f-17f9-47d4-b31e-35d1ac10e521"),
  userRoles: ["security", "api"],
};

const mockM2MAuthData: M2MAuthData = {
  systemRole: "m2m",
  organizationId: unsafeBrandId("89804b2c-f62e-4867-87a4-3a82f2b03485"),
  jti: generateId(),
};

const mockInternalAuthData: InternalAuthData = {
  systemRole: "internal",
  jti: generateId(),
};

const mockMaintenanceAuthData: MaintenanceAuthData = {
  systemRole: "maintenance",
  jti: generateId(),
};

const mockM2MAdminAuthData: M2MAdminAuthData = {
  systemRole: "m2m-admin",
  organizationId: unsafeBrandId("89804b2c-f62e-4867-87a4-3a82f2b03485"),
  userId: unsafeBrandId("f07ddb8f-17f9-47d4-b31e-35d1ac10e521"),
  clientId: unsafeBrandId("e61249fc-fa7e-4aaf-abc7-5bd069cb56d4"),
  jti: generateId(),
};

describe("authData", () => {
  describe("getUserInfoFromAuthData", () => {
    it("should successfully get user info from UI auth data", async () => {
      const expectedUserInfo: AuthDataUserInfo = {
        userId: mockUiAuthData.userId,
        organizationId: mockUiAuthData.organizationId,
        selfcareId: mockUiAuthData.selfcareId,
      };
      expect(getUserInfoFromAuthData(mockUiAuthData)).toEqual(expectedUserInfo);
    });

    it("should successfully get user info from M2M auth data", async () => {
      const expectedUserInfo: AuthDataUserInfo = {
        userId: undefined,
        organizationId: mockM2MAuthData.organizationId,
        selfcareId: undefined,
      };
      expect(getUserInfoFromAuthData(mockM2MAuthData)).toEqual(
        expectedUserInfo
      );
    });

    it("should successfully get user info from Internal auth data", async () => {
      const expectedUserInfo: AuthDataUserInfo = {
        userId: undefined,
        organizationId: undefined,
        selfcareId: undefined,
      };
      expect(getUserInfoFromAuthData(mockInternalAuthData)).toEqual(
        expectedUserInfo
      );
    });

    it("should successfully get user info from Maintenance auth data", async () => {
      const expectedUserInfo: AuthDataUserInfo = {
        userId: undefined,
        organizationId: undefined,
        selfcareId: undefined,
      };
      expect(getUserInfoFromAuthData(mockMaintenanceAuthData)).toEqual(
        expectedUserInfo
      );
    });

    it("should successfully get user info from M2M Admin auth data", async () => {
      const expectedUserInfo: AuthDataUserInfo = {
        userId: mockM2MAdminAuthData.userId,
        organizationId: mockM2MAdminAuthData.organizationId,
        selfcareId: undefined,
      };
      expect(getUserInfoFromAuthData(mockM2MAdminAuthData)).toEqual(
        expectedUserInfo
      );
    });
  });
});
