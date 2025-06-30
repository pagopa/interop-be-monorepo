/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockBffApiEServiceNameUpdateSeed,
  getMockCatalogApiEService,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /eservices/:eServiceId/name/update", () => {
  const mockEServiceNameUpdateSeed = getMockBffApiEServiceNameUpdateSeed();
  const mockEService = getMockCatalogApiEService();

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = mockEService.id,
    body: bffApi.EServiceNameUpdateSeed = mockEServiceNameUpdateSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/${eServiceId}/name/update`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  beforeEach(() => {
    clients.catalogProcessClient.updateEServiceName = vi
      .fn()
      .mockResolvedValue(mockEService);
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
        ...mockEServiceNameUpdateSeed,
        extraField: 1,
      },
    },
  ])(
    "Should return 400 if passed an invalid parameter",
    async ({ eServiceId, body }) => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(
        token,
        eServiceId,
        body as bffApi.EServiceNameUpdateSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
