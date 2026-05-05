import { describe, it, expect, vi } from "vitest";
import { generateToken, getMockDPoPProof } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId, pollingMaxRetriesExceeded } from "pagopa-interop-models";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  cannotDeleteLastEServiceTemplateVersion,
  missingMetadata,
} from "../../../src/model/errors.js";
import { config } from "../../../src/config/config.js";

describe("DELETE /eserviceTemplates/:templateId/version/:versionId router test", () => {
  const makeRequest = async (
    token: string,
    templateId: string,
    versionId: string
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eserviceTemplates/${templateId}/versions/${versionId}`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS);

  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s, generateId()",
    async (role) => {
      mockEServiceTemplateService.deleteDraftEServiceTemplateVersion = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, generateId(), generateId());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId(), generateId());
    expect(res.status).toBe(403);
  });

  it("Should return 400 for invalid eservice template id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, "INVALID_ID", generateId());
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalid version id", async () => {
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), "INVALID_ID");
    expect(res.status).toBe(400);
  });

  it("Should return 409 in case of cannotDeleteLastEServiceTemplateVersion error", async () => {
    mockEServiceTemplateService.deleteDraftEServiceTemplateVersion = vi
      .fn()
      .mockRejectedValue(
        cannotDeleteLastEServiceTemplateVersion(generateId(), generateId())
      );
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), generateId());
    expect(res.status).toBe(409);
  });

  it.each([
    missingMetadata(),
    pollingMaxRetriesExceeded(
      config.defaultPollingMaxRetries,
      config.defaultPollingRetryDelay
    ),
  ])("Should return 500 in case of $code error", async (error) => {
    mockEServiceTemplateService.deleteDraftEServiceTemplateVersion = vi
      .fn()
      .mockRejectedValue(error);
    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(token, generateId(), generateId());

    expect(res.status).toBe(500);
  });
});
