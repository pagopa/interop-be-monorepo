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

  describe("availableForRequester validation", () => {
    it("should accept availableForRequester when it is true", async () => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, {
        ...body,
        availableForRequester: true,
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    });

    it("should accept availableForRequester when it is false", async () => {
      const token = generateToken(authRole.ADMIN_ROLE);
      const res = await makeRequest(token, {
        ...body,
        availableForRequester: false,
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(apiResponse);
    });

    it.each(["true", "false", 0, 1, null, [], {}].map((value) => [value]))(
      "should return 400 when availableForRequester is not a boolean (%j)",
      async (availableForRequester) => {
        const token = generateToken(authRole.ADMIN_ROLE);
        vi.mocked(catalogService.queryEServices).mockClear();

        const res = await makeRequest(token, {
          ...body,
          availableForRequester,
        } as catalogApi.EServicesFilterPayload);

        expect(res.status).toBe(400);
        expect(catalogService.queryEServices).not.toHaveBeenCalled();
      }
    );

    it.each([true, false])(
      "should forward availableForRequester to the catalog service (%s)",
      async (availableForRequester) => {
        const token = generateToken(authRole.ADMIN_ROLE);
        const payload = { ...body, availableForRequester };
        vi.mocked(catalogService.queryEServices).mockClear();

        const res = await makeRequest(token, payload);

        expect(res.status).toBe(200);
        expect(catalogService.queryEServices).toHaveBeenCalledExactlyOnceWith(
          payload,
          expect.anything()
        );
      }
    );
  });

  describe("mode validation", () => {
    it.each(["DELIVER", "RECEIVE"] as const)(
      "should accept and forward mode: %s",
      async (mode) => {
        const payload = { ...body, mode };
        vi.mocked(catalogService.queryEServices).mockClear();
        const res = await makeRequest(
          generateToken(authRole.ADMIN_ROLE),
          payload
        );

        expect(res.status).toBe(200);
        expect(res.body).toEqual(apiResponse);
        expect(catalogService.queryEServices).toHaveBeenCalledExactlyOnceWith(
          payload,
          expect.anything()
        );
      }
    );

    it("should accept an omitted mode", async () => {
      vi.mocked(catalogService.queryEServices).mockClear();
      const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

      expect(res.status).toBe(200);
      expect(catalogService.queryEServices).toHaveBeenCalledExactlyOnceWith(
        body,
        expect.anything()
      );
    });

    it.each(
      ["invalid-mode", "deliver", "receive", true, 0, null, [], {}].map(
        (value) => [value]
      )
    )("should return 400 for invalid mode: %j", async (mode) => {
      vi.mocked(catalogService.queryEServices).mockClear();
      const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), {
        ...body,
        mode,
      } as catalogApi.EServicesFilterPayload);

      expect(res.status).toBe(400);
      expect(catalogService.queryEServices).not.toHaveBeenCalled();
    });
  });

  describe("onlySignalHubEnabled validation", () => {
    it.each([true, false])(
      "should accept and forward onlySignalHubEnabled: %s",
      async (onlySignalHubEnabled) => {
        const payload = { ...body, onlySignalHubEnabled };
        vi.mocked(catalogService.queryEServices).mockClear();
        const res = await makeRequest(
          generateToken(authRole.ADMIN_ROLE),
          payload
        );

        expect(res.status).toBe(200);
        expect(res.body).toEqual(apiResponse);
        expect(catalogService.queryEServices).toHaveBeenCalledExactlyOnceWith(
          payload,
          expect.anything()
        );
      }
    );

    it("should accept an omitted onlySignalHubEnabled", async () => {
      vi.mocked(catalogService.queryEServices).mockClear();
      const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

      expect(res.status).toBe(200);
      expect(catalogService.queryEServices).toHaveBeenCalledExactlyOnceWith(
        body,
        expect.anything()
      );
    });

    it.each(["true", "false", 0, 1, null, [], {}].map((value) => [value]))(
      "should return 400 for invalid onlySignalHubEnabled: %j",
      async (onlySignalHubEnabled) => {
        vi.mocked(catalogService.queryEServices).mockClear();
        const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), {
          ...body,
          onlySignalHubEnabled,
        } as catalogApi.EServicesFilterPayload);

        expect(res.status).toBe(400);
        expect(catalogService.queryEServices).not.toHaveBeenCalled();
      }
    );
  });

  describe("asyncExchange validation", () => {
    it.each([true, false])(
      "should accept and forward asyncExchange: %s",
      async (asyncExchange) => {
        const payload = { ...body, asyncExchange };
        vi.mocked(catalogService.queryEServices).mockClear();
        const res = await makeRequest(
          generateToken(authRole.ADMIN_ROLE),
          payload
        );

        expect(res.status).toBe(200);
        expect(res.body).toEqual(apiResponse);
        expect(catalogService.queryEServices).toHaveBeenCalledExactlyOnceWith(
          payload,
          expect.anything()
        );
      }
    );

    it("should accept an omitted asyncExchange", async () => {
      vi.mocked(catalogService.queryEServices).mockClear();
      const res = await makeRequest(generateToken(authRole.ADMIN_ROLE));

      expect(res.status).toBe(200);
      expect(catalogService.queryEServices).toHaveBeenCalledExactlyOnceWith(
        body,
        expect.anything()
      );
    });

    it.each(["true", "false", 0, 1, null, [], {}].map((value) => [value]))(
      "should return 400 for invalid asyncExchange: %j",
      async (asyncExchange) => {
        vi.mocked(catalogService.queryEServices).mockClear();
        const res = await makeRequest(generateToken(authRole.ADMIN_ROLE), {
          ...body,
          asyncExchange,
        } as catalogApi.EServicesFilterPayload);

        expect(res.status).toBe(400);
        expect(catalogService.queryEServices).not.toHaveBeenCalled();
      }
    );
  });

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
