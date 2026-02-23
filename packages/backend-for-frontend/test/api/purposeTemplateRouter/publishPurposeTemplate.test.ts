import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId, PurposeTemplateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/src/mockedPayloadForToken.js";
import { authRole } from "pagopa-interop-commons";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /purposeTemplates/{purposeTemplateId}/publish", () => {
  const mockPublishedPurposeTemplateId = generateId<PurposeTemplateId>();

  beforeEach(() => {
    clients.purposeTemplateProcessClient.publishPurposeTemplate = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId
  ): Promise<request.Response> =>
    request(api)
      .post(`${appBasePath}/purposeTemplates/${purposeTemplateId}/publish`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, mockPublishedPurposeTemplateId);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("Should return 400 for invalid purpose template id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeTemplateId);
    expect(res.status).toBe(400);
  });
});
