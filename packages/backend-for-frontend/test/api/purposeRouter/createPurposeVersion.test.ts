/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurposeId, generateId } from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPurposeVersionResource } from "../../mockUtils.js";

describe("API POST /purposes/{purposeId}/versions test", () => {
  const mockPurposeVersionResource = getMockBffApiPurposeVersionResource();

  beforeEach(() => {
    clients.purposeProcessClient.createPurposeVersion = vi
      .fn()
      .mockResolvedValue({
        createdVersionId: mockPurposeVersionResource.versionId,
      });
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeVersionResource.purposeId,
    body: bffApi.PurposeVersionSeed = {
      dailyCalls: 10,
    }
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/versions`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 for user with role Admin", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.body).toEqual(mockPurposeVersionResource);
    expect(res.status).toBe(200);
  });

  it.each([
    { purposeId: "invalid" as PurposeId },
    { body: {} },
    { body: { dailyCalls: -1 } },
    {
      body: {
        dailyCalls: 10,
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
        body as bffApi.PurposeVersionSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
