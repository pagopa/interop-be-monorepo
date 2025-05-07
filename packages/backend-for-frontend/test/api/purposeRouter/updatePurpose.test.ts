/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /purposes/{purposeId} test", () => {
  const mockPurposeUpdateContent = {
    title: "Mock purpose title",
    description: "Mock purpose description",
    isFreeOfCharge: true,
    freeOfChargeReason: "Mock reason",
    dailyCalls: 10,
  };
  const mockPurposeVersionResource = {
    purposeId: generateId(),
    versionId: generateId(),
  };

  beforeEach(() => {
    clients.purposeProcessClient.updatePurpose = vi.fn().mockResolvedValue({
      versions: [{ id: mockPurposeVersionResource.versionId }],
    });
  });

  const makeRequest = async (
    token: string,
    purposeId: string = mockPurposeVersionResource.purposeId
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockPurposeUpdateContent);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockPurposeVersionResource);
  });

  it("Should return 400 if passed an invalid purpose id", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
