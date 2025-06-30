/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { generateMock } from "@anatine/zod-mock";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /producerKeychains/{producerKeychainId}/encoded/keys/{keyId} test", () => {
  const mockEncodedClientKey: bffApi.EncodedClientKey = {
    key: generateMock(z.string()),
  };

  beforeEach(() => {
    clients.authorizationClient.producerKeychain.getProducerKeyById = vi
      .fn()
      .mockResolvedValue({ encodedPem: mockEncodedClientKey.key });
  });

  const makeRequest = async (
    token: string,
    producerKeychainId: string = generateId(),
    keyId: string = generateId()
  ) =>
    request(api)
      .get(
        `${appBasePath}/producerKeychains/${producerKeychainId}/encoded/keys/${keyId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockEncodedClientKey);
  });

  it("Should return 400 if passed an invalid producer keychain id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
