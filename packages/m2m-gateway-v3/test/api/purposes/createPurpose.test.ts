import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiDelegation,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApiV3, purposeApi } from "pagopa-interop-api-clients";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { api, mockPurposeService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  delegationEServiceMismatch,
  missingMetadata,
  requesterIsNotTheDelegateConsumer,
} from "../../../src/model/errors.js";
import { toM2MGatewayApiPurpose } from "../../../src/api/purposeApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /purposes router test", () => {
  const mockPurpose: purposeApi.Purpose = getMockedApiPurpose();

  const mockPurposeSeed: m2mGatewayApiV3.PurposeSeed = {
    dailyCalls: mockPurpose.versions[0].dailyCalls,
    description: mockPurpose.description,
    eserviceId: mockPurpose.eserviceId,
    isFreeOfCharge: mockPurpose.isFreeOfCharge,
    title: mockPurpose.title,
    delegationId: generateId(),
    riskAnalysisForm: generateMock(m2mGatewayApiV3.RiskAnalysisFormSeed),
  };

  const mockM2MPurpose: m2mGatewayApiV3.Purpose =
    toM2MGatewayApiPurpose(mockPurpose);

  const makeRequest = async (token: string, body: m2mGatewayApiV3.PurposeSeed) =>
    request(api)
      .post(`${appBasePath}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
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
  ])("Should return 400 if passed invalid purpose seed", async (body) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, body as m2mGatewayApiV3.PurposeSeed);

    expect(res.status).toBe(400);
  });

  it.each([
    delegationEServiceMismatch(generateId(), getMockedApiDelegation()),
    requesterIsNotTheDelegateConsumer(getMockedApiDelegation()),
  ])("Should return 403 in case of $code error", async (error) => {
    mockPurposeService.createPurpose = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockPurposeSeed);

    expect(res.status).toBe(403);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockPurposeService.createPurpose = vi.fn().mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockPurposeSeed);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MPurpose, createdAt: undefined },
    { ...mockM2MPurpose, eserviceId: "invalidId" },
    { ...mockM2MPurpose, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeService.createPurpose = vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockPurposeSeed);

      expect(res.status).toBe(500);
    }
  );
});
