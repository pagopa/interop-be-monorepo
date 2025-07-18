/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DelegationId,
  PurposeId,
  PurposeVersionId,
  generateId,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPurposeVersionResource } from "../../mockUtils.js";

describe("API POST /purposes/{purposeId}/versions/{versionId}/suspend test", () => {
  const mockPurposeVersionResource = getMockBffApiPurposeVersionResource();

  beforeEach(() => {
    clients.purposeProcessClient.suspendPurposeVersion = vi
      .fn()
      .mockResolvedValue({ id: mockPurposeVersionResource.versionId });
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeVersionResource.purposeId,
    versionId: PurposeVersionId = mockPurposeVersionResource.versionId,
    delegationId?: DelegationId
  ) =>
    request(api)
      .post(
        `${appBasePath}/purposes/${purposeId}/versions/${versionId}/suspend`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ delegationId });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPurposeVersionResource);
  });

  it.each([
    { purposeId: "invalid" as PurposeId },
    { versionId: "invalid" as PurposeVersionId },
    { delegationId: "invalid" as DelegationId },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, versionId, delegationId }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, purposeId, versionId, delegationId);
      expect(res.status).toBe(400);
    }
  );
});
