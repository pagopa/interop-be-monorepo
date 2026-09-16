/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { catalogApi } from "pagopa-interop-api-clients";
import { AuthRole, authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  EService,
  generateId,
  descriptorState,
  Descriptor,
  TenantId,
} from "pagopa-interop-models";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import { api, catalogService } from "../vitest.api.setup.js";

describe("API POST /catalog authorization test", () => {
  const producerId: TenantId = generateId();
  const descriptor1: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };
  const eservice1: EService = {
    ...getMockEService(),
    producerId,
    descriptors: [descriptor1],
  };

  const descriptor2: Descriptor = {
    ...getMockDescriptor(),
    state: descriptorState.published,
  };
  const eservice2: EService = {
    ...getMockEService(),
    producerId,
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

  catalogService.queryEServices = vi.fn().mockResolvedValue(mockResponse);

  const body: catalogApi.EServicesFilterPayload = {
    offset: 0,
    limit: 50,
    keyword: "test",
    sortBy: "CREATED_AT_DESC",
    onlyActiveEservices: true,
    producersIds: [producerId],
    producerCategories: [],
    requesterDelegationRoles: [],
  };

  const makeRequest = async (
    token: string,
    payload: catalogApi.EServicesFilterPayload = body
  ) =>
    request(api)
      .post("/catalog")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .send(payload);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ADMIN_ROLE,
    authRole.REVIEWER_ROLE,
    authRole.VIEWER_ROLE,
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

  it.each([
    {},
    { ...body, offset: undefined },
    { ...body, limit: undefined },
    { ...body, offset: -1 },
    { ...body, offset: "not-a-number" },
    { ...body, limit: -10 },
    { ...body, limit: 201 },
    { ...body, limit: "not-a-number" },
    { ...body, sortBy: "invalid-sort" },
    { ...body, mode: "invalid-mode" },
    { ...body, onlyActiveEservices: "yes" },
    { ...body, producersIds: ["not-a-uuid"] },
    { ...body, requesterDelegationRoles: ["WRONG"] },
    { ...body, producerCategories: ["NOT_A_CATEGORY"] },
  ])("Should return 400 if passed invalid params: %s", async (payload) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(
      token,
      payload as catalogApi.EServicesFilterPayload
    );

    expect(res.status).toBe(400);
  });
});
