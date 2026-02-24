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

describe("API POST /producerKeychains test", () => {
  const mockProducerKeychainSeed: bffApi.ProducerKeychainSeed = {
    name: generateMock(z.string().min(5).max(60)),
    description: generateMock(z.string().min(10).max(250)),
    members: generateMock(z.array(z.string().uuid())),
  };
  const mockCreatedResource = {
    id: generateId(),
  };

  beforeEach(() => {
    clients.authorizationClient.producerKeychain.createProducerKeychain = vi
      .fn()
      .mockResolvedValue(mockCreatedResource);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.ProducerKeychainSeed = mockProducerKeychainSeed
  ) =>
    request(api)
      .post(`${appBasePath}/producerKeychains`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedResource);
  });

  it.each([
    { body: {} },
    { body: { ...mockProducerKeychainSeed, name: undefined } },
    { body: { ...mockProducerKeychainSeed, description: "too short" } },
    { body: { ...mockProducerKeychainSeed, members: "invalid" } },
    {
      body: { ...mockProducerKeychainSeed, members: [generateId(), "invalid"] },
    },
    { body: { ...mockProducerKeychainSeed, extraField: 1 } },
  ])("Should return 400 if passed invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as bffApi.ProducerKeychainSeed);
    expect(res.status).toBe(400);
  });
});
