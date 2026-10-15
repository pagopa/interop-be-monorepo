import { catalogApi, tenantApi } from "pagopa-interop-api-clients";
import {
  getMockContext,
  getMockedApiEservice,
  getMockedApiFullProducerKeychain,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { describe, expect, it, vi } from "vitest";

import { PagoPAInteropBeClients } from "../src/clients/clientsProvider.js";
import { eServiceNotFound } from "../src/model/errors.js";
import { producerKeychainServiceBuilder } from "../src/services/producerKeychainService.js";
import { getBffMockContext } from "./utils.js";

describe("getProducerKeychainById (service)", () => {
  const ctx = getBffMockContext(getMockContext({}));

  const buildService = ({
    producerKeychain,
    eservices,
    producer,
  }: {
    producerKeychain: ReturnType<typeof getMockedApiFullProducerKeychain>;
    eservices: catalogApi.EService[];
    producer: tenantApi.Tenant;
  }) => {
    const getProducerKeychain = vi.fn().mockResolvedValue(producerKeychain);
    const getEServices = vi.fn().mockResolvedValue({
      results: eservices,
      totalCount: eservices.length,
    });
    const getTenant = vi.fn().mockResolvedValue(producer);

    const clients = {
      authorizationClient: {
        producerKeychain: { getProducerKeychain },
      },
      catalogProcessClient: { getEServices },
      tenantProcessClient: { tenant: { getTenant } },
    } as unknown as PagoPAInteropBeClients;

    return {
      service: producerKeychainServiceBuilder(clients),
      mocks: { getEServices, getProducerKeychain, getTenant },
    };
  };

  it("retrieves e-services in bulk and preserves their order and content", async () => {
    const producer = getMockedApiTenant();
    const firstEService = {
      ...getMockedApiEservice(),
      producerId: producer.id,
    };
    const secondEService = {
      ...getMockedApiEservice(),
      producerId: producer.id,
    };
    const producerKeychain = {
      ...getMockedApiFullProducerKeychain({
        eservices: [firstEService.id, secondEService.id],
      }),
      producerId: producer.id,
    };
    const { service, mocks } = buildService({
      producerKeychain,
      eservices: [secondEService, firstEService],
      producer,
    });

    const result = await service.getProducerKeychainById(
      producerKeychain.id,
      ctx
    );

    expect(mocks.getEServices).toHaveBeenCalledTimes(1);
    expect(mocks.getEServices).toHaveBeenCalledWith({
      queries: {
        eservicesIds: producerKeychain.eservices,
        offset: 0,
        limit: 50,
      },
      headers: ctx.headers,
    });
    expect(mocks.getTenant).toHaveBeenCalledTimes(1);
    expect(mocks.getTenant).toHaveBeenCalledWith({
      params: { id: producer.id },
      headers: ctx.headers,
    });
    expect(result).toEqual({
      id: producerKeychain.id,
      name: producerKeychain.name,
      description: producerKeychain.description,
      createdAt: producerKeychain.createdAt,
      producer: {
        id: producer.id,
        name: producer.name,
      },
      eservices: [
        {
          id: firstEService.id,
          name: firstEService.name,
          producer: {
            id: producer.id,
            name: producer.name,
            kind: producer.kind,
          },
        },
        {
          id: secondEService.id,
          name: secondEService.name,
          producer: {
            id: producer.id,
            name: producer.name,
            kind: producer.kind,
          },
        },
      ],
    });
  });

  it("throws eServiceNotFound when the bulk response omits an e-service", async () => {
    const producer = getMockedApiTenant();
    const visibleEService = {
      ...getMockedApiEservice(),
      producerId: producer.id,
    };
    const missingEService = getMockedApiEservice();
    const producerKeychain = {
      ...getMockedApiFullProducerKeychain({
        eservices: [visibleEService.id, missingEService.id],
      }),
      producerId: producer.id,
    };
    const { service } = buildService({
      producerKeychain,
      eservices: [visibleEService],
      producer,
    });

    await expect(
      service.getProducerKeychainById(producerKeychain.id, ctx)
    ).rejects.toThrow(eServiceNotFound(missingEService.id).message);
  });

  it("does not retrieve e-services when the producer keychain has none", async () => {
    const producer = getMockedApiTenant();
    const producerKeychain = {
      ...getMockedApiFullProducerKeychain(),
      producerId: producer.id,
    };
    const { service, mocks } = buildService({
      producerKeychain,
      eservices: [],
      producer,
    });

    const result = await service.getProducerKeychainById(
      producerKeychain.id,
      ctx
    );

    expect(mocks.getEServices).not.toHaveBeenCalled();
    expect(result.eservices).toEqual([]);
  });
});
