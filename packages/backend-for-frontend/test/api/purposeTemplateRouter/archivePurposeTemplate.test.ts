import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId, PurposeTemplateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/src/mockedPayloadForToken.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";
import { getMockBffApiPurposeTemplate } from "../../mockUtils.js";

describe("API POST /purposeTemplates/{purposeTemplateId}/archive", () => {
  const mockArchivedPurposeTemplate = getMockBffApiPurposeTemplate(
    bffApi.PurposeTemplateState.Enum.ARCHIVED
  );

  beforeEach(() => {
    clients.purposeTemplateProcessClient.archivePurposeTemplate = vi
      .fn()
      .mockResolvedValue(mockArchivedPurposeTemplate);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId
  ): Promise<request.Response> =>
    request(api)
      .post(`${appBasePath}/purposeTemplates/${purposeTemplateId}/archive`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockArchivedPurposeTemplate.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockArchivedPurposeTemplate);
  });

  it("Should return 400 for invalid purpose template id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeTemplateId);
    expect(res.status).toBe(400);
  });
});
