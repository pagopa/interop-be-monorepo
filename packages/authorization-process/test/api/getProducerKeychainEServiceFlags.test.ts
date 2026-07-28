/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AuthRole, authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { EServiceId, TenantId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { api, authorizationService } from "../vitest.api.setup.js";

describe("API /producerKeychains/eservices/{eserviceId}/flags authorization test", () => {
  const eserviceId = generateId<EServiceId>();
  const producerId = generateId<TenantId>();
  const response = {
    hasProducerKeychain: true,
    hasProducerKeychainKeys: true,
  };

  authorizationService.getProducerKeychainEServiceFlags = vi
    .fn()
    .mockResolvedValue(response);

  const makeRequest = async (
    token: string,
    query: { producerId?: TenantId | string } = { producerId }
  ) =>
    request(api)
      .get(`/producerKeychains/eservices/${eserviceId}/flags`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
    authRole.API_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.REVIEWER_ROLE,
    authRole.VIEWER_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 with role %s and return producer keychain eservice flags",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(response);
      expect(
        authorizationService.getProducerKeychainEServiceFlags
      ).toHaveBeenCalledWith(
        {
          eserviceId,
          producerId,
        },
        expect.anything()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([{}, { producerId: "invalid-producer-id" }])(
    "Should return 400 if passed invalid params: %s",
    async (query) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, query);

      expect(res.status).toBe(400);
    }
  );
});
