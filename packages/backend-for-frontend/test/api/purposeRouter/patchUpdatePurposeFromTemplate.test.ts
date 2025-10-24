/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PurposeId,
  PurposeTemplateId,
  generateId,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockBffApiPatchPurposeUpdateFromTemplateContent,
  getMockBffApiPurposeVersionResource,
} from "../../mockUtils.js";

describe("API POST /purposeTemplates/{purposeTemplateId}/purposes/{purposeId} test", () => {
  const mockPurposeUpdateContent =
    getMockBffApiPatchPurposeUpdateFromTemplateContent();
  const mockPurposeVersionResource = getMockBffApiPurposeVersionResource();
  const mockPurpose = getMockPurpose([
    { ...getMockPurposeVersion(), id: mockPurposeVersionResource.versionId },
  ]);
  const purposeTemplateId = generateId<PurposeTemplateId>();
  const purposeId = mockPurposeVersionResource.purposeId;

  beforeEach(() => {
    clients.purposeProcessClient.patchUpdatePurposeFromTemplate = vi
      .fn()
      .mockResolvedValue(mockPurpose);
  });

  const makeRequest = async (
    token: string,
    templateId: string = purposeTemplateId,
    id: PurposeId = purposeId,
    body: bffApi.PatchPurposeUpdateFromTemplateContent = mockPurposeUpdateContent
  ) =>
    request(api)
      .patch(`${appBasePath}/purposeTemplates/${templateId}/purposes/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPurposeVersionResource);
  });

  it.each([
    {
      purposeId: "invalid" as PurposeId,
      purposeTemplateId,
      mockPurposeUpdateContent,
    },
    {
      purposeId,
      purposeTemplateId: "invalid" as PurposeTemplateId,
      mockPurposeUpdateContent,
    },
    {
      purposeId,
      purposeTemplateId,
      body: { ...mockPurposeUpdateContent, dailyCalls: "invalid" },
    },
    {
      purposeId,
      purposeTemplateId,
      body: {
        ...mockPurposeUpdateContent,
        riskAnalysisForm: {},
      },
    },
    {
      purposeId,
      purposeTemplateId,
      body: {
        ...mockPurposeUpdateContent,
        extraField: 1,
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, purposeTemplateId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeTemplateId,
        purposeId,
        body as bffApi.PatchPurposeUpdateFromTemplateContent
      );
      expect(res.status).toBe(400);
    }
  );
});
