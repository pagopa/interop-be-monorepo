/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { authRole } from "pagopa-interop-commons";
import { generateToken } from "pagopa-interop-commons-test/index.js";
import { EServiceId, generateId } from "pagopa-interop-models";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { appBasePath } from "../../../src/config/appBasePath.js";
import { getMockCatalogApiEService } from "../../mockUtils.js";
import { api, clients } from "../../vitest.api.setup.js";

describe("API DELETE /eservices/:eServiceId/submitDelegatedArchiving", () => {
  const mockEService = getMockCatalogApiEService();

  beforeEach(() => {
    clients.catalogProcessClient.cancelDelegatedEServiceArchiving = vi
      .fn()
      .mockResolvedValue(mockEService);
  });

  const makeRequest = async (
    token: string,
    eServiceId: EServiceId = mockEService.id
  ) =>
    request(api)
      .delete(`${appBasePath}/eservices/${eServiceId}/submitDelegatedArchiving`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it("Should return 204 if no error is thrown", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token);
    expect(res.status).toBe(204);
  });

  it("Should return 400 if passed an invalid parameter: %s", async () => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, "invalid" as EServiceId);
    expect(res.status).toBe(400);
  });
});
