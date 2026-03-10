import request from "supertest";
import { eserviceTemplateApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  getMockedApiEServiceTemplate,
  generateToken,
} from "pagopa-interop-commons-test";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { describe, it, vi, expect } from "vitest";
import { authRole, AuthRole } from "pagopa-interop-commons";
import { toM2MGatewayEServiceTemplateVersion } from "../../../src/api/eserviceTemplateApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { config } from "../../../src/config/config.js";

describe("PATCH /eserviceTemplates/:templateId/versions/:versionId/quotas router test", () => {
  const mockVersion: eserviceTemplateApi.EServiceTemplateVersion = {
    id: generateId(),
    state: "PUBLISHED",
    attributes: {
      declared: [],
      certified: [],
      verified: [],
    },
    version: 0,
    voucherLifespan: 0,
    docs: [],
    dailyCallsPerConsumer: 10,
    dailyCallsTotal: 10,
  };

  const mockEServiceTemplate: eserviceTemplateApi.EServiceTemplate = {
    ...getMockedApiEServiceTemplate(),
    versions: [mockVersion],
  };
  const mockUpdateSeed: m2mGatewayApi.EServiceTemplateVersionQuotasUpdateSeed =
    {
      voucherLifespan: 3600,
      dailyCallsPerConsumer: 1000,
      dailyCallsTotal: 10000,
    };

  const mockApiEserviceTemplateVersionResponse: m2mGatewayApi.EServiceTemplateVersion =
    toM2MGatewayEServiceTemplateVersion(mockVersion);

  mockEServiceTemplateService.updatePublishedEServiceTemplateVersionQuotas = vi
    .fn()
    .mockResolvedValue(mockApiEserviceTemplateVersionResponse);

  const makeRequest = async (
    token: string,
    templateId: string = mockEServiceTemplate.id,
    versionId: string = mockVersion.id,
    body: m2mGatewayApi.EServiceTemplateVersionQuotasUpdateSeed = mockUpdateSeed
  ) =>
    request(api)
      .patch(
        `${appBasePath}/eserviceTemplates/${templateId}/versions/${versionId}/quotas`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/merge-patch+json")
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockApiEserviceTemplateVersionResponse);
      expect(
        mockEServiceTemplateService.updatePublishedEServiceTemplateVersionQuotas
      ).toHaveBeenCalledWith(
        mockEServiceTemplate.id,
        mockVersion.id,
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
    { voucherLifespan: 120 },
    { dailyCallsPerConsumer: 5000 },
    { dailyCallsTotal: 9999 },
    {
      voucherLifespan: 600,
      dailyCallsPerConsumer: 2000,
      dailyCallsTotal: 20000,
    },
  ] satisfies m2mGatewayApi.EServiceTemplateVersionQuotasUpdateSeed[])(
    "Should return 200 with partial seed (seed #%#)",
    async (seed) => {
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(
        token,
        mockEServiceTemplate.id,
        mockVersion.id,
        seed
      );
      expect(res.status).toBe(200);
    }
  );

  it.each([
    { voucherLifespan: 30 },
    { voucherLifespan: 1000000 },
    { dailyCallsPerConsumer: 0 },
    { dailyCallsTotal: -5 },
    { extraParam: "notAllowed" },
  ])("Should return 400 if passed invalid seed %#", async (seed) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEServiceTemplate.id,
      mockVersion.id,
      seed as m2mGatewayApi.EServiceTemplateVersionQuotasUpdateSeed
    );

    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid templateId", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidTemplateId", mockVersion.id);
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid versionId", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEServiceTemplate.id,
      "invalidVersionId"
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
    mockEServiceTemplateService.updatePublishedEServiceTemplateVersionQuotas =
      vi.fn().mockRejectedValue(error);

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockApiEserviceTemplateVersionResponse, id: "invalidId" },
    { ...mockApiEserviceTemplateVersionResponse, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response",
    async (resp) => {
      mockEServiceTemplateService.updatePublishedEServiceTemplateVersionQuotas =
        vi.fn().mockResolvedValue(resp);

      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
