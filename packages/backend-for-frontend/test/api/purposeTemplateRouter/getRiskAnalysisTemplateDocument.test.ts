/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { PurposeTemplateId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api, services } from "../../vitest.api.setup.js";

describe("API GET /purposeTemplates/{purposeTemplateId}/riskAnalysisDocument test", () => {
  const mockDocument = new Uint8Array(100).map(() =>
    Math.floor(Math.random() * 256)
  );
  const mockDocumentResponse = Buffer.from(mockDocument);

  beforeEach(() => {
    services.purposeTemplateService.getRiskAnalysisTemplateDocument = vi
      .fn()
      .mockResolvedValue(mockDocument);
  });

  const makeRequest = async (
    token: string,
    purposeTemplateId: PurposeTemplateId = generateId()
  ) =>
    request(api)
      .get(
        `${appBasePath}/purposeTemplates/${purposeTemplateId}/riskAnalysisDocument`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockDocumentResponse);
  });

  it("Should return 400 if passed invalid PurposeTemplateId", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as PurposeTemplateId);
    expect(res.status).toBe(400);
  });
});
