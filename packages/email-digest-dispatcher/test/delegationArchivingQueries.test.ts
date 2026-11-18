/* eslint-disable functional/no-let */
import { getMockTenant } from "pagopa-interop-commons-test";
import {
  DelegatedDescriptorArchivingRequest,
  DelegatedEServiceArchivingRequest,
  GracePeriodDays,
  TenantId,
  descriptorState,
  generateId,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";

import {
  addOneEService,
  addOneTenant,
  createMockDescriptor,
  createMockEService,
  daysAgo,
  readModelService,
} from "./integrationUtils.js";

describe("ReadModelService - getReceivedDelegationArchivingRequests", () => {
  it("should return empty array when no archiving requests exist for the producer", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    const results =
      await readModelService.getReceivedDelegationArchivingRequests(
        producer.id
      );

    expect(results).toEqual([]);
  });

  it("should return eservice and descriptor pending archiving requests for the producer", async () => {
    const delegator = getMockTenant();
    const delegate = getMockTenant();
    await addOneTenant(delegator);
    await addOneTenant(delegate);

    const archivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: delegate.id,
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Test reason",
    };

    const descriptorArchivingRequest: DelegatedDescriptorArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: delegate.id,
      gracePeriodDays: 30 as GracePeriodDays,
    };

    const descriptor = createMockDescriptor(descriptorState.published);
    descriptor.delegatedArchivingRequest = [descriptorArchivingRequest];
    const eservice = createMockEService(delegator.id);
    eservice.delegatedArchivingRequest = [archivingRequest];
    eservice.descriptors = [descriptor];

    await addOneEService(eservice);

    const results =
      await readModelService.getReceivedDelegationArchivingRequests(
        delegator.id
      );

    expect(results.length).toBe(2);
    expect(results[0].totalCount).toEqual(2);
    expect(results[1].totalCount).toEqual(2);
  });

  it("Should return only pending archiving requests for the producer in the specified time range, even if the requester is not a tenant", async () => {
    const delegator = getMockTenant();
    await addOneTenant(delegator);

    const archivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Test reason",
    };

    const eservice = createMockEService(delegator.id);
    eservice.delegatedArchivingRequest = [archivingRequest];

    await addOneEService(eservice);

    const results =
      await readModelService.getReceivedDelegationArchivingRequests(
        delegator.id
      );

    expect(results.length).toBe(1);
    expect(results[0].totalCount).toEqual(1);
  });

  it("Should not return archiving requests from different producer", async () => {
    const delegator = getMockTenant();
    const otherDelegator = getMockTenant();
    await addOneTenant(delegator);
    await addOneTenant(otherDelegator);

    const archivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Test reason",
    };

    const eservice = createMockEService(otherDelegator.id);
    eservice.delegatedArchivingRequest = [archivingRequest];

    await addOneEService(eservice);

    const results =
      await readModelService.getReceivedDelegationArchivingRequests(
        delegator.id
      );

    expect(results.length).toBe(0);
  });

  it("Should return empty array when no pending archiving requests exist for the producer in the specified time range", async () => {
    const delegator = getMockTenant();
    await addOneTenant(delegator);

    const oldArchivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(40),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Old test reason",
    };

    const approvedArchivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Approved test reason",
      acceptedAt: daysAgo(3),
    };

    const rejectedArchivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "test reason",
      rejectionReason: "Rejected test reason",
      rejectedAt: daysAgo(3),
    };

    const oldDescriptorArchivingRequest: DelegatedDescriptorArchivingRequest = {
      requestedAt: daysAgo(40),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
    };

    const approvedDescriptorArchivingRequest: DelegatedDescriptorArchivingRequest =
      {
        requestedAt: daysAgo(5),
        requesterId: generateId<TenantId>(),
        gracePeriodDays: 30 as GracePeriodDays,
        acceptedAt: daysAgo(3),
      };

    const rejectedDescriptorArchivingRequest: DelegatedDescriptorArchivingRequest =
      {
        requestedAt: daysAgo(5),
        requesterId: generateId<TenantId>(),
        gracePeriodDays: 30 as GracePeriodDays,
        rejectionReason: "Rejected descriptor test reason",
        rejectedAt: daysAgo(3),
      };

    const descriptor = createMockDescriptor(descriptorState.published);
    descriptor.delegatedArchivingRequest = [
      oldDescriptorArchivingRequest,
      approvedDescriptorArchivingRequest,
      rejectedDescriptorArchivingRequest,
    ];
    const eservice = createMockEService(delegator.id);
    eservice.delegatedArchivingRequest = [
      oldArchivingRequest,
      approvedArchivingRequest,
      rejectedArchivingRequest,
    ];

    await addOneEService(eservice);

    const results =
      await readModelService.getReceivedDelegationArchivingRequests(
        delegator.id
      );

    expect(results.length).toBe(0);
  });
});

describe("ReadModelService - getApprovedDelegationArchivingRequests", () => {
  it("should return empty array when no approved archiving requests exist for the producer", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    const results =
      await readModelService.getApprovedDelegationArchivingRequests(
        producer.id
      );

    expect(results).toEqual([]);
  });

  it("should return approved archiving requests for the producer", async () => {
    const delegator = getMockTenant();
    const delegate = getMockTenant();
    await addOneTenant(delegator);
    await addOneTenant(delegate);

    const archivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: delegate.id,
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Test reason",
      acceptedAt: daysAgo(3),
    };

    const descriptorArchivingRequest: DelegatedDescriptorArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: delegate.id,
      gracePeriodDays: 30 as GracePeriodDays,
      acceptedAt: daysAgo(3),
    };

    const descriptor = createMockDescriptor(descriptorState.published);
    descriptor.delegatedArchivingRequest = [descriptorArchivingRequest];
    const eservice = createMockEService(delegator.id);
    eservice.delegatedArchivingRequest = [archivingRequest];
    eservice.descriptors = [descriptor];

    await addOneEService(eservice);

    const results =
      await readModelService.getApprovedDelegationArchivingRequests(
        delegator.id
      );

    expect(results.length).toBe(2);
    expect(results[0].totalCount).toEqual(2);
    expect(results[1].totalCount).toEqual(2);
  });

  it("Should return only approved archiving requests for the producer in the specified time range, even if the requester is not a tenant", async () => {
    const delegator = getMockTenant();
    await addOneTenant(delegator);

    const archivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Test reason",
      acceptedAt: daysAgo(3),
    };

    const eservice = createMockEService(delegator.id);
    eservice.delegatedArchivingRequest = [archivingRequest];

    await addOneEService(eservice);

    const results =
      await readModelService.getApprovedDelegationArchivingRequests(
        delegator.id
      );

    expect(results.length).toBe(1);
    expect(results[0].totalCount).toEqual(1);
  });

  it("Should not return approved archiving requests from different producer", async () => {
    const delegator = getMockTenant();
    const otherDelegator = getMockTenant();
    await addOneTenant(delegator);
    await addOneTenant(otherDelegator);

    const approvedArchivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Test reason",
      acceptedAt: daysAgo(3),
    };

    const eservice = createMockEService(otherDelegator.id);
    eservice.delegatedArchivingRequest = [approvedArchivingRequest];

    await addOneEService(eservice);

    const results =
      await readModelService.getApprovedDelegationArchivingRequests(
        delegator.id
      );

    expect(results.length).toBe(0);
  });

  it("Should return empty array when no approved archiving requests exist for the producer in the specified time range", async () => {
    const delegator = getMockTenant();
    await addOneTenant(delegator);

    const oldArchivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(40),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Old test reason",
      acceptedAt: daysAgo(38),
    };

    const archivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "test reason",
    };

    const rejectedArchivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "test reason",
      rejectionReason: "Rejected test reason",
      rejectedAt: daysAgo(3),
    };

    const oldDescriptorArchivingRequest: DelegatedDescriptorArchivingRequest = {
      requestedAt: daysAgo(40),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
    };

    const descriptorArchivingRequest: DelegatedDescriptorArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
    };

    const rejectedDescriptorArchivingRequest: DelegatedDescriptorArchivingRequest =
      {
        requestedAt: daysAgo(5),
        requesterId: generateId<TenantId>(),
        gracePeriodDays: 30 as GracePeriodDays,
        rejectionReason: "Rejected descriptor test reason",
        rejectedAt: daysAgo(3),
      };

    const descriptor = createMockDescriptor(descriptorState.published);
    descriptor.delegatedArchivingRequest = [
      oldDescriptorArchivingRequest,
      descriptorArchivingRequest,
      rejectedDescriptorArchivingRequest,
    ];
    const eservice = createMockEService(delegator.id);
    eservice.delegatedArchivingRequest = [
      oldArchivingRequest,
      archivingRequest,
      rejectedArchivingRequest,
    ];

    await addOneEService(eservice);

    const results =
      await readModelService.getApprovedDelegationArchivingRequests(
        delegator.id
      );

    expect(results.length).toBe(0);
  });
});

describe("ReadModelService - getRejectedDelegationArchivingRequests", () => {
  it("should return empty array when no rejected archiving requests exist for the producer", async () => {
    const producer = getMockTenant();
    await addOneTenant(producer);

    const results =
      await readModelService.getRejectedDelegationArchivingRequests(
        producer.id
      );

    expect(results).toEqual([]);
  });

  it("should return rejected archiving requests for the producer", async () => {
    const delegator = getMockTenant();
    const delegate = getMockTenant();
    await addOneTenant(delegator);
    await addOneTenant(delegate);

    const archivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: delegate.id,
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Test reason",
      rejectedAt: daysAgo(3),
      rejectionReason: "Rejected test reason",
    };

    const descriptorArchivingRequest: DelegatedDescriptorArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: delegate.id,
      gracePeriodDays: 30 as GracePeriodDays,
      rejectedAt: daysAgo(3),
      rejectionReason: "Rejected test reason",
    };

    const descriptor = createMockDescriptor(descriptorState.published);
    descriptor.delegatedArchivingRequest = [descriptorArchivingRequest];
    const eservice = createMockEService(delegator.id);
    eservice.delegatedArchivingRequest = [archivingRequest];
    eservice.descriptors = [descriptor];

    await addOneEService(eservice);

    const results =
      await readModelService.getRejectedDelegationArchivingRequests(
        delegator.id
      );

    expect(results.length).toBe(2);
    expect(results[0].totalCount).toEqual(2);
    expect(results[1].totalCount).toEqual(2);
  });

  it("Should return only rejected archiving requests for the producer in the specified time range, even if the requester is not a tenant", async () => {
    const delegator = getMockTenant();
    await addOneTenant(delegator);

    const archivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Test reason",
      rejectedAt: daysAgo(3),
      rejectionReason: "Rejected test reason",
    };

    const eservice = createMockEService(delegator.id);
    eservice.delegatedArchivingRequest = [archivingRequest];

    await addOneEService(eservice);

    const results =
      await readModelService.getRejectedDelegationArchivingRequests(
        delegator.id
      );

    expect(results.length).toBe(1);
    expect(results[0].totalCount).toEqual(1);
  });

  it("Should not return rejected archiving requests from different producer", async () => {
    const delegator = getMockTenant();
    const otherDelegator = getMockTenant();
    await addOneTenant(delegator);
    await addOneTenant(otherDelegator);

    const rejectedArchivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Test reason",
      rejectedAt: daysAgo(3),
      rejectionReason: "Rejected test reason",
    };

    const eservice = createMockEService(otherDelegator.id);
    eservice.delegatedArchivingRequest = [rejectedArchivingRequest];

    await addOneEService(eservice);

    const results =
      await readModelService.getRejectedDelegationArchivingRequests(
        delegator.id
      );

    expect(results.length).toBe(0);
  });

  it("Should return empty array when no rejected archiving requests exist for the producer in the specified time range", async () => {
    const delegator = getMockTenant();
    await addOneTenant(delegator);

    const oldRejectedArchivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(40),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "Old test reason",
      rejectedAt: daysAgo(38),
      rejectionReason: "Rejected test reason",
    };

    const archivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "test reason",
    };

    const approvedArchivingRequest: DelegatedEServiceArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
      archivingReason: "test reason",
      acceptedAt: daysAgo(3),
    };

    const oldRejectedDescriptorArchivingRequest: DelegatedDescriptorArchivingRequest =
      {
        requestedAt: daysAgo(40),
        requesterId: generateId<TenantId>(),
        gracePeriodDays: 30 as GracePeriodDays,
        rejectedAt: daysAgo(38),
        rejectionReason: "Rejected descriptor test reason",
      };

    const descriptorArchivingRequest: DelegatedDescriptorArchivingRequest = {
      requestedAt: daysAgo(5),
      requesterId: generateId<TenantId>(),
      gracePeriodDays: 30 as GracePeriodDays,
    };

    const approvedDescriptorArchivingRequest: DelegatedDescriptorArchivingRequest =
      {
        requestedAt: daysAgo(5),
        requesterId: generateId<TenantId>(),
        gracePeriodDays: 30 as GracePeriodDays,
        acceptedAt: daysAgo(3),
      };

    const descriptor = createMockDescriptor(descriptorState.published);
    descriptor.delegatedArchivingRequest = [
      oldRejectedDescriptorArchivingRequest,
      descriptorArchivingRequest,
      approvedDescriptorArchivingRequest,
    ];
    const eservice = createMockEService(delegator.id);
    eservice.delegatedArchivingRequest = [
      oldRejectedArchivingRequest,
      archivingRequest,
      approvedArchivingRequest,
    ];

    await addOneEService(eservice);

    const results =
      await readModelService.getRejectedDelegationArchivingRequests(
        delegator.id
      );

    expect(results.length).toBe(0);
  });
});
