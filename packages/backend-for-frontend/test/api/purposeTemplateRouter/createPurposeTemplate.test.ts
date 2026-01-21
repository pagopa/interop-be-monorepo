import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { bffApi } from "pagopa-interop-api-clients";
import { generateToken } from "pagopa-interop-commons-test/src/mockedPayloadForToken.js";
import { authRole } from "pagopa-interop-commons";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, clients } from "../../vitest.api.setup.js";
import { getMockPurposeTemplateSeed } from "../../mockUtils.js";

describe("API POST /purposeTemplates", () => {
  const mockPurposeTemplate = getMockPurposeTemplateSeed();
  const mockCreatedResource = {
    id: generateId(),
  };

  beforeEach(() => {
    clients.purposeTemplateProcessClient.createPurposeTemplate = vi
      .fn()
      .mockResolvedValue(mockCreatedResource);
  });

  const makeRequest = async (
    token: string,
    body: bffApi.PurposeTemplateSeed = mockPurposeTemplate
  ): Promise<request.Response> =>
    request(api)
      .post(`${appBasePath}/purposeTemplates`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 201 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(mockCreatedResource);
  });

  it.each([
    { description: "empty body", body: {} },
    {
      description: "missing required field",
      body: { ...mockPurposeTemplate, targetDescription: undefined },
    },
    {
      description: "invalid field length",
      body: { ...mockPurposeTemplate, targetDescription: "123456789" },
    },
    {
      description: "invalid enum value",
      body: {
        ...mockPurposeTemplate,
        targetTenantKind: "invalidTenantKind" as bffApi.TargetTenantKind,
      },
    },
    {
      description: "extra fields",
      body: { ...mockPurposeTemplate, extraField: "should be rejected" },
    },
  ])("Should return 400 for %s", async ({ body }) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      body as unknown as bffApi.PurposeTemplateSeed
    );
    expect(res.status).toBe(400);
  });
});
