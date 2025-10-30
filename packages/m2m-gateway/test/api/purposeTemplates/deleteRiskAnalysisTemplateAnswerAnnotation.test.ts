import { describe, it, expect, vi } from "vitest";
import {
  generateToken,
  getMockedApiPurposeTemplate,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { generateId } from "pagopa-interop-models";
import { api, mockPurposeTemplateService } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("DELETE /purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation router test", () => {
  const authorizedRoles: AuthRole[] = [authRole.M2M_ADMIN_ROLE];
  const mockApiPurposeTemplate = getMockedApiPurposeTemplate();

  const makeRequest = async (
    token: string,
    purposeTemplateId: string = mockApiPurposeTemplate.id,
    answerId: string = generateId()
  ) =>
    request(api)
      .delete(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/riskAnalysis/answers/${answerId}/annotation`
      )
      .set("Authorization", `Bearer ${token}`)
      .send();

  it.each(authorizedRoles)(
    "Should return 204 and perform service calls for user with role %s",
    async (role) => {
      mockPurposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation =
        vi.fn();

      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(res.status).toBe(204);
    }
  );

  it("Should return 400 for incorrect value for purpose id", async () => {
    mockPurposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation =
      vi.fn();

    const token = generateToken(authRole.M2M_ROLE);
    const res = await makeRequest(token, "INVALID ID");
    expect(res.status).toBe(400);
  });

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });
});
