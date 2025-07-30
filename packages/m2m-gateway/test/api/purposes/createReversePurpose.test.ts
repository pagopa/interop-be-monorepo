import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiDelegation,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  missingMetadata,
  notAnActiveConsumerDelegation,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";

describe("POST /reversePurposes router test", () => {
  const mockPurpose: purposeApi.Purpose = getMockedApiPurpose();

  const mockEServicePurposeSeed: m2mGatewayApi.EServicePurposeSeed = {
    eserviceId: mockPurpose.eserviceId,
    delegationId: generateId(),
    riskAnalysisId: generateId(),
    description: mockPurpose.description,
    dailyCalls: mockPurpose.versions[0].dailyCalls,
    isFreeOfCharge: mockPurpose.isFreeOfCharge,
    title: mockPurpose.title,
  };

  const mockM2MPurpose: m2mGatewayApi.Purpose =
    toM2MGatewayApiPurpose(mockPurpose);

  const makeRequest = async (
    token: string,
    body: m2mGatewayApi.EServicePurposeSeed
  ) =>
    request(api)
      .post(`${appBasePath}/reversePurposes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.createReversePurpose = vi
        .fn()
        .mockResolvedValue(mockM2MPurpose);

      const token = generateToken(role);
      const res = await makeRequest(token, mockEServicePurposeSeed);

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MPurpose);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, mockEServicePurposeSeed);
    expect(res.status).toBe(403);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockEServicePurposeSeed, extraParam: -1 },
    { ...mockEServicePurposeSeed, description: "short" },
  ])("Should return 400 if passed invalid purpose seed", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as m2mGatewayApi.EServicePurposeSeed
    );

    expect(res.status).toBe(400);
  });

  it("Should return 403 in case of notAnActiveConsumerDelegation error", async () => {
    mockPurposeService.createReversePurpose = vi
      .fn()
      .mockRejectedValue(
        notAnActiveConsumerDelegation(
          generateId(),
          generateId(),
          getMockedApiDelegation()
        )
      );
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockEServicePurposeSeed);

    expect(res.status).toBe(403);
  });

  it.each([missingMetadata(), pollingMaxRetriesExceeded(3, 10)])(
    "Should return 500 in case of $code error",
    async (error) => {
      mockPurposeService.createReversePurpose = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockEServicePurposeSeed);

      expect(res.status).toBe(500);
    }
  );

  it.each([
    { ...mockM2MPurpose, createdAt: undefined },
    { ...mockM2MPurpose, eserviceId: "invalidId" },
    { ...mockM2MPurpose, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeService.createReversePurpose = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockEServicePurposeSeed);

      expect(res.status).toBe(500);
    }
  );
});
