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
