/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  generateToken,
  getMockPurpose,
  getMockPurposeVersion,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import {
  Purpose,
  PurposeId,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionDocumentId,
  PurposeVersionId,
  generateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRole, authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, purposeService } from "../vitest.api.setup.js";
import { purposeNotFound } from "../../src/model/domain/errors.js";

const mockRiskAnalysisDocumentPayload: PurposeVersionDocument = {
  id: generateId<PurposeVersionDocumentId>(),
  path: "s3://path/to/the/risk/analysis/file.pdf",
  contentType: "application/pdf",
  createdAt: new Date(),
};
describe("API POST /internal/purposes/:purposeId/versions/:versionId/riskAnalysisDocument test", () => {
  const mockPurpose: Purpose = {
    ...getMockPurpose(),
    versions: [getMockPurposeVersion()],
  };
  const mockVersion: PurposeVersion = mockPurpose.versions[0];
  const serviceResponse = getMockWithMetadata(mockVersion);
  beforeEach(() => {
    purposeService.internalAddUnsignedRiskAnalysisDocumentMetadata = vi
      .fn()
      .mockResolvedValue(serviceResponse);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurpose.id,
    versionId: PurposeVersionId = mockVersion.id,
    payload: PurposeVersionDocument = mockRiskAnalysisDocumentPayload
  ) =>
    request(api)
      .post(
        `/internal/purposes/${purposeId}/versions/${versionId}/riskAnalysisDocument`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  const authorizedRoles: AuthRole[] = [authRole.INTERNAL_ROLE];

  it.each(authorizedRoles)(
    "Should return 204 for user with role %s on successful risk analysis document add",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token);

      expect(
        purposeService.internalAddUnsignedRiskAnalysisDocumentMetadata
      ).toHaveBeenCalledWith(
        mockPurpose.id,
        mockVersion.id,
        mockRiskAnalysisDocumentPayload,
        expect.anything()
      );
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});
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
    {
      error: purposeNotFound(mockPurpose.id),
      expectedStatus: 404,
      description: "purposeNotFound",
    },
  ])(
    "Should return $expectedStatus for $description error",
    async ({ error, expectedStatus }) => {
      purposeService.internalAddUnsignedRiskAnalysisDocumentMetadata = vi
        .fn()
        .mockRejectedValue(error);
      const token = generateToken(authRole.INTERNAL_ROLE);
      const res = await makeRequest(token);
      expect(res.status).toBe(expectedStatus);
    }
  );
  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(
      token,
      "invalid-purpose-id" as PurposeId,
      mockVersion.id
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid version id", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const res = await makeRequest(
      token,
      mockPurpose.id,
      "invalid-version-id" as PurposeVersionId
    );
    expect(res.status).toBe(400);
  });

  it("Should return 400 if passed an invalid risk analysis document payload", async () => {
    const token = generateToken(authRole.INTERNAL_ROLE);
    const invalidPayload = {
      id: generateId(),
      submissionDate: new Date(),
    } as unknown as PurposeVersionDocument;

    const res = await makeRequest(
      token,
      mockPurpose.id,
      mockVersion.id,
      invalidPayload
    );
    expect(res.status).toBe(400);
  });
});
