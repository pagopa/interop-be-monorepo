import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceTemplate,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import {
  eserviceTemplateApi,
  m2mGatewayApiV3,
} from "pagopa-interop-api-clients";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";
import { toM2MGatewayEServiceTemplate } from "../../../src/api/eserviceTemplateApiConverter.js";

describe("PATCH /eserviceTemplates/:templateId/description router test", () => {
  const mockEServiceTemplate: eserviceTemplateApi.EServiceTemplate =
    getMockedApiEServiceTemplate();

  const mockSeed: m2mGatewayApiV3.EServiceTemplateDescriptionUpdateSeed = {
    description: "updated description",
  };

  const mockM2MEServiceTemplate: m2mGatewayApiV3.EServiceTemplate =
    toM2MGatewayEServiceTemplate(mockEServiceTemplate);

  const makeRequest = async (
    token: string,
    templateId: string = mockEServiceTemplate.id,
    body: m2mGatewayApiV3.EServiceDescriptionUpdateSeed = mockSeed
  ) =>
    request(api)
      .patch(`${appBasePath}/eserviceTemplates/${templateId}/description`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .set("Content-Type", "application/merge-patch+json")
      .send(body);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.updatePublishedEServiceTemplateDescription =
        vi.fn().mockResolvedValue(mockM2MEServiceTemplate);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MEServiceTemplate);
      expect(
        mockEServiceTemplateService.updatePublishedEServiceTemplateDescription
      ).toHaveBeenCalledWith(
        mockEServiceTemplate.id,
        mockSeed,
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

  it("Should return 400 if passed an invalid eservice template id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "invalidEServiceTemplateId");
    expect(res.status).toBe(400);
  });

  it.each([
    { invalidParam: "invalidValue" },
    { ...mockSeed, extraParam: -1 },
    { ...mockSeed, isConsumerDelegable: "invalid" },
  ])("Should return 400 if passed invalid seed (seed #%#)", async (seed) => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockEServiceTemplate.id,
      seed as m2mGatewayApiV3.EServiceDescriptionUpdateSeed
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
    mockEServiceTemplateService.updatePublishedEServiceTemplateDescription = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });

  it.each([
    { ...mockM2MEServiceTemplate, createdAt: undefined },
    { ...mockM2MEServiceTemplate, id: "invalidId" },
    { ...mockM2MEServiceTemplate, extraParam: "extraValue" },
    {},
  ])(
    "Should return 500 when API model parsing fails for response (resp #%#)",
    async (resp) => {
      mockEServiceTemplateService.updatePublishedEServiceTemplateDescription =
        vi.fn().mockResolvedValue(resp);
      const token = generateToken(authRole.M2M_ADMIN_ROLE);
      const res = await makeRequest(token);

      expect(res.status).toBe(500);
    }
  );
});
