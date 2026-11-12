/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { AxiosError, InternalAxiosRequestConfig } from "axios";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockAuthorizationApiClient,
  getMockBffApiClientSeed,
  getMockBffApiCreatedResource,
} from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /clientsConsumer", () => {
  const mockClientSeed = getMockBffApiClientSeed();
  const mockClientResponse = getMockAuthorizationApiClient();
  const mockApiCreatedResource = getMockBffApiCreatedResource(
    mockClientResponse.id
  );

  beforeEach(() => {
    clients.authorizationClient.client.createConsumerClient = vi
      .fn()
      .mockResolvedValue(mockClientResponse);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.ClientSeed = mockClientSeed
  ) =>
    request(api)
      .post(`${appBasePath}/clientsConsumer`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toEqual(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  it("Should propagate 404 when authorization cannot find a client member", async () => {
    const upstreamProblem = {
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "Client member not found",
      correlationId: "test-correlation-id",
      errors: [{ code: "005-9999", detail: "Client member not found" }],
    };
    const upstreamError = new AxiosError(
      "upstream error",
      "404",
      undefined,
      undefined,
      {
        status: 404,
        data: upstreamProblem,
        statusText: "Not Found",
        config: {} as InternalAxiosRequestConfig,
        headers: {},
      }
    );
    clients.authorizationClient.client.createConsumerClient = vi
      .fn()
      .mockRejectedValue(upstreamError);

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      status: 404,
      errors: upstreamProblem.errors,
    });
  });

  it.each([
    { body: {} },
    { body: { name: mockClientSeed.name } },
    { body: { members: mockClientSeed.members } },
    { body: { ...mockClientSeed, extraField: 1 } },
    { body: { ...mockClientSeed, members: "invalid" } },
    { body: { ...mockClientSeed, members: ["invalid"] } },
  ])("Should return 400 if passed an invalid data: %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, body as bffApi.ClientSeed);
    expect(res.status).toBe(400);
  });
});
