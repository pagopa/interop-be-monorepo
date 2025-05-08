import { describe, it, expect, vi } from "vitest";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole, genericLogger } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { WithMetadata } from "pagopa-interop-models";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  resourcePollingTimeout,
} from "../../../src/model/errors.js";
import { getMockedApiPurpose } from "../../mockUtils.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";

describe("POST /purposes router test", () => {
  const mockPurpose: WithMetadata<purposeApi.Purpose> = getMockedApiPurpose();

  const mockPurposeSeed: m2mGatewayApi.PurposeSeed = {
    consumerId: mockPurpose.data.id,
    dailyCalls: mockPurpose.data.versions[0].dailyCalls,
    description: mockPurpose.data.description,
    eserviceId: mockPurpose.data.eserviceId,
    isFreeOfCharge: mockPurpose.data.isFreeOfCharge,
    title: mockPurpose.data.title,
  };

  const mockM2MPurpose: m2mGatewayApi.Purpose = toM2MGatewayApiPurpose({
    purpose: mockPurpose.data,
    logger: genericLogger,
  });

  const makeRequest = async (token: string, body: m2mGatewayApi.PurposeSeed) =>
    request(api)
      .post(`${appBasePath}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform API clients calls for user with role %s",
    async (role) => {
      mockPurposeService.createPurpose = vi
        .fn()
        .mockResolvedValue(mockM2MPurpose);

      const token = generateToken(role);
      const res = await makeRequest(token, mockPurposeSeed);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MPurpose);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockPurposeSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockPurposeSeed, extraParam: -1 },
    { ...mockPurposeSeed, description: "short" },
  ])("Should return 400 if passed invalid delegation seed", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as unknown as m2mGatewayApi.PurposeSeed
    );

    expect(res.status).toBe(400);
  });

  it("Should return 500 in case of missingMetadata error", async () => {
    mockPurposeService.createPurpose = vi
      .fn()
      .mockRejectedValue(missingMetadata());
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockPurposeSeed);

    expect(res.status).toBe(500);
  });

  it("Should return 500 in case of resourcePollingTimeout error", async () => {
    mockPurposeService.createPurpose = vi
      .fn()
      .mockRejectedValue(resourcePollingTimeout(3));
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockPurposeSeed);

    expect(res.status).toBe(500);
  });
});
