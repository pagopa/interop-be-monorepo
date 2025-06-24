/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /producerKeychains/{producerKeychainId}/eservices test", () => {
  const defaultBody: bffApi.EServiceAdditionDetailsSeed = {
    eserviceId: generateId(),
  };

  beforeEach(() => {
    clients.authorizationClient.producerKeychain.addProducerKeychainEService =
      vi.fn().mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    producerKeychainId: string = generateId(),
    body: bffApi.EServiceAdditionDetailsSeed = defaultBody
  ) =>
    request(api)
      .post(`${appBasePath}/producerKeychains/${producerKeychainId}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { producerKeychainId: "invalid" },
    { body: {} },
    { body: { eserviceId: "invalid" } },
    { body: { ...defaultBody, extraField: 1 } },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ producerKeychainId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        producerKeychainId,
        body as bffApi.EServiceAdditionDetailsSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
