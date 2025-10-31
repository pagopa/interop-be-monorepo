/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import {
  EService,
  generateId,
  descriptorState,
  Descriptor,
  TenantId,
  eserviceMode,
} from "pagopa-interop-models";
import {
  generateToken,
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import { AuthRole, authRole } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import { api, catalogService } from "../vitest.api.setup.js";
import {
  eServiceModeToApiEServiceMode,
  eServiceToApiEService,
} from "../../src/model/domain/apiConverter.js";

describe("API /eservices authorization test", () => {
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

  catalogService.getEServices = vi.fn().mockResolvedValue(mockResponse);

  const queryParams: catalogApi.GetEServicesQueryParams = {
    name: "",
    eservicesIds: [eservice1.id, eservice2.id],
    producersIds: [producerId],
    attributesIds: [],
    states: [],
    agreementStates: [],
    mode: eServiceModeToApiEServiceMode(eserviceMode.deliver),
    isConsumerDelegable: false,
    delegated: false,
    templatesIds: [],
    personalData: "FALSE",
    offset: 0,
    limit: 50,
  };

  const makeRequest = async (
    token: string,
    query: catalogApi.GetEServicesQueryParams = queryParams
  ) =>
    request(api)
      .get("/eservices")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", generateId())
      .query(query);

  const authorizedRoles: AuthRole[] = [
    authRole.ADMIN_ROLE,
    authRole.API_ROLE,
    authRole.SECURITY_ROLE,
    authRole.M2M_ROLE,
    authRole.SUPPORT_ROLE,
    authRole.M2M_ADMIN_ROLE,
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
    { ...queryParams, offset: -1 },
    { ...queryParams, offset: "not-a-number" },
    { ...queryParams, limit: -10 },
    { ...queryParams, limit: "not-a-number" },
    { ...queryParams, mode: "invalid-mode" },
    { ...queryParams, isConsumerDelegable: "yes" },
    { ...queryParams, delegated: 1 },
    { ...queryParams, states: ["invalid-state"] },
    { ...queryParams, agreementStates: ["wrong"] },
    { ...queryParams, personalData: "invalid" },
  ])("Should return 400 if passed invalid params: %s", async (query) => {
    const token = generateToken(authRole.ADMIN_ROLE);
    const res = await makeRequest(token, query as typeof queryParams);

    expect(res.status).toBe(400);
  });
});
