/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId, PurposeTemplateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPurposeTemplateWithCompactCreator } from "../../mockUtils.js";
import { tenantNotFound } from "../../../src/model/errors.js";

describe("API GET /purposeTemplates/{purposeTemplateId}", () => {
  const mockPurposeTemplate = getMockBffApiPurposeTemplateWithCompactCreator();

  beforeEach(() => {
    services.purposeTemplateService.getPurposeTemplate = vi
      .fn()
      .mockResolvedValue(mockPurposeTemplate);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = mockPurposeTemplate.id
  ) =>
    request(api)
      .get(`${appBasePath}/purposeTemplates/${purposeTemplateId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPurposeTemplate);
  });

  it("Should return 404 for tenantNotFound", async () => {
    services.purposeTemplateService.getPurposeTemplate = vi
      .fn()
      .mockRejectedValue(tenantNotFound(mockPurposeTemplate.creator.id));
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(404);
  });

  it("Should return 400 if passed an invalid purpose template id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeTemplateId);
    expect(res.status).toBe(400);
  });
});
