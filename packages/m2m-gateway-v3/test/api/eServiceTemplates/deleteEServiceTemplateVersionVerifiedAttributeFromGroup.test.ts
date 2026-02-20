import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiEServiceAttribute,
  getMockedApiEServiceTemplate,
  getMockedApiEserviceTemplateVersion,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockEServiceTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("DELETE /eserviceTemplates/{templateId}/versions/{versionId}/verifiedAttributes/groups/{groupIndex}/attributes/{attributeId} router test", () => {
  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  const makeRequest = async (
    token: string,
    templateId: string,
    versionId: string,
    groupIndex: number,
    attributeId: string
  ) =>
    request(api)
      .delete(
        `${appBasePath}/eserviceTemplates/${templateId}/versions/${versionId}/verifiedAttributes/groups/${groupIndex}/attributes/${attributeId}`
      )
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  const mockApiAttribute = getMockedApiEServiceAttribute();
  const mockApiEServiceTemplateVersion = getMockedApiEserviceTemplateVersion({
    attributes: {
      certified: [],
      declared: [],
      verified: [
        [getMockedApiEServiceAttribute(), getMockedApiEServiceAttribute()],
        [mockApiAttribute],
      ],
    },
  });

  const mockApiEserviceTemplate = getMockedApiEServiceTemplate({
    versions: [mockApiEServiceTemplateVersion],
  });

  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockEServiceTemplateService.deleteEServiceTemplateVersionVerifiedAttributeFromGroup =
        vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(
        token,
        mockApiEserviceTemplate.id,
        mockApiEServiceTemplateVersion.id,
        1,
        mockApiAttribute.id
      );
      expect(res.status).toBe(204);
    }
  );

  it("Should return 400 for incorrect value for template id", async () => {
    mockEServiceTemplateService.deleteEServiceTemplateVersionVerifiedAttributeFromGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      "INVALID ID",
      generateId(),
      0,
      generateId()
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for version id", async () => {
    mockEServiceTemplateService.deleteEServiceTemplateVersionVerifiedAttributeFromGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      "INVALID ID",
      0,
      generateId()
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for group index", async () => {
    mockEServiceTemplateService.deleteEServiceTemplateVersionVerifiedAttributeFromGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      -1,
      generateId()
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for incorrect value for attribute id", async () => {
    mockEServiceTemplateService.deleteEServiceTemplateVersionVerifiedAttributeFromGroup =
      vi.fn();

    const token = generateToken(authRole.M2M_ADMIN_ROLE);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      0,
      "INVALID ID"
    );
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    mockEServiceTemplateService.deleteEServiceTemplateVersionVerifiedAttributeFromGroup =
      vi.fn();

    const token = generateToken(role);
    const res = await makeRequest(
      token,
      generateId(),
      generateId(),
      0,
      generateId()
    );
    expect(res.status).toBe(403);
  });
});
