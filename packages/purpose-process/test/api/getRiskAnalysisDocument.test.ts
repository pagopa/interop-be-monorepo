/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockPurposeVersionDocument,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { purposeApi } from "pagopa-interop-api-clients";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeVersionDocumentToApiPurposeVersionDocument } from "../../src/model/domain/apiConverter.js";
import {
  organizationNotAllowed,
  purposeNotFound,
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
} from "../../src/model/domain/errors.js";

describe("API GET /purposes/{purposeId}/versions/{versionId}/documents/{documentId} test", () => {
  const mockDocument = getMockPurposeVersionDocument();

  const apiResponse = purposeApi.PurposeVersionDocument.parse(
    purposeVersionDocumentToApiPurposeVersionDocument(mockDocument)
  );

  beforeEach(() => {
    purposeService.getRiskAnalysisDocument = vi
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
        `/purposes/${purposeId}/versions/${versionId}/documents/${documentId}`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId());

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.SUPPORT_ROLE,
  ];

  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token);
    expect(res.status).toBe(403);
  });

  it.each([
    { error: purposeNotFound(generateId()), expectedStatus: 404 },
    {
      error: purposeVersionNotFound(generateId(), generateId()),
      expectedStatus: 404,
    },
    {
      error: purposeVersionDocumentNotFound(
        generateId(),
        generateId(),
        generateId()
      ),
      expectedStatus: 404,
    },
    { error: organizationNotAllowed(generateId()), expectedStatus: 403 },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      purposeService.getRiskAnalysisDocument = vi.fn().mockRejectedValue(error);
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
