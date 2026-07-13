/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockBffApiCreatedResource,
  getMockBffApiEServiceInstanceLabelUpdateSeed,
  getMockCatalogApiEService,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /templates/eservices/:eServiceId/instanceLabel/update", () => {
  const mockEServiceInstanceLabelUpdateSeed =
    getMockBffApiEServiceInstanceLabelUpdateSeed();
  const mockEService = getMockCatalogApiEService();
  const mockCreatedResource = getMockBffApiCreatedResource(mockEService.id);

  beforeEach(() => {
    clients.catalogProcessClient.updateEServiceInstanceLabelAfterPublication =
      vi.fn().mockResolvedValue(mockEService);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = mockEService.id,
    body: bffApi.EServiceInstanceLabelUpdateSeed = mockEServiceInstanceLabelUpdateSeed
  ) =>
    request(api)
      .post(
        `${appBasePath}/templates/eservices/${eServiceId}/instanceLabel/update`
      )
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(body);

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedResource);
  });

  it.each([
    { eServiceId: "invalid" as EServiceId },
    {
      body: {
        ...mockEServiceInstanceLabelUpdateSeed,
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
        body as bffApi.EServiceInstanceLabelUpdateSeed
      );
      expect(res.status).toBe(400);
    }
  );
});
