/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockedApiClient } from "pagopa-interop-commons-test";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  unexpectedClientKind,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiConsumerClient } from "../../../src/api/clientApiConverter.js";

describe("POST /clients router test", () => {
  const mockClientSeed: m2mGatewayApi.ClientSeed = {
    name: generateMock(z.string().min(6).max(60)),
    description: generateMock(z.string().min(10).max(250)),
    members: [generateId(), generateId()],
  };

  const mockClient = getMockedApiClient({
    kind: authorizationApi.ClientKind.Values.CONSUMER,
  });
  const mockM2MClientResponse: m2mGatewayApi.Client =
    toM2MGatewayApiConsumerClient(mockClient);

  const makeRequest = async (token: string, body: m2mGatewayApi.ClientSeed) =>
    request(api)
      .post(`${appBasePath}/clients`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockClientService.createClient = vi
        .fn()
        .mockResolvedValue(mockM2MClientResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockClientSeed);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MClientResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockClientSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { ...mockClientSeed, invalidParam: "invalidValue" },
    { ...mockClientSeed, name: undefined },
    { ...mockClientSeed, name: "shrt" },
    { ...mockClientSeed, name: "a".repeat(61) },
    { ...mockClientSeed, description: "short" },
    { ...mockClientSeed, description: "a".repeat(251) },
    { ...mockClientSeed, members: "" },
    { ...mockClientSeed, members: ["invalid-member-id"] },
  ])("Should return 400 if passed an invalid client seed", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as unknown as m2mGatewayApi.ClientSeed
    );

    expect(res.status).toBe(400);
  });

  it.each([missingMetadata(), pollingMaxRetriesExceeded(3, 10)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockClientService.createClient = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockClientSeed);

      expect(res.status).toBe(500);
    }
  );

  it.each([
    { ...mockM2MClientResponse, kind: "INVALID_KIND" },
    { ...mockM2MClientResponse, invalidParam: "invalidValue" },
    { ...mockM2MClientResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockClientService.createClient = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockClientSeed);

      expect(res.status).toBe(500);
    }
  );

  it("Should return 500 in case of unexpectedClientKind error", async () => {
    mockClientService.createClient = vi
      .fn()
      .mockRejectedValue(unexpectedClientKind(mockClient));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockClientSeed);

    expect(res.status).toBe(500);
  });
});
