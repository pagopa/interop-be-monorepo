import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiPurposeTemplate,
} from "pagopa-interop-commons-test";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { toM2MGatewayApiPurposeTemplate } from "../../../src/api/purposeTemplateApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";

describe("POST /purposeTemplates/:purposeTemplateId/archive router test", () => {
  const mockApiPurposeTemplate = getMockedApiPurposeTemplate(
    m2mGatewayApi.PurposeTemplateState.Enum.ARCHIVED
  );
  const mockM2MPurposeTemplateArchiveResponse = toM2MGatewayApiPurposeTemplate(
    mockApiPurposeTemplate
  );

  const makeRequest = async (
    token: string,
    purposeTemplateId: string = mockM2MPurposeTemplateArchiveResponse.id
  ) =>
    request(api)
      .post(`${appBasePath}/purposeTemplates/${purposeTemplateId}/archive`)
      .set("Authorization", `Bearer ${token}`)
      .send();

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.archivePurposeTemplate = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeTemplateArchiveResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposeTemplateArchiveResponse);
    }
  );

  it("Should return 400 for invalid purpose template id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID_ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockPurposeTemplateService.archivePurposeTemplate = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });
});
