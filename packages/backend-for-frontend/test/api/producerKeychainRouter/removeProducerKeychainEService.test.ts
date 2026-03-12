/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EServiceId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API DELETE /producerKeychains/{producerKeychainId}/eservices/{eserviceId} test", () => {
  beforeEach(() => {
    clients.authorizationClient.producerKeychain.removeProducerKeychainEService =
      vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    producerKeychainId: string = generateId(),
    eserviceId: EServiceId = generateId()
  ) =>
    request(api)
      .delete(
        `${appBasePath}/producerKeychains/${producerKeychainId}/eservices/${eserviceId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { producerKeychainId: "invalid" },
    { eserviceId: "invalid" as EServiceId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ producerKeychainId, eserviceId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, producerKeychainId, eserviceId);
      expect(res.status).toBe(400);
    }
  );
});
