import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/src/mockedPayloadForToken.js";
import { authRole } from "pagopa-interop-commons";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /purposeTemplates/:purposeTemplateId/unlinkEservice", () => {
  const mockPurposeTemplateId = generateId();
  const mockEServiceId = generateId();

  beforeEach(() => {
    clients.purposeTemplateProcessClient.unlinkEServicesFromPurposeTemplate = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: string = mockPurposeTemplateId,
    body: { eserviceId: string } = { eserviceId: mockEServiceId }
  ): Promise<request.Response> =>
    request(api)
      .post(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/unlinkEservice`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it.each([
    { description: "empty body", body: {} },
    {
      description: "missing eserviceId field",
      body: { invalidField: "value" },
    },
    {
      description: "invalid eserviceId format",
      body: { eserviceId: "invalid-uuid" },
    },
    {
      description: "extra fields",
      body: { eserviceId: mockEServiceId, extraField: "should be rejected" },
    },
  ])("Should return 400 for %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      mockPurposeTemplateId,
      body as { eserviceId: string }
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 for invalid purposeTemplateId format", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid-uuid");
    expect(res.status).toBe(400);
  });
});
