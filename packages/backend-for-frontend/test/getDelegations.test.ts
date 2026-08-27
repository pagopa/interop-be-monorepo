import {
  bffApi,
  catalogApi,
  delegationApi,
  inAppNotificationApi,
} from "pagopa-interop-api-clients";
import { FileManager } from "pagopa-interop-commons";
import {
  createDummyStub,
  getMockContext,
  getMockedApiDelegation,
  getMockedApiEservice,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";

import type {
  DelegationProcessClient,
  TenantProcessClient,
} from "../src/clients/clientsProvider.js";

import { delegationServiceBuilder } from "../src/services/delegationService.js";
import { getBffMockContext } from "./utils.js";

describe("getDelegations", () => {
  it("retrieves e-services and tenants in bulk for consumer and producer delegations", async () => {
    const delegator = getMockedApiTenant();
    const delegate = getMockedApiTenant();
    const producer = getMockedApiTenant();
    const consumerEService = {
      ...getMockedApiEservice(),
      producerId: producer.id,
    };
    const producerEService = {
      ...getMockedApiEservice(),
      producerId: delegator.id,
    };
    const delegations: delegationApi.Delegation[] = [
      getMockedApiDelegation({
        kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
        eserviceId: consumerEService.id,
        delegatorId: delegator.id,
        delegateId: delegate.id,
      }),
      getMockedApiDelegation({
        kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
        eserviceId: consumerEService.id,
        delegatorId: delegator.id,
        delegateId: delegate.id,
      }),
      getMockedApiDelegation({
        kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
        eserviceId: producerEService.id,
        delegatorId: delegator.id,
        delegateId: delegate.id,
      }),
    ];
    const getEServices = vi.fn().mockResolvedValue({
      results: [consumerEService, producerEService],
      totalCount: 2,
    });
    const getEServiceById = vi.fn();
    const getTenants = vi.fn().mockResolvedValue({
      results: [delegator, delegate, producer],
      totalCount: 3,
    });
    const getTenant = vi.fn();
    const { service, ctx } = createTestService({
      delegations,
      getEServices,
      getEServiceById,
      getTenants,
      getTenant,
    });

    const result = await service.getDelegations({ limit: 50, offset: 0 }, ctx);

    expect(result.results).toEqual([
      expect.objectContaining({
        id: delegations[0].id,
        eservice: expect.objectContaining({ id: consumerEService.id }),
      }),
      expect.objectContaining({
        id: delegations[1].id,
        eservice: expect.objectContaining({ id: consumerEService.id }),
      }),
      expect.objectContaining({
        id: delegations[2].id,
        eservice: expect.objectContaining({ id: producerEService.id }),
      }),
    ]);
    expect(getEServices).toHaveBeenCalledTimes(1);
    expect(getEServices).toHaveBeenCalledWith({
      headers: ctx.headers,
      queries: {
        eservicesIds: [consumerEService.id, producerEService.id],
        offset: 0,
        limit: 50,
      },
    });
    expect(getTenants).toHaveBeenCalledTimes(1);
    expect(getTenants).toHaveBeenCalledWith({
      headers: ctx.headers,
      queries: {
        tenantIds: expect.arrayContaining([
          delegator.id,
          delegate.id,
          producer.id,
        ]),
        offset: 0,
        limit: 50,
      },
    });
    expect(getTenants.mock.calls[0][0].queries.tenantIds).toHaveLength(3);
    expect(getEServiceById).not.toHaveBeenCalled();
    expect(getTenant).not.toHaveBeenCalled();
  });

  it("preserves producer delegations whose e-service was deleted", async () => {
    const delegator = getMockedApiTenant();
    const delegate = getMockedApiTenant();
    const deletedEServiceId = generateId();
    const delegation = getMockedApiDelegation({
      kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
      eserviceId: deletedEServiceId,
      delegatorId: delegator.id,
      delegateId: delegate.id,
    });
    const getEServices = vi.fn().mockResolvedValue({
      results: [],
      totalCount: 0,
    });
    const getEServiceById = vi.fn();
    const getTenants = vi.fn().mockResolvedValue({
      results: [delegator, delegate],
      totalCount: 2,
    });
    const getTenant = vi.fn();
    const { service, ctx } = createTestService({
      delegations: [delegation],
      getEServices,
      getEServiceById,
      getTenants,
      getTenant,
    });

    const result = await service.getDelegations({ limit: 50, offset: 0 }, ctx);

    expect(result.results).toEqual([
      expect.objectContaining({
        id: delegation.id,
        kind: bffApi.DelegationKind.Values.DELEGATED_PRODUCER,
        eservice: undefined,
      }),
    ]);
    expect(getEServices).toHaveBeenCalledTimes(1);
    expect(getTenants).toHaveBeenCalledTimes(1);
    expect(getEServiceById).not.toHaveBeenCalled();
    expect(getTenant).not.toHaveBeenCalled();
  });
});

function createTestService({
  delegations,
  getEServices,
  getEServiceById,
  getTenants,
  getTenant,
}: {
  delegations: delegationApi.Delegation[];
  getEServices: ReturnType<typeof vi.fn>;
  getEServiceById: ReturnType<typeof vi.fn>;
  getTenants: ReturnType<typeof vi.fn>;
  getTenant: ReturnType<typeof vi.fn>;
}) {
  const delegationProcessClient = {
    delegation: {
      getDelegations: vi.fn().mockResolvedValue({
        results: delegations,
        totalCount: delegations.length,
      }),
    },
  } as unknown as DelegationProcessClient;
  const tenantProcessClient = {
    tenant: { getTenants, getTenant },
  } as unknown as TenantProcessClient;
  const catalogProcessClient = {
    getEServices,
    getEServiceById,
  } as unknown as catalogApi.CatalogProcessClient;
  const notificationClient = {
    filterUnreadNotifications: vi.fn().mockResolvedValue([]),
  } as unknown as inAppNotificationApi.InAppNotificationManagerClient;

  return {
    service: delegationServiceBuilder(
      delegationProcessClient,
      tenantProcessClient,
      catalogProcessClient,
      notificationClient,
      createDummyStub<FileManager>()
    ),
    ctx: getBffMockContext(getMockContext({})),
  };
}
