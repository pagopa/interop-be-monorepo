/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { bffApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockCatalogApiEService } from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API POST /eservices/:eServiceId/scheduleArchive", () => {
  const mockEServiceArchivingReasonSeed: bffApi.EServiceArchivingReasonSeed = {
    archivingReason: "Generic archiving reason",
  };
  const mockEService = getMockCatalogApiEService();

  beforeEach(() => {
    clients.catalogProcessClient.scheduleEServiceArchiving = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = mockEService.id,
    body: bffApi.EServiceArchivingReasonSeed = mockEServiceArchivingReasonSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/${eServiceId}/scheduleArchive`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 204 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    {
      body: {
        ...mockEServiceArchivingReasonSeed,
        extraField: 1,
      },
    },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        body as bffApi.EServiceArchivingReasonSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
