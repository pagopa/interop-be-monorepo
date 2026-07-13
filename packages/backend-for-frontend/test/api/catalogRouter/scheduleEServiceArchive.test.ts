/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { bffApi } from "pagopa-interop-api-clients";
import { getMockCatalogApiEService } from "../../mockUtils.js";

describe("API POST /eservices/:eServiceId/scheduleArchive", () => {
  const mockEServiceArchivingReasonSeed: bffApi.EServiceArchivingSeed = {
    archivingReason: "Generic archiving reason",
    gracePeriodDays: 60,
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
    body: bffApi.EServiceArchivingSeed = mockEServiceArchivingReasonSeed
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
    {
      eServiceId: "invalid" as EServiceId,
      body: mockEServiceArchivingReasonSeed,
    },
    {
      eServiceId: generateId<EServiceId>(),
      body: {
        ...mockEServiceArchivingReasonSeed,
        extraField: 1,
      },
    },
    {
      eServiceId: generateId<EServiceId>(),
      body: {
        ...mockEServiceArchivingReasonSeed,
        gracePeriodDays: 0,
      },
    },
    {
      eServiceId: generateId<EServiceId>(),
      body: {
        ...mockEServiceArchivingReasonSeed,
        gracePeriodDays: -1,
      },
    },
    {
      eServiceId: generateId<EServiceId>(),
      body: {
        ...mockEServiceArchivingReasonSeed,
        gracePeriodDays: 1,
      },
    },
    {
      eServiceId: generateId<EServiceId>(),
      body: {
        ...mockEServiceArchivingReasonSeed,
        gracePeriodDays: 29,
      },
    },
  ])(
    "Should return 400 if passed an invalid parameter: %s",
    async ({ eServiceId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        body as bffApi.EServiceArchivingSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
