/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { EService, generateId } from "pagopa-interop-models";
import {
  generateToken,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import { eServiceNotFound } from "../../src/model/domain/errors.js";

describe("API /eservices/{eServiceId} authorization test", () => {
  const eservice: EService = getMockEService();

  const apiEservice: catalogApi.EService = catalogApi.EService.parse(
    eServiceToApiEService(eservice)
  );

  const serviceResponse = getMockWithMetadata(eservice);
  catalogService.getEServiceById = vi.fn().mockResolvedValue(serviceResponse);

  const makeRequest = async (token: string, eServiceId: string) =>
    request(api)
      .get(`/eservices/${eServiceId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send();

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.INTERNAL_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 204 for user with role %s",
    async (role) => {
      const token = generateToken(role);
      const res = await makeRequest(token, eservice.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiEservice);
      expect(res.headers["x-metadata-version"]).toBe(
        serviceResponse.metadata.version.toString()
      );
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role Maintenance", async (role) => {
    const token = generateToken(role);
    const res = await makeRequest(token, eservice.id);

    expect(res.status).toBe(403);
  });

  it("Should return 404 for eServiceNotFound", async () => {
    catalogService.getEServiceById = vi
      .fn()
      .mockRejectedValue(eServiceNotFound(eservice.id));

    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, eservice.id);

    expect(res.status).toBe(404);
  });
});
