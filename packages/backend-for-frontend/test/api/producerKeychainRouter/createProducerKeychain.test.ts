/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { generateMock } from "@anatine/zod-mock";
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

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

  it("Should propagate 404 for a missing producer keychain member", async () => {
    const problem = {
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "User not found",
      errors: [{ code: "005-0016", detail: "User not found" }],
    };
    clients.authorizationClient.producerKeychain.createProducerKeychain = vi
      .fn()
      .mockRejectedValueOnce(
        new AxiosError("User not found", "404", undefined, undefined, {
          status: 404,
          statusText: "Not Found",
          data: problem,
          headers: {},
          config: {} as InternalAxiosRequestConfig,
        })
      );
    const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ status: 404, errors: problem.errors });
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
