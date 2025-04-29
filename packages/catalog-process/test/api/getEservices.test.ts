/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  EService,
  generateId,
  descriptorState,
  Descriptor,
} from "pagopa-interop-models";
import { generateToken } from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import { getMockDescriptor, getMockEService } from "../mockUtils.js";
import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";

describe("API /eservices authorization test", () => {
  const descriptor1: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const eservice1: EService = {
    ...getMockEService(),
    descriptors: [descriptor1],
  };

  const descriptor2: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };

  const eservice2: EService = {
    ...getMockEService(),
    descriptors: [descriptor2],
  };

  const mockResponse = {
    results: [eservice1, eservice2],
    totalCount: 2,
  };

  const apiResponse = catalogApi.EServices.parse({
    results: mockResponse.results.map(eServiceToApiEService),
    totalCount: mockResponse.totalCount,
  });

  catalogService.getEServices = vi.fn().mockResolvedValue(mockResponse);

  const makeRequest = async (token: string) =>
    request(api)
      .get("/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit: 10 });

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
  ];
  it.each(authorizedRoles)(
    "Should return 200 for user with role %s",
    async (role) => {
      const token = generateToken(role);

      const res = await makeRequest(token);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    }
  );

  it.each(
    Object.values(authRole).filter((role) => !authorizedRoles.includes(role))
  )("Should return 403 for user with role %s", async (role) => {
    const token = generateToken(role);

    const res = await makeRequest(token);

    expect(res.status).toBe(403);
  });
});
