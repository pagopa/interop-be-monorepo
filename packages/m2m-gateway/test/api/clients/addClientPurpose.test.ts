import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { api, mockClientService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import { getMockedApiClient } from "../../mockUtils.js";
import { toM2MGatewayApiClient } from "../../../src/api/clientApiConverter.js";

describe("POST /clients/:clientId/purposes router test", () => {
  const mockApiClient = getMockedApiClient();
  const mockM2MClientResponse: m2mGatewayApi.Client = toM2MGatewayApiClient(
    mockApiClient.data
  );

  const mockSeed: m2mGatewayApi.ClientAddPurpose = {
    purposeId: generateId(),
  };
  const makeRequest = async (
    token: string,
    clientId: string,
    body: m2mGatewayApi.ClientAddPurpose
  ) =>
    request(api)
      .post(`${appBasePath}/clients/${clientId}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockClientService.addClientPurpose = vi
        .fn()
        .mockResolvedValue(mockM2MClientResponse);

      const token = generateToken(role);
      const res = await makeRequest(token, mockApiClient.data.id, mockSeed);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MClientResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockApiClient.data.id, mockSeed);
    expect(res.status).toBe(403);
  });

  it("Should return 400 if passed an invalid client id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalid-client-id", mockSeed);

    expect(res.status).toBe(400);
  });

  it.each([
    {},
    { ...mockSeed, purposeId: undefined },
    { ...mockSeed, purposeId: "invalid-purpose-id" },
  ])("Should return 400 if passed an invalid seed", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockApiClient.data.id,
      body as m2mGatewayApi.ClientAddPurpose
    );

    expect(res.status).toBe(400);
  });

  it.each([
    { ...mockM2MClientResponse, kind: "invalidKind" },
    { ...mockM2MClientResponse, invalidParam: "invalidValue" },
    { ...mockM2MClientResponse, createdAt: undefined },
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockClientService.addClientPurpose = vi.fn().mockResolvedValueOnce(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockApiClient.data.id, mockSeed);

      expect(res.status).toBe(500);
    }
  );

  it.each([missingMetadata(), resourcePollingTimeout(3)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockClientService.addClientPurpose = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockApiClient.data.id, mockSeed);

      expect(res.status).toBe(500);
    }
  );
});
