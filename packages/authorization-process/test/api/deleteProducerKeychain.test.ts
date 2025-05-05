/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateId, ProducerKeychain } from "pagopa-interop-models";
import {
  generateToken,
  getMockProducerKeychain,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, authorizationService } from "../vitest.api.setup.js";

describe("API /clients/{clientId} authorization test", () => {
  const mockProducerKeychain: ProducerKeychain = {
    ...getMockProducerKeychain(),
    producerId: getMockTenant().id,
  };

  authorizationService.deleteProducerKeychain = vi.fn().mockResolvedValue({});

  const makeRequest = async (token: string, producerKeychainId: string) =>
    request(api)
      .delete(`/producerKeychains/${producerKeychainId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [authRole.ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, mockProducerKeychain.id);
      expect(res.status).toBe(204);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockProducerKeychain.id);
    expect(res.status).toBe(403);
  });
});
