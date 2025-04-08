/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { EService, generateId } from "pagopa-interop-models";
import { createPayload, getMockAuthData } from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { getMockEService } from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import { eServiceNotFound } from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId} authorization test", () => {
  const eservice: EService = getMockEService();

  const apiEservice: catalogApi.EService = catalogApi.EService.parse(
    eServiceToApiEService(eservice)
  );

  vi.spyOn(catalogService, "getEServiceById").mockResolvedValue(eservice);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string, eServiceId: string) =>
    request(api)
      .get(`/eservices/${eServiceId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  it.each([
    userRoles.ADMIN_ROLE,
    userRoles.API_ROLE,
    userRoles.SECURITY_ROLE,
    userRoles.M2M_ROLE,
    userRoles.SUPPORT_ROLE,
    userRoles.INTERNAL_ROLE,
  ])("Should return 204 for user with role %s", async (role) => {
    const token = generateToken({
      ...getMockAuthData(),
      userRoles: [role],
    });
    const res = await makeRequest(token, eservice.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiEservice);
  });

  it("Should return 403 for user with role Maintenance", async () => {
    const token = generateToken({
      ...getMockAuthData(),
      userRoles: [userRoles.MAINTENANCE_ROLE],
    });
    const res = await makeRequest(token, eservice.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 for eServiceNotFound", async () => {
    vi.spyOn(catalogService, "getEServiceById").mockRejectedValue(
      eServiceNotFound(eservice.id)
    );

    const res = await makeRequest(
      generateToken(getMockAuthData()),
      generateId()
    );

    expect(res.status).toBe(404);
  });
});
