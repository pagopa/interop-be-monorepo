/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurposeId, PurposeVersionId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPurposeVersionResource } from "../../mockUtils.js";

describe("API POST /purposes/{purposeId}/versions/{versionId}/reject test", () => {
  const mockPurposeVersionResource = getMockBffApiPurposeVersionResource();
  const rejectPayload: bffApi.RejectPurposeVersionPayload = {
    rejectionReason: "Mock reason for rejection",
  };

  beforeEach(() => {
    clients.purposeProcessClient.rejectPurposeVersion = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeVersionResource.purposeId,
    versionId: PurposeVersionId = mockPurposeVersionResource.versionId,
    body: bffApi.RejectPurposeVersionPayload = rejectPayload
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/versions/${versionId}/reject`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { purposeId: "invalid" as PurposeId },
    { versionId: "invalid" as PurposeVersionId },
    { body: {} },
    { body: { rejectionReason: 1 } },
    {
      body: {
        ...rejectPayload,
        extraField: 1,
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, versionId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeId,
        versionId,
        body as bffApi.RejectPurposeVersionPayload
      );
      expect(res.status).toBe(400);
    }
  );
});
