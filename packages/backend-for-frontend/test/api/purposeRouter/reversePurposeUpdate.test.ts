/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients, services } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { purposeNotFound } from "../../../src/model/errors.js";
import {
  getMockBffApiPurposeUpdateContent,
  getMockBffApiPurposeVersionResource,
} from "../../mockUtils.js";

describe("API POST /reverse/purposes/{purposeId} test", () => {
  const mockPurposeUpdateContent = getMockBffApiPurposeUpdateContent();
  const mockPurposeVersionResource = getMockBffApiPurposeVersionResource();

  beforeEach(() => {
    clients.purposeProcessClient.updateReversePurpose = vi
      .fn()
      .mockResolvedValue({
        versions: [{ id: mockPurposeVersionResource.versionId }],
      });
  });

  const makeRequest = async (
    token: string,
    purposeId: string = mockPurposeVersionResource.purposeId
  ) =>
    request(api)
      .post(`${appBasePath}/reverse/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockPurposeUpdateContent);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPurposeVersionResource);
  });

  it.each([
    {
      error: purposeNotFound(mockPurposeVersionResource.purposeId),
      expectedStatus: 404,
    },
  ])(
    "Should return $expectedStatus for $error.code",
    async ({ error, expectedStatus }) => {
      services.purposeService.reversePurposeUpdate = vi
        .fn()
        .mockRejectedValue(error);
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
