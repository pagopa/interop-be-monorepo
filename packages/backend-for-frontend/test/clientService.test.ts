import { generateMock } from "@anatine/zod-mock";
import {
  authorizationApi,
  catalogApi,
  purposeApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { getMockAuthData, getMockContext } from "pagopa-interop-commons-test";
import {
  ClientId,
  EServiceId,
  generateId,
  PurposeId,
  TenantId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { clientNotFound } from "../src/model/errors.js";
import { clientServiceBuilder } from "../src/services/clientService.js";
import { getBffMockContext } from "./utils.js";

describe("clientService", () => {
  it("should retrieve and enhance client purposes in batches", async () => {
    const clientId = generateId<ClientId>();
    const consumerId = generateId<TenantId>();
    const producerId = generateId<TenantId>();
    const purposeIds = Array.from({ length: 51 }, () =>
      generateId<PurposeId>()
    );
    const eserviceIds = Array.from({ length: 51 }, () =>
      generateId<EServiceId>()
    );
    const purposes = purposeIds.map((id, index) => ({
      ...generateMock(purposeApi.Purpose),
      id,
      eserviceId: eserviceIds[index],
      consumerId,
      title: `Purpose ${index}`,
    }));
    const eservices = eserviceIds.map((id, index) => ({
      ...generateMock(catalogApi.EService),
      id,
      producerId,
      name: `EService ${index}`,
    }));
    const client = {
      ...generateMock(authorizationApi.FullClient),
      id: clientId,
      consumerId,
      adminId: undefined,
      purposes: purposeIds.toReversed(),
    } satisfies authorizationApi.FullClient;
    const consumer = {
      ...generateMock(tenantApi.Tenant),
      id: consumerId,
      name: "Consumer",
    };
    const producer = {
      ...generateMock(tenantApi.Tenant),
      id: producerId,
      name: "Producer",
    };

    const getPurposes = vi
      .fn()
      .mockImplementation(
        ({ queries }: { queries: { offset: number; limit: number } }) =>
          Promise.resolve({
            results: purposes.slice(
              queries.offset,
              queries.offset + queries.limit
            ),
            totalCount: purposes.length,
          })
      );
    const getEServices = vi
      .fn()
      .mockImplementation(
        ({ queries }: { queries: { eservicesIds: EServiceId[] } }) =>
          Promise.resolve({
            results: eservices.filter((e) =>
              queries.eservicesIds.includes(e.id)
            ),
            totalCount: queries.eservicesIds.length,
          })
      );
    const getTenant = vi
      .fn()
      .mockImplementation(({ params }: { params: { id: TenantId } }) =>
        Promise.resolve(params.id === consumerId ? consumer : producer)
      );
    const mockClients = {
      authorizationClient: {
        client: {
          getClient: vi.fn().mockResolvedValue(client),
        },
      },
      purposeProcessClient: { getPurposes },
      catalogProcessClient: { getEServices },
      tenantProcessClient: { tenant: { getTenant } },
      selfcareV2UserClient: {},
      inAppNotificationManagerClient: {},
    } as unknown as PagoPAInteropBeClients;

    const clientService = clientServiceBuilder(mockClients);
    const ctx = getBffMockContext(
      getMockContext({ authData: getMockAuthData() })
    );

    const result = await clientService.getClientById(clientId, ctx);

    expect(getPurposes).toHaveBeenCalledTimes(2);
    expect(getEServices).toHaveBeenCalledTimes(2);
    expect(
      getEServices.mock.calls.every(
        ([{ queries }]) => queries.eservicesIds.length <= 50
      )
    ).toBe(true);
    expect(getTenant).toHaveBeenCalledTimes(2);
    expect(result.purposes.map((purpose) => purpose.purposeId)).toEqual(
      client.purposes
    );
  });

  it("should skip purpose enrichment when the client has no purposes", async () => {
    const clientId = generateId<ClientId>();
    const consumerId = generateId<TenantId>();
    const client = {
      ...generateMock(authorizationApi.FullClient),
      id: clientId,
      consumerId,
      adminId: undefined,
      purposes: [],
    } satisfies authorizationApi.FullClient;
    const consumer = {
      ...generateMock(tenantApi.Tenant),
      id: consumerId,
    };
    const getPurposes = vi.fn();
    const getEServices = vi.fn();
    const getTenant = vi.fn().mockResolvedValue(consumer);
    const mockClients = {
      authorizationClient: {
        client: {
          getClient: vi.fn().mockResolvedValue(client),
        },
      },
      purposeProcessClient: { getPurposes },
      catalogProcessClient: { getEServices },
      tenantProcessClient: { tenant: { getTenant } },
      selfcareV2UserClient: {},
      inAppNotificationManagerClient: {},
    } as unknown as PagoPAInteropBeClients;

    const clientService = clientServiceBuilder(mockClients);
    const ctx = getBffMockContext(
      getMockContext({ authData: getMockAuthData() })
    );

    const result = await clientService.getClientById(clientId, ctx);

    expect(result.purposes).toEqual([]);
    expect(getPurposes).not.toHaveBeenCalled();
    expect(getEServices).not.toHaveBeenCalled();
    expect(getTenant).toHaveBeenCalledTimes(1);
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
