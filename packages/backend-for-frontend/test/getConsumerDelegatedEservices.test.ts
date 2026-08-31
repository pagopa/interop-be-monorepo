import {
  catalogApi,
  delegationApi,
  inAppNotificationApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { FileManager } from "pagopa-interop-commons";
import {
  createDummyStub,
  getMockContext,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { EServiceId, generateId, TenantId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import type {
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

import { tenantNotFound } from "../src/model/errors.js";
import { delegationServiceBuilder } from "../src/services/delegationService.js";
import { getBffMockContext } from "./utils.js";

describe("getConsumerDelegatedEservices", () => {
  it("retrieves distinct producers with one bulk tenant call", async () => {
    const producer1 = {
      ...getMockedApiTenant(),
      id: generateId<TenantId>(),
      name: "Producer one",
      mails: [],
    };
    const producer2 = {
      ...getMockedApiTenant(),
      id: generateId<TenantId>(),
      name: "Producer two",
      mails: [],
    };
    const eservices: delegationApi.CompactEService[] = [
      {
        id: generateId<EServiceId>(),
        name: "First e-service",
        producerId: producer1.id,
      },
      {
        id: generateId<EServiceId>(),
        name: "Second e-service",
        producerId: producer2.id,
      },
      {
        id: generateId<EServiceId>(),
        name: "Third e-service",
        producerId: producer1.id,
      },
    ];
    const { service, getTenant, getTenants, ctx } = buildService({
      eservices,
      tenants: [producer1, producer2],
    });

    const result = await service.getConsumerDelegatedEservices(
      {
        delegatorId: generateId<TenantId>(),
        offset: 0,
        limit: 10,
      },
      ctx
    );

    expect(result.results).toEqual([
      {
        id: eservices[0].id,
        name: eservices[0].name,
        producer: {
          id: producer1.id,
          name: producer1.name,
          kind: producer1.kind,
          contactMail: undefined,
        },
      },
      {
        id: eservices[1].id,
        name: eservices[1].name,
        producer: {
          id: producer2.id,
          name: producer2.name,
          kind: producer2.kind,
          contactMail: undefined,
        },
      },
      {
        id: eservices[2].id,
        name: eservices[2].name,
        producer: {
          id: producer1.id,
          name: producer1.name,
          kind: producer1.kind,
          contactMail: undefined,
        },
      },
    ]);
    expect(result.pagination).toEqual({
      offset: 0,
      limit: 10,
      totalCount: eservices.length,
    });
    expect(getTenant).not.toHaveBeenCalled();
    expect(getTenants).toHaveBeenCalledTimes(1);
    expect(getTenants).toHaveBeenCalledWith({
      headers: ctx.headers,
      queries: {
        tenantIds: [producer1.id, producer2.id],
        offset: 0,
        limit: 50,
      },
    });
  });

  it("throws tenant not found when a producer is missing from the bulk response", async () => {
    const producerId = generateId<TenantId>();
    const eservice: delegationApi.CompactEService = {
      id: generateId<EServiceId>(),
      name: "Delegated e-service",
      producerId,
    };
    const { service, getTenant, getTenants, ctx } = buildService({
      eservices: [eservice],
      tenants: [],
    });

    await expect(
      service.getConsumerDelegatedEservices(
        {
          delegatorId: generateId<TenantId>(),
          offset: 0,
          limit: 10,
        },
        ctx
      )
    ).rejects.toThrow(tenantNotFound(producerId).message);

    expect(getTenant).not.toHaveBeenCalled();
    expect(getTenants).toHaveBeenCalledTimes(1);
  });
});

function buildService({
  eservices,
  tenants,
}: {
  eservices: delegationApi.CompactEService[];
  tenants: tenantApi.Tenant[];
}) {
  const getTenant = vi.fn();
  const getTenants = vi.fn().mockResolvedValue({
    results: tenants,
    totalCount: tenants.length,
  });
  const delegationProcessClient = {
    consumer: {
      getConsumerEservices: vi.fn().mockResolvedValue({
        results: eservices,
        totalCount: eservices.length,
      }),
    },
  } as unknown as DelegationProcessClient;
  const tenantProcessClient = {
    tenant: { getTenant, getTenants },
  } as unknown as TenantProcessClient;
  const ctx = getBffMockContext(getMockContext({}));

  return {
    service: delegationServiceBuilder(
      delegationProcessClient,
      tenantProcessClient,
      createDummyStub<catalogApi.CatalogProcessClient>(),
      createDummyStub<inAppNotificationApi.InAppNotificationManagerClient>(),
      createDummyStub<FileManager>()
    ),
    getTenant,
    getTenants,
    ctx,
  };
}
