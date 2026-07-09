import {
  getMockDelegation,
  getMockDescriptorPublished,
  getMockEService,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import { describe, expect, it, vi } from "vitest";
import {
  CorrelationId,
  delegationKind,
  delegationState,
  EService,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import {
  processDelegationRevokedEvent,
  processDescriptorArchivedEvent,
  shouldArchiveDelegatedArchivingRequestForDescriptorArchivedEvent,
} from "../src/services/delegatedArchivingRequestsProcessor.js";

const headers = {
  Authorization: "Bearer token",
  "X-Correlation-Id": generateId<CorrelationId>(),
};

describe("delegatedArchivingRequestsProcessor", () => {
  it("should archive delegated request after descriptor archived event when descriptor has a pending request", async () => {
    const descriptor = {
      ...getMockDescriptorPublished(),
      delegatedArchivingRequest: [
        {
          requestedAt: new Date(),
          gracePeriodDays: 30,
          requesterId: generateId<TenantId>(),
        },
      ],
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };

    const catalogProcessClient = {
      archiveDelegatedArchivingRequest: vi.fn().mockResolvedValue(undefined),
    };

    await processDescriptorArchivedEvent({
      eservice,
      descriptorId: descriptor.id,
      catalogProcessClient,
      headers,
      logger: genericLogger,
    });

    expect(catalogProcessClient.archiveDelegatedArchivingRequest).toHaveBeenCalledTimes(1);
    expect(catalogProcessClient.archiveDelegatedArchivingRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        eServiceId: eservice.id,
        seed: expect.objectContaining({
          descriptorId: descriptor.id,
          triggerEvent: "EServiceDescriptorArchived",
        }),
      })
    );
  });

  it("should archive delegated request after descriptor archived event when eservice has a pending request", async () => {
    const descriptor = getMockDescriptorPublished();
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      delegatedArchivingRequest: [
        {
          requestedAt: new Date(),
          gracePeriodDays: 20,
          requesterId: generateId<TenantId>(),
          archivingReason: "reason",
        },
      ],
    };

    const catalogProcessClient = {
      archiveDelegatedArchivingRequest: vi.fn().mockResolvedValue(undefined),
    };

    await processDescriptorArchivedEvent({
      eservice,
      descriptorId: descriptor.id,
      catalogProcessClient,
      headers,
      logger: genericLogger,
    });

    expect(catalogProcessClient.archiveDelegatedArchivingRequest).toHaveBeenCalledTimes(1);
  });

  it("should not archive delegated request after descriptor archived event when no pending request exists", async () => {
    const descriptor = {
      ...getMockDescriptorPublished(),
      delegatedArchivingRequest: [
        {
          requestedAt: new Date(),
          gracePeriodDays: 30,
          requesterId: generateId<TenantId>(),
          acceptedAt: new Date(),
        },
      ],
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };

    const catalogProcessClient = {
      archiveDelegatedArchivingRequest: vi.fn().mockResolvedValue(undefined),
    };

    await processDescriptorArchivedEvent({
      eservice,
      descriptorId: descriptor.id,
      catalogProcessClient,
      headers,
      logger: genericLogger,
    });

    expect(catalogProcessClient.archiveDelegatedArchivingRequest).not.toHaveBeenCalled();
    expect(
      shouldArchiveDelegatedArchivingRequestForDescriptorArchivedEvent(
        eservice,
        descriptor.id
      )
    ).toBe(false);
  });

  it("should archive all pending delegated requests after delegation revoked event", async () => {
    const descriptorWithPending = {
      ...getMockDescriptorPublished(),
      delegatedArchivingRequest: [
        {
          requestedAt: new Date(),
          gracePeriodDays: 15,
          requesterId: generateId<TenantId>(),
        },
      ],
    };

    const descriptorWithoutPending = {
      ...getMockDescriptorPublished(),
      delegatedArchivingRequest: [
        {
          requestedAt: new Date(),
          gracePeriodDays: 15,
          requesterId: generateId<TenantId>(),
          rejectedAt: new Date(),
          rejectionReason: "already rejected",
        },
      ],
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptorWithPending, descriptorWithoutPending],
      delegatedArchivingRequest: [
        {
          requestedAt: new Date(),
          gracePeriodDays: 30,
          requesterId: generateId<TenantId>(),
          archivingReason: "reason",
        },
      ],
    };

    const readModelService = {
      getEServiceById: vi.fn().mockResolvedValue(eservice),
    };

    const catalogProcessClient = {
      archiveDelegatedArchivingRequest: vi.fn().mockResolvedValue(undefined),
    };

    const delegation = {
      ...getMockDelegation({
        state: delegationState.revoked,
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
      }),
    };

    await processDelegationRevokedEvent({
      delegation,
      readModelService,
      catalogProcessClient,
      headers,
      logger: genericLogger,
    });

    expect(catalogProcessClient.archiveDelegatedArchivingRequest).toHaveBeenCalledTimes(2);
  });

  it("should not call internal endpoint after delegation revoked event when no pending request exists", async () => {
    const descriptor = {
      ...getMockDescriptorPublished(),
      delegatedArchivingRequest: [
        {
          requestedAt: new Date(),
          gracePeriodDays: 10,
          requesterId: generateId<TenantId>(),
          acceptedAt: new Date(),
        },
      ],
    };

    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
      delegatedArchivingRequest: [
        {
          requestedAt: new Date(),
          gracePeriodDays: 30,
          requesterId: generateId<TenantId>(),
          archivingReason: "reason",
          rejectedAt: new Date(),
          rejectionReason: "closed",
        },
      ],
    };

    const readModelService = {
      getEServiceById: vi.fn().mockResolvedValue(eservice),
    };

    const catalogProcessClient = {
      archiveDelegatedArchivingRequest: vi.fn().mockResolvedValue(undefined),
    };

    const delegation = getMockDelegation({
      state: delegationState.revoked,
      kind: delegationKind.delegatedConsumer,
      eserviceId: eservice.id,
    });

    await processDelegationRevokedEvent({
      delegation,
      readModelService,
      catalogProcessClient,
      headers,
      logger: genericLogger,
    });

    expect(catalogProcessClient.archiveDelegatedArchivingRequest).not.toHaveBeenCalled();
  });
});
