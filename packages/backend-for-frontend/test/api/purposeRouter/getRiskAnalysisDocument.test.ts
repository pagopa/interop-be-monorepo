/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API GET /purposes/{purposeId}/versions/{versionId}/documents/{documentId} test", () => {
  const mockDocument = new Uint8Array(100).map(() =>
    Math.floor(Math.random() * 256)
  );
  const mockDocumentResponse = Buffer.from(mockDocument);

  beforeEach(() => {
    services.purposeService.getRiskAnalysisDocument = vi
      .fn()
      .mockResolvedValue(mockDocument);
  });

  const makeRequest = async (
    token: string,
    purposeId: string = generateId(),
    versionId: string = generateId(),
    documentId: string = generateId()
  ) =>
    request(api)
      .get(
        `${appBasePath}/purposes/${purposeId}/versions/${versionId}/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockDocumentResponse);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
