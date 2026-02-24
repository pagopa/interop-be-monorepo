/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { authRole } from "pagopa-interop-commons";
import { api, clients } from "../../vitest.api.setup.js";
import {
  getMockBffApiCreatedResource,
  getMockCatalogApiEServiceDescriptor,
} from "../../mockUtils.js";
import { appBasePath } from "../../../src/config/appBasePath.js";

describe("API POST /templates/eservices/:eServiceId/upgrade", () => {
  const mockEServiceId = generateId<EServiceId>();
  const mockEServiceDescriptor = getMockCatalogApiEServiceDescriptor();
  const mockApiCreatedResource = getMockBffApiCreatedResource(
    mockEServiceDescriptor.id
  );

  beforeEach(() => {
    clients.catalogProcessClient.upgradeEServiceInstance = vi
      .fn()
      .mockResolvedValue(mockEServiceDescriptor);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = mockEServiceId
  ) =>
    request(api)
      .post(`${appBasePath}/templates/eservices/${eServiceId}/upgrade`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 200 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockApiCreatedResource);
  });

  it("Should return 400 if passed an invalid eServiceId", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as EServiceId);
    expect(res.status).toBe(400);
  });
});
