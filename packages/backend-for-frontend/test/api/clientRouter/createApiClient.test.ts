/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { createClientApiClient } from "../../../../api-clients/dist/generated/authorizationApi.js";
import {
  getMockAuthorizationApiClient,
  getMockBffApiClientSeed,
  getMockBffApiCreatedResource,
} from "../../mockUtils.js";

describe("API POST /clientsApi", () => {
  const mockClientSeed = getMockBffApiClientSeed();
  const mockClientResponse = getMockAuthorizationApiClient();
  const mockApiCreatedResource = getMockBffApiCreatedResource(
    mockClientResponse.id
  );

  const makeRequest = async (
    token: string,
    body: bffApi.ClientSeed = mockClientSeed
  ) =>
    request(api)
      .post(`${appBasePath}/clientsApi`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    clients.authorizationClient.client = {} as ReturnType<
      typeof createClientApiClient
    >;
    clients.authorizationClient.client.createApiClient = vi
      .fn()
      .mockResolvedValue(mockClientResponse);
  });

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toEqual(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {
      ...mockClientSeed,
      id: "invalid",
    } as bffApi.ClientSeed);
    expect(res.status).toBe(400);
  });
});
