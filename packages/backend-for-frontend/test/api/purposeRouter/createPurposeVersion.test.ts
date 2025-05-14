/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPurposeVersionResource } from "../../mockUtils.js";

describe("API POST /purposes/{purposeId}/versions test", () => {
  const mockPurposeVersionResource = getMockBffApiPurposeVersionResource();

  beforeEach(() => {
    clients.purposeProcessClient.createPurposeVersion = vi
      .fn()
      .mockResolvedValue({ id: mockPurposeVersionResource.versionId });
  });

  const makeRequest = async (
    token: string,
    purposeId: string = mockPurposeVersionResource.purposeId
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send({ dailyCalls: 10 });

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body).toEqual(mockPurposeVersionResource);
    expect(res.status).toBe(200);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
