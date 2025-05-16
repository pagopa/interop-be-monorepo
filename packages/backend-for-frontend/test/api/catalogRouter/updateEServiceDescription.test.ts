/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockApiCreatedResource,
  getMockCatalogApiEService,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /eservices/:eServiceId/description/update", () => {
  const mockEServiceDescriptionUpdateSeed: bffApi.EServiceDescriptionUpdateSeed =
  {
    description: "description",
  };
  const mockEService = getMockCatalogApiEService();
  const mockCreatedResource = getMockApiCreatedResource(mockEService.id);

  const makeRequest = async (
    token: string,
    eServiceId: unknown = mockEService.id
  ) =>
    request(api)
      .post(`${appBasePath}/eservices/${eServiceId}/description/update`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(mockEServiceDescriptionUpdateSeed);

  beforeEach(() => {
    clients.catalogProcessClient.updateEServiceDescription = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockCreatedResource);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid");
    expect(res.status).toBe(400);
  });
});
