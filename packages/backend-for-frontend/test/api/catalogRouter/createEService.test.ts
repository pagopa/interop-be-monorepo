/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import { appBasePath } from "../../../src/config/appBasePath.js";
import {
  getMockApiCreatedEServiceDescriptor,
  getMockCatalogApiEService,
} from "../../mockUtils.js";
import { EServiceSeed } from "../../../../api-clients/dist/bffApi.js";

describe("API POST /eservices", () => {
  const mockInstanceEServiceSeed: EServiceSeed = {
    name: "name",
    description: "description",
    technology: "REST",
    mode: "DELIVER",
  };
  const mockCatalogApiEService = getMockCatalogApiEService();
  const mockApiCreatedEServiceDescriptor = getMockApiCreatedEServiceDescriptor(
    mockCatalogApiEService.id,
    mockCatalogApiEService.descriptors[0].id
  );

  const makeRequest = async (
    token: string,
    payload: object = mockInstanceEServiceSeed
  ) =>
    request(api)
      .post(`${appBasePath}/eservices`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  beforeEach(() => {
    clients.catalogProcessClient.createEService = vi
      .fn()
      .mockResolvedValue(mockCatalogApiEService);
  });

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedEServiceDescriptor);
  });

  it("Should return 400 if passed an invalid parameter", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, {
      ...mockInstanceEServiceSeed,
      technology: "invalid",
    });
    expect(res.status).toBe(400);
  });
});
