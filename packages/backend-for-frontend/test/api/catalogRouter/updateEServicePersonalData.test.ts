/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockBffApiEServicePersonalDataFlagUpdateSeed,
  getMockCatalogApiEService,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /eservices/:eServiceId/personalDataFlag", () => {
  const mockEServicePersonalDataFlagUpdateSeed =
    getMockBffApiEServicePersonalDataFlagUpdateSeed();
  const mockEService = getMockCatalogApiEService();

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = mockEService.id,
    body: bffApi.EServicePersonalDataFlagUpdateSeed = mockEServicePersonalDataFlagUpdateSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/${eServiceId}/personalDataFlag`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    clients.catalogProcessClient.updateEServicePersonalDataFlagAfterPublication =
      vi.fn().mockResolvedValue(mockEService);
  });

  it("Should return 204 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    { body: {} },
    {
      body: {
        ...mockEServicePersonalDataFlagUpdateSeed,
        extraField: 1,
      },
    },
    {
      body: {
        ...mockEServicePersonalDataFlagUpdateSeed,
        personalData: "invalid",
      },
    },
  ])(
    "Should return 400 if passed an invalid parameter",
    async ({ eServiceId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        body as bffApi.EServicePersonalDataFlagUpdateSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
