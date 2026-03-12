/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurposeId, generateId } from "pagopa-interop-models";
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
  getMockBffApiPurposeUpdateContent,
  getMockBffApiPurposeVersionResource,
} from "../../mockUtils.js";

describe("API POST /purposes/{purposeId} test", () => {
  const mockPurposeUpdateContent = getMockBffApiPurposeUpdateContent();
  const mockPurposeVersionResource = getMockBffApiPurposeVersionResource();
  const mockPurpose = getMockPurpose([
    { ...getMockPurposeVersion(), id: mockPurposeVersionResource.versionId },
  ]);

  beforeEach(() => {
    clients.purposeProcessClient.updatePurpose = vi
      .fn()
      .mockResolvedValue(mockPurpose);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeVersionResource.purposeId,
    body: bffApi.PurposeUpdateContent = mockPurposeUpdateContent
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}`)
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
    { purposeId: "invalid" as PurposeId },
    { body: {} },
    { body: { dailyCalls: "invalid" } },
    {
      body: {
        ...mockPurposeUpdateContent,
        extraField: 1,
      },
    },
  ])(
    "Should return 400 if passed invalid data: %s",
    async ({ purposeId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        purposeId,
        body as bffApi.PurposeUpdateContent
      );
      expect(res.status).toBe(400);
    }
  );
});
