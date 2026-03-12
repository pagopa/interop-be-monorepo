/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurposeId, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import request from "supertest";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockBffApiPurposeVersionResource } from "../../mockUtils.js";

describe("API POST /purposes/{purposeId}/clone test", () => {
  const mockPurpose = getMockPurpose([getMockPurposeVersion()]);
  const mockPurposeVersionResource = getMockBffApiPurposeVersionResource(
    mockPurpose.id,
    mockPurpose.versions[0].id
  );
  const mockPurposeCloneSeed: bffApi.PurposeCloneSeed = {
    eserviceId: generateId(),
  };

  beforeEach(() => {
    clients.purposeProcessClient.clonePurpose = vi
      .fn()
      .mockResolvedValue(mockPurpose);
  });

  const makeRequest = async (
    token: string,
    purposeId: PurposeId = mockPurposeVersionResource.purposeId,
    body: bffApi.PurposeCloneSeed = mockPurposeCloneSeed
  ) =>
    request(api)
      .post(`${appBasePath}/purposes/${purposeId}/clone`)
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
    { body: { eserviceId: "invalid" } },
    {
      body: {
        ...mockPurposeCloneSeed,
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
        body as bffApi.PurposeCloneSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
