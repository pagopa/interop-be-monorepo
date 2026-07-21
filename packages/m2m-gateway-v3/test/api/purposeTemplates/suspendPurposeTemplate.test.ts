import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockedApiPurposeTemplate,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { pollingMaxRetriesExceeded } from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { toM2MGatewayApiPurposeTemplate } from "../../../src/api/purposeTemplateApiConverter.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { config } from "../../../src/config/config.js";
import { missingMetadata } from "../../../src/model/errors.js";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";

describe("POST /purposeTemplates/:purposeTemplateId/suspend router test", () => {
  const mockApiPurposeTemplate = getMockedApiPurposeTemplate(
    m2mGatewayApiV3.PurposeTemplateState.Enum.SUSPENDED
  );
  const mockM2MPurposeTemplateSuspendResponse = toM2MGatewayApiPurposeTemplate(
    mockApiPurposeTemplate
  );

  const makeRequest = async (
    token: string,
    purposeTemplateId: string = mockM2MPurposeTemplateSuspendResponse.id
  ) =>
    request(api)
      .post(`${appBasePath}/purposeTemplates/${purposeTemplateId}/suspend`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.suspendPurposeTemplate = vi
        .fn()
        .mockResolvedValue(mockM2MPurposeTemplateSuspendResponse);

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockM2MPurposeTemplateSuspendResponse);
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
    mockPurposeTemplateService.suspendPurposeTemplate = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token);

    expect(res.status).toBe(500);
  });
});
