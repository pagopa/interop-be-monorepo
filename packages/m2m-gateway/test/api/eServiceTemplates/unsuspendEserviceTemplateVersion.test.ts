import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { toM2MGatewayEServiceTemplateVersion } from "../../../src/api/eserviceTemplateApiConverter.js";
import { config } from "../../../src/config/config.js";

describe("POST /eserviceTemplates/:templateId/versions/:versionId/unsuspend router test", () => {
  const mockApiTemplateVersion = getMockedApiEserviceTemplateVersion({
    state: "PUBLISHED",
  });

  const mockApiTemplate = getMockedApiEServiceTemplate({
    versions: [mockApiTemplateVersion],
  });

  const mockM2MTemplateVersionResponse: m2mGatewayApi.EServiceTemplateVersion =
    toM2MGatewayEServiceTemplateVersion(mockApiTemplateVersion);

  const makeRequest = async (
    token: string,
    templateId: string,
    versionId: string
  ) =>
    request(api)
      .post(
        `${appBasePath}/eserviceTemplates/${templateId}/versions/${versionId}/unsuspend`
      )
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.unsuspendEServiceTemplateVersion = vi
        .fn()
        .mockResolvedValue(mockM2MTemplateVersionResponse);

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockApiTemplate.id,
        mockApiTemplateVersion.id
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MTemplateVersionResponse);
    }
  );

  it("Should return 400 for invalid template id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "INVALID_ID",
      mockApiTemplateVersion.id
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalid version id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, mockApiTemplate.id, "INVALID_ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(
      token,
      mockApiTemplate.id,
      mockApiTemplateVersion.id
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
    mockEServiceTemplateService.unsuspendEServiceTemplateVersion = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockApiTemplate.id,
      mockApiTemplateVersion.id
    );

    expect(res.status).toBe(500);
  });
});
