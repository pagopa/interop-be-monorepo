import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId, PurposeTemplateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/src/mockedPayloadForToken.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";
import { getMockBffApiPurposeTemplate } from "../../mockUtils.js";

describe("API POST /purposeTemplates/{purposeTemplateId}/unsuspend", () => {
  const mockPublishedPurposeTemplate = getMockBffApiPurposeTemplate(
    bffApi.PurposeTemplateState.Enum.PUBLISHED
  );

  beforeEach(() => {
    clients.purposeTemplateProcessClient.unsuspendPurposeTemplate = vi
      .fn()
      .mockResolvedValue(mockPublishedPurposeTemplate);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId
  ): Promise<request.Response> =>
    request(api)
      .post(`${appBasePath}/purposeTemplates/${purposeTemplateId}/unsuspend`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockPublishedPurposeTemplate.id);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("Should return 400 for invalid purpose template id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeTemplateId);
    expect(res.status).toBe(400);
  });
});
