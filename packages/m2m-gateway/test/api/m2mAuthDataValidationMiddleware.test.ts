/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import {
  generateToken,
  mockM2MAdminClientId,
  getMockedApiConsumerFullClient,
  getMockedApiAttribute,
} from "pagopa-interop-commons-test";
import { authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import {
  api,
  mockAttributeService,
  mockGetClientAdminId,
} from "../vitest.api.setup.js";
import { appBasePath } from "../../src/config/appBasePath.js";
import { clientAdminIdNotFound } from "../../src/model/errors.js";
import { toM2MGatewayApiCertifiedAttribute } from "../../src/api/attributeApiConverter.js";

describe("m2mAuthDataValidationMiddleware", () => {
  const makeRequest = async (token: string) =>
    request(api)
      .get(`${appBasePath}/certifiedAttributes/${generateId()}`)
      .set("Authorization", `Bearer ${token}`)
      .send();
  // ^ using GET /certifiedAttributes/:attributeId as a dummy endpoint to test the middleware

  mockAttributeService.getCertifiedAttribute = vi.fn().mockResolvedValue(
    toM2MGatewayApiCertifiedAttribute({
      attribute: getMockedApiAttribute({
        kind: attributeRegistryApi.AttributeKind.Values.CERTIFIED,
      }),
      logger: genericLogger,
    })
  );

  it("Should correctly validate m2m-admin auth data and client admin id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(200);

    expect(mockGetClientAdminId).toHaveBeenCalledWith(
      mockM2MAdminClientId,
      expect.any(Object)
    );
  });

  it("Should correctly validate m2m auth data no matter the client admin id", async () => {
    const token = generateToken(authRole.M2M_ROLE);
    const res1 = await makeRequest(token);

    expect(res1.status).toBe(200);

    mockGetClientAdminId.mockResolvedValueOnce(generateId());
    const res2 = await makeRequest(token);

    expect(res2.status).toBe(200);

    expect(mockGetClientAdminId).not.toHaveBeenCalled();
  });

  it("Should return 403 in case the client adminId is not the same as the one in the token", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    mockGetClientAdminId.mockResolvedValueOnce(generateId());
    const res = await makeRequest(token);

    expect(res.status).toBe(403);

    expect(mockGetClientAdminId).toHaveBeenCalledWith(
      mockM2MAdminClientId,
      expect.any(Object)
    );
  });

  it.each(
    Object.values(authRole).filter(
      (role) => role !== authRole.M2M_ADMIN_ROLE && role !== authRole.M2M_ROLE
    )
  )(
    "Should return 403 for user with role %s, no matter the client id",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(403);

      expect(mockGetClientAdminId).not.toHaveBeenCalled();
    }
  );

  it("Should return 403 if getClientAdminId throws clientAdminIdNotFound", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    mockGetClientAdminId.mockRejectedValue(
      clientAdminIdNotFound(getMockedApiConsumerFullClient())
    );
    const res = await makeRequest(token);

    expect(res.status).toBe(403);

    expect(mockGetClientAdminId).toHaveBeenCalledWith(
      mockM2MAdminClientId,
      expect.any(Object)
    );
  });
});
