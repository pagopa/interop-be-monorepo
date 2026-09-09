import {
  authorizationApi,
  catalogApi,
  purposeApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  getMockAuthData,
  getMockContext,
  getMockedApiConsumerFullClient,
  getMockedApiEservice,
  getMockedApiPurpose,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { ClientId, generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { clientNotFound } from "../src/model/errors.js";
import { clientServiceBuilder } from "../src/services/clientService.js";
import { getBffMockContext } from "./utils.js";

describe("clientService", () => {
  it("skips purpose and catalog retrieval for an empty client with unrelated visible purposes", async () => {
    const client = getMockedApiConsumerFullClient({ purposes: [] });
    const consumer = { ...getMockedApiTenant(), id: client.consumerId };
    const getPurposes = vi.fn().mockResolvedValue({
      results: [getMockedApiPurpose()],
      totalCount: 1,
    } satisfies purposeApi.Purposes);
    const getEServices = vi
      .fn()
      .mockResolvedValue({ results: [], totalCount: 0 });
    const getTenants = vi.fn().mockResolvedValue({
      results: [consumer],
      totalCount: 1,
    } satisfies tenantApi.Tenants);
    const mockClients = {
      authorizationClient: {
        client: { getClient: vi.fn().mockResolvedValue(client) },
      },
      purposeProcessClient: { getPurposes },
      catalogProcessClient: { getEServices },
      tenantProcessClient: { tenant: { getTenants } },
    } as unknown as PagoPAInteropBeClients;
    const ctx = getBffMockContext(
      getMockContext({ authData: getMockAuthData() })
    );

    const result = await clientServiceBuilder(mockClients).getClientById(
      client.id,
      ctx
    );

    expect(result.purposes).toEqual([]);
    expect(result.consumer).toEqual({ id: consumer.id, name: consumer.name });
    expect(getPurposes).not.toHaveBeenCalled();
    expect(getEServices).not.toHaveBeenCalled();
    expect(getTenants).toHaveBeenCalledExactlyOnceWith({
      headers: ctx.headers,
      queries: { tenantIds: [consumer.id], offset: 0, limit: 50 },
    });
  });

  it("propagates failures from individual tenant lookups", async () => {
    const client = getMockedApiConsumerFullClient({ purposes: [] });
    const error = new Error("Tenant lookup failed");
    const getTenant = vi.fn().mockRejectedValue(error);
    const mockClients = {
      authorizationClient: {
        client: { getClient: vi.fn().mockResolvedValue(client) },
      },
      tenantProcessClient: {
        tenant: {
          getTenants: vi.fn().mockResolvedValue({ results: [], totalCount: 0 }),
          getTenant,
        },
      },
    } as unknown as PagoPAInteropBeClients;
    const ctx = getBffMockContext(
      getMockContext({ authData: getMockAuthData() })
    );

    await expect(
      clientServiceBuilder(mockClients).getClientById(client.id, ctx)
    ).rejects.toBe(error);
    expect(getTenant).toHaveBeenCalledExactlyOnceWith({
      headers: ctx.headers,
      params: { id: client.consumerId },
    });
  });

  it.each(["consumer", "producer", "both"])(
    "enriches client details when %s has no selfcareId",
    async (missingTenant) => {
      const purpose = getMockedApiPurpose();
      const client = getMockedApiConsumerFullClient({ purposes: [purpose.id] });
      const eservice = { ...getMockedApiEservice(), id: purpose.eserviceId };
      const consumer = {
        ...getMockedApiTenant(),
        id: client.consumerId,
        selfcareId: missingTenant === "producer" ? generateId() : undefined,
      };
      const producer = {
        ...getMockedApiTenant(),
        id: eservice.producerId,
        selfcareId: missingTenant === "consumer" ? generateId() : undefined,
      };
      const tenants = [consumer, producer];
      const listedTenants = tenants.filter((tenant) => tenant.selfcareId);
      const getTenant = vi
        .fn()
        .mockImplementation(({ params: { id } }) =>
          Promise.resolve(tenants.find((tenant) => tenant.id === id))
        );
      const mockClients = {
        authorizationClient: {
          client: { getClient: vi.fn().mockResolvedValue(client) },
        },
        purposeProcessClient: {
          getPurposes: vi
            .fn()
            .mockResolvedValue({ results: [purpose], totalCount: 1 }),
        },
        catalogProcessClient: {
          getEServices: vi
            .fn()
            .mockResolvedValue({ results: [eservice], totalCount: 1 }),
        },
        tenantProcessClient: {
          tenant: {
            getTenants: vi.fn().mockResolvedValue({
              results: listedTenants,
              totalCount: listedTenants.length,
            }),
            getTenant,
          },
        },
      } as unknown as PagoPAInteropBeClients;
      const ctx = getBffMockContext(
        getMockContext({ authData: getMockAuthData() })
      );

      const result = await clientServiceBuilder(mockClients).getClientById(
        client.id,
        ctx
      );

      expect(result.consumer).toEqual({ id: consumer.id, name: consumer.name });
      expect(result.purposes).toEqual([
        {
          purposeId: purpose.id,
          title: purpose.title,
          eservice: {
            id: eservice.id,
            name: eservice.name,
            producer: {
              id: producer.id,
              name: producer.name,
              kind: producer.kind,
            },
          },
        },
      ]);
      const omittedTenants = tenants.filter((tenant) => !tenant.selfcareId);
      expect(getTenant).toHaveBeenCalledTimes(omittedTenants.length);
      for (const tenant of omittedTenants) {
        expect(getTenant).toHaveBeenCalledWith({
          headers: ctx.headers,
          params: { id: tenant.id },
        });
      }
    }
  );

  it("retrieves paginated client purpose data in bulk and preserves purpose order", async () => {
    const purposes = Array.from({ length: 51 }, (_, index) => ({
      ...getMockedApiPurpose(),
      title: `Purpose ${index}`,
    }));
    const eservices = purposes.map((purpose, index) => ({
      ...getMockedApiEservice(),
      id: purpose.eserviceId,
      name: `EService ${index}`,
    }));
    const producers = eservices.map((eservice, index) => ({
      ...getMockedApiTenant(),
      id: eservice.producerId,
      name: `Producer ${index}`,
    }));
    const client = getMockedApiConsumerFullClient({
      purposes: purposes.map((purpose) => purpose.id).reverse(),
    });
    const consumer = {
      ...getMockedApiTenant(),
      id: client.consumerId,
      name: "Consumer",
    };

    const getPurposes = vi
      .fn()
      .mockResolvedValueOnce({
        results: purposes.slice(0, 50),
        totalCount: purposes.length,
      } satisfies purposeApi.Purposes)
      .mockResolvedValueOnce({
        results: purposes.slice(50),
        totalCount: purposes.length,
      } satisfies purposeApi.Purposes);
    const getEServices = vi
      .fn()
      .mockResolvedValueOnce({
        results: eservices.slice(0, 50),
        totalCount: eservices.length,
      } satisfies catalogApi.EServices)
      .mockResolvedValueOnce({
        results: eservices.slice(50),
        totalCount: eservices.length,
      } satisfies catalogApi.EServices);
    const tenants = [consumer, ...producers];
    const getTenants = vi
      .fn()
      .mockResolvedValueOnce({
        results: tenants.slice(0, 50),
        totalCount: tenants.length,
      } satisfies tenantApi.Tenants)
      .mockResolvedValueOnce({
        results: tenants.slice(50),
        totalCount: tenants.length,
      } satisfies tenantApi.Tenants);
    const mockClients = {
      authorizationClient: {
        client: { getClient: vi.fn().mockResolvedValue(client) },
      },
      purposeProcessClient: { getPurposes },
      catalogProcessClient: { getEServices },
      tenantProcessClient: { tenant: { getTenants } },
      selfcareV2UserClient: {},
      inAppNotificationManagerClient: {},
    } as unknown as PagoPAInteropBeClients;
    const ctx = getBffMockContext(
      getMockContext({ authData: getMockAuthData() })
    );

    const result = await clientServiceBuilder(mockClients).getClientById(
      client.id,
      ctx
    );

    expect(getPurposes).toHaveBeenCalledTimes(2);
    expect(getPurposes).toHaveBeenNthCalledWith(1, {
      headers: ctx.headers,
      queries: { clientId: client.id, offset: 0, limit: 50 },
    });
    expect(getPurposes).toHaveBeenNthCalledWith(2, {
      headers: ctx.headers,
      queries: { clientId: client.id, offset: 50, limit: 50 },
    });
    expect(getEServices).toHaveBeenCalledTimes(2);
    expect(getEServices).toHaveBeenNthCalledWith(1, {
      headers: ctx.headers,
      queries: {
        eservicesIds: eservices.map((eservice) => eservice.id),
        offset: 0,
        limit: 50,
      },
    });
    expect(getEServices).toHaveBeenNthCalledWith(2, {
      headers: ctx.headers,
      queries: {
        eservicesIds: eservices.map((eservice) => eservice.id),
        offset: 50,
        limit: 50,
      },
    });
    expect(getTenants).toHaveBeenCalledTimes(2);
    expect(getTenants).toHaveBeenNthCalledWith(1, {
      headers: ctx.headers,
      queries: {
        tenantIds: [
          client.consumerId,
          ...eservices.map((eservice) => eservice.producerId),
        ],
        offset: 0,
        limit: 50,
      },
    });
    expect(getTenants).toHaveBeenNthCalledWith(2, {
      headers: ctx.headers,
      queries: {
        tenantIds: [
          client.consumerId,
          ...eservices.map((eservice) => eservice.producerId),
        ],
        offset: 50,
        limit: 50,
      },
    });
    expect(result).toEqual({
      id: client.id,
      name: client.name,
      description: client.description,
      kind: client.kind,
      createdAt: client.createdAt,
      consumer: { id: consumer.id, name: consumer.name },
      admin: undefined,
      purposes: purposes
        .map((purpose, index) => ({
          purposeId: purpose.id,
          title: purpose.title,
          eservice: {
            id: eservices[index].id,
            name: eservices[index].name,
            producer: {
              id: producers[index].id,
              name: producers[index].name,
              kind: producers[index].kind,
            },
          },
        }))
        .reverse(),
    });
  });

  it("should throw clientNotFound when the retrieved client has partial visibility", async () => {
    const clientId = generateId<ClientId>();

    const mockClients = {
      authorizationClient: {
        client: {
          getClient: vi.fn().mockResolvedValue({
            id: clientId,
            consumerId: generateId(),
            kind: authorizationApi.ClientKind.Values.CONSUMER,
            visibility: authorizationApi.Visibility.Values.PARTIAL,
          } satisfies authorizationApi.PartialClient),
        },
      },
      tenantProcessClient: {
        tenant: {
          getTenant: vi.fn(),
        },
      },
      selfcareV2UserClient: {},
      inAppNotificationManagerClient: {},
    } as unknown as PagoPAInteropBeClients;

    const clientService = clientServiceBuilder(mockClients);
    const ctx = getBffMockContext(
      getMockContext({ authData: getMockAuthData() })
    );

    await expect(
      clientService.getClientById(clientId, ctx)
    ).rejects.toThrowError(clientNotFound(clientId));

    expect(
      mockClients.tenantProcessClient.tenant.getTenant
    ).not.toHaveBeenCalled();
  });
});
