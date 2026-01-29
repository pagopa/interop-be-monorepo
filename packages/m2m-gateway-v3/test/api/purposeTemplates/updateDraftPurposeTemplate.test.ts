import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurposeTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  m2mGatewayApiV3,
  purposeTemplateApi,
} from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded, tenantKind } from "pagopa-interop-models";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";
import { toM2MGatewayApiPurposeTemplate } from "../../../src/api/purposeTemplateApiConverter.js";

describe("PATCH /purposeTemplates/:purposeTemplateId router test", () => {
  const mockPurposeTemplate: purposeTemplateApi.PurposeTemplate =
    getMockedApiPurposeTemplate();

  const mockUpdateSeed: m2mGatewayApiV3.PurposeTemplateDraftUpdateSeed = {
    targetDescription: "updated target description",
  };

  const mockM2MPurposeTemplate: m2mGatewayApiV3.PurposeTemplate =
    toM2MGatewayApiPurposeTemplate(mockPurposeTemplate);

  const makeRequest = async (
    token: string,
    purposeTemplateId: string = mockPurposeTemplate.id,
    body: m2mGatewayApiV3.PurposeTemplateDraftUpdateSeed = mockUpdateSeed
  ) =>
    request(api)
      .patch(`${appBasePath}/purposeTemplates/${purposeTemplateId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/merge-patch+json")
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.updateDraftPurposeTemplate = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeTemplate);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposeTemplate);
      expect(
        mockPurposeTemplateService.updateDraftPurposeTemplate
      ).toHaveBeenCalledWith(
        mockPurposeTemplate.id,
        mockUpdateSeed,
        expect.any(Object) // context
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    {},
    { targetDescription: "updated target description" },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
      purposeIsFreeOfCharge: false,
      purposeFreeOfChargeReason: null,
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
      purposeIsFreeOfCharge: false,
      purposeFreeOfChargeReason: null,
      purposeDailyCalls: 10,
    },
    {
      targetDescription: "updated target description",
      targetTenantKind: tenantKind.PRIVATE,
      purposeTitle: "updated purpose title",
      purposeDescription: "updated purpose description",
      purposeIsFreeOfCharge: false,
      purposeFreeOfChargeReason: null,
      purposeDailyCalls: 10,
      handlesPersonalData: true,
    },
  ] satisfies m2mGatewayApiV3.PurposeTemplateDraftUpdateSeed[])(
    "Should return 200 with partial seed and nullable fields (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token, mockPurposeTemplate.id, seed);
      expect(res.status).toBe(200);
    }
  );

  it("Should return 400 if passed an invalid purpose template id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidPurposeTemplateId");
    expect(res.status).toBe(400);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockUpdateSeed, extraParam: -1 },
    { ...mockUpdateSeed, purposeDescription: "short" },
  ])("Should return 400 if passed invalid seed", async (seed) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockPurposeTemplate.id,
      seed as m2mGatewayApiV3.PurposeTemplateDraftUpdateSeed
    );

    expect(res.status).toBe(400);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockPurposeTemplateService.updateDraftPurposeTemplate = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MPurposeTemplate, createdAt: undefined },
    { ...mockM2MPurposeTemplate, id: "invalidId" },
    { ...mockM2MPurposeTemplate, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockPurposeTemplateService.updateDraftPurposeTemplate = vi
        .fn()
        .mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
