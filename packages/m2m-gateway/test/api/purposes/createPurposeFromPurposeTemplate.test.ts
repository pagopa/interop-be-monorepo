import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiDelegation,
  getMockedApiPurpose,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import {
  generateId,
  pollingMaxRetriesExceeded,
  PurposeTemplateId,
} from "pagopa-interop-models";
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

describe("POST /purposeTemplates/{purposeTemplateId}/purposes router test", () => {
  const purposeTemplateId = generateId<PurposeTemplateId>();
  const mockPurpose: purposeApi.Purpose = getMockedApiPurpose();

  const mockPurposeFromTemplateSeed: m2mGatewayApi.PurposeFromTemplateSeed = {
    dailyCalls: mockPurpose.versions[0].dailyCalls,
    eserviceId: mockPurpose.eserviceId,
    title: mockPurpose.title,
    delegationId: generateId(),
    riskAnalysisForm: generateMock(m2mGatewayApi.RiskAnalysisFormSeed),
  };

  const mockM2MPurpose: m2mGatewayApi.Purpose =
    toM2MGatewayApiPurpose(mockPurpose);

  const makeRequest = async (
    token: string,
    templateId: PurposeTemplateId = purposeTemplateId,
    body: m2mGatewayApi.PurposeFromTemplateSeed
  ) =>
    request(api)
      .post(`${appBasePath}/purposeTemplates/${templateId}/purposes`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 201 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeService.createPurposeFromPurposeTemplate = vi
        .fn()
        .mockResolvedValue(mockM2MPurpose);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        mockPurposeFromTemplateSeed
      );

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockM2MPurpose);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      purposeTemplateId,
      mockPurposeFromTemplateSeed
    );
    expect(res.status).toBe(403);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockPurposeFromTemplateSeed, extraParam: -1 },
    // Fields that are required in PurposeSeed
    { ...mockPurposeFromTemplateSeed, description: "valid description" },
    { ...mockPurposeFromTemplateSeed, freeOfCharge: true },
    { ...mockPurposeFromTemplateSeed, freeOfChargeReason: "valid reason" },
  ])(
    "Should return 400 if passed invalid purpose from template seed",
    async (body) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        body as m2mGatewayApi.PurposeFromTemplateSeed
      );

      expect(res.status).toBe(400);
    }
  );

  it.each([
    delegationEServiceMismatch(generateId(), getMockedApiDelegation()),
    requesterIsNotTheDelegateConsumer(getMockedApiDelegation()),
  ])("Should return 403 in case of $code error", async (error) => {
    mockPurposeService.createPurposeFromPurposeTemplate = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      purposeTemplateId,
      mockPurposeFromTemplateSeed
    );

    expect(res.status).toBe(403);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockPurposeService.createPurposeFromPurposeTemplate = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      purposeTemplateId,
      mockPurposeFromTemplateSeed
    );

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
      mockPurposeService.createPurposeFromPurposeTemplate = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        mockPurposeFromTemplateSeed
      );

      expect(res.status).toBe(500);
    }
  );
});
