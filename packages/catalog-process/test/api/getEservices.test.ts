/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  EService,
  generateId,
  descriptorState,
  Descriptor,
} from "pagopa-interop-models";
import { createPayload, getMockAuthData } from "pagopa-interop-commons-test";
import { userRoles, AuthData } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api } from "../vitest.api.setup.js";
import { getMockDescriptor, getMockEService } from "../mockUtils.js";
import { catalogService } from "../../src/routers/EServiceRouter.js";
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

  vi.spyOn(catalogService, "getEServices").mockResolvedValue(mockResponse);

  const generateToken = (authData: AuthData) =>
    jwt.sign(createPayload(authData), "test-secret");

  const makeRequest = async (token: string) =>
    request(api)
      .get("/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query({ offset: 0, limit: 10 });

  it.each([
    userRoles.ADMIN_ROLE,
    userRoles.API_ROLE,
    userRoles.SECURITY_ROLE,
    userRoles.M2M_ROLE,
    userRoles.SUPPORT_ROLE,
  ])("Should return 200 for user with role %s", async (role) => {
    const token = generateToken({
      ...getMockAuthData(),
      userRoles: [role],
    });

    const res = await makeRequest(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(apiResponse);
  });

  it.each([userRoles.INTERNAL_ROLE, userRoles.MAINTENANCE_ROLE])(
    "Should return 403 for user with role %s",
    async (role) => {
      const token = generateToken({
        ...getMockAuthData(),
        userRoles: [role],
      });

      const res = await makeRequest(token);

      expect(res.status).toBe(403);
    }
  );
});
