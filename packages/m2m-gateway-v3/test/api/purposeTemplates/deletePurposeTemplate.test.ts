import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurposeTemplate,
  getMockDPoPProof,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("DELETE /purposeTemplates/:purposeTemplateId router test", () => {
  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];

  const makeRequest = async (token: string, purposeTemplateId: string) =>
    request(api)
      .delete(`${appBasePath}/purposeTemplates/${purposeTemplateId}`)
      .set("Authorization", `DPoP ${token}`)
      .set("DPoP", (await getMockDPoPProof()).dpopProofJWS)
      .send();

  const mockApiPurposeTemplate = getMockedApiPurposeTemplate();

  it.each(authorizedRoles)(
    "Should return 200 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.deletePurposeTemplate = vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token, mockApiPurposeTemplate.id);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({});
    }
  );

  it("Should return 400 for incorrect value for purpose id", async () => {
    mockPurposeTemplateService.deletePurposeTemplate = vi.fn();

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, generateId());
    expect(res.status).toBe(403);
  });
});
