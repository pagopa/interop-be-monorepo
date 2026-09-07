/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  getMockContext,
  getMockAuthData,
  getMockDelegation,
  getMockEService,
  getMockDescriptor,
  getMockDocument,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  delegationKind,
  delegationState,
  DelegatedDescriptorArchivingRequest,
  EService,
  operationForbidden,
} from "pagopa-interop-models";
import { describe, it, expect } from "vitest";

import {
  delegatedArchiveRequestForIncorrectDelegateProducer,
  delegatedArchivingRequestNotActive,
  noActiveDelegationFound,
  noDelegatedArchivingRequestFound,
} from "../../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  catalogService,
} from "../integrationUtils.js";

describe("approve/reject delegated archiving request for a Descriptor", () => {
  const mockDocument = getMockDocument();
  const producer = getMockTenant();
  const mockDelegateTenant = getMockTenant();

  const pendingRequest: DelegatedDescriptorArchivingRequest = {
    requestedAt: new Date("2026-07-01T00:00:00"),
    requesterId: mockDelegateTenant.id,
    gracePeriodDays: 60,
  };

  const buildEservice = (descriptor: Descriptor): EService => ({
    ...getMockEService(),
    producerId: producer.id,
    descriptors: [descriptor],
  });

  const setupActiveDelegation = async (eservice: EService): Promise<void> => {
    const mockDelegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      delegateId: mockDelegateTenant.id,
      state: delegationState.active,
    });
    await addOneTenant(producer);
    await addOneTenant(mockDelegateTenant);
    await addOneEService(eservice);
    await addOneDelegation(mockDelegation);
  };

  describe("approve", () => {
    it("Should approve a pending request and start the archiving grace period on a deprecated descriptor", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.deprecated,
        interface: mockDocument,
        delegatedArchivingRequest: [pendingRequest],
      };
      const eservice = buildEservice(descriptor);
      await setupActiveDelegation(eservice);

      const response = await catalogService.approveDelegatedDescriptorArchiving(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(producer.id) })
      );

      const receivedDescriptor = response.data.descriptors[0];
      expect(receivedDescriptor.state).toBe(descriptorState.archiving);
      expect(receivedDescriptor.archivingSchedule).toBeDefined();
      expect(receivedDescriptor.archivingSchedule?.gracePeriodDays).toBe(
        pendingRequest.gracePeriodDays
      );
      expect(
        receivedDescriptor.delegatedArchivingRequest?.[0].acceptedAt
      ).toBeDefined();
    });

    it("Should approve a pending request and start ArchivingSuspended on a suspended descriptor", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        version: "1",
        state: descriptorState.suspended,
        interface: mockDocument,
        delegatedArchivingRequest: [pendingRequest],
      };
      const latestDescriptor: Descriptor = {
        ...getMockDescriptor(),
        version: "2",
        state: descriptorState.published,
        interface: getMockDocument(),
      };
      const eservice: EService = {
        ...getMockEService(),
        producerId: producer.id,
        descriptors: [descriptor, latestDescriptor],
      };
      await setupActiveDelegation(eservice);

      const response = await catalogService.approveDelegatedDescriptorArchiving(
        eservice.id,
        descriptor.id,
        getMockContext({ authData: getMockAuthData(producer.id) })
      );

      const receivedDescriptor = response.data.descriptors.find(
        (d) => d.id === descriptor.id
      );
      expect(receivedDescriptor?.state).toBe(
        descriptorState.archivingSuspended
      );
    });

    it("Should throw noDelegatedArchivingRequestFound when there is no request", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.deprecated,
        interface: mockDocument,
      };
      const eservice = buildEservice(descriptor);
      await setupActiveDelegation(eservice);

      const expectedError = noDelegatedArchivingRequestFound(
        eservice.id,
        descriptor.id
      );

      await expect(
        catalogService.approveDelegatedDescriptorArchiving(
          eservice.id,
          descriptor.id,
          getMockContext({ authData: getMockAuthData(producer.id) })
        )
      ).rejects.toThrow(expectedError);
    });

    it("Should throw delegatedArchivingRequestNotActive when the latest request was already accepted", async () => {
      const acceptedRequest: DelegatedDescriptorArchivingRequest = {
        ...pendingRequest,
        acceptedAt: new Date("2026-07-02T00:00:00"),
      };
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.archiving,
        interface: mockDocument,
        delegatedArchivingRequest: [acceptedRequest],
      };
      const eservice = buildEservice(descriptor);
      await setupActiveDelegation(eservice);

      const expectedError = delegatedArchivingRequestNotActive(
        eservice.id,
        descriptor.id
      );

      await expect(
        catalogService.approveDelegatedDescriptorArchiving(
          eservice.id,
          descriptor.id,
          getMockContext({ authData: getMockAuthData(producer.id) })
        )
      ).rejects.toThrow(expectedError);
    });

    it("Should throw noActiveDelegationFound when the delegation is no longer active", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.deprecated,
        interface: mockDocument,
        delegatedArchivingRequest: [pendingRequest],
      };
      const eservice = buildEservice(descriptor);

      await addOneTenant(producer);
      await addOneTenant(mockDelegateTenant);
      await addOneEService(eservice);
      // No delegation added: it has since been revoked.

      const expectedError = noActiveDelegationFound(eservice.id);

      await expect(
        catalogService.approveDelegatedDescriptorArchiving(
          eservice.id,
          descriptor.id,
          getMockContext({ authData: getMockAuthData(producer.id) })
        )
      ).rejects.toThrow(expectedError);
    });

    it("Should throw delegatedArchiveRequestForIncorrectDelegateProducer when the active delegation points to a different delegate", async () => {
      const otherDelegateTenant = getMockTenant();
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.deprecated,
        interface: mockDocument,
        delegatedArchivingRequest: [pendingRequest],
      };
      const eservice = buildEservice(descriptor);

      const mockDelegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        delegateId: otherDelegateTenant.id,
        state: delegationState.active,
      });
      await addOneTenant(producer);
      await addOneTenant(mockDelegateTenant);
      await addOneTenant(otherDelegateTenant);
      await addOneEService(eservice);
      await addOneDelegation(mockDelegation);

      const expectedError = delegatedArchiveRequestForIncorrectDelegateProducer(
        eservice.id,
        descriptor.id
      );

      await expect(
        catalogService.approveDelegatedDescriptorArchiving(
          eservice.id,
          descriptor.id,
          getMockContext({ authData: getMockAuthData(producer.id) })
        )
      ).rejects.toThrow(expectedError);
    });

    it("Should throw operationForbidden when the requester is not the producer", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.deprecated,
        interface: mockDocument,
        delegatedArchivingRequest: [pendingRequest],
      };
      const eservice = buildEservice(descriptor);
      await setupActiveDelegation(eservice);

      await expect(
        catalogService.approveDelegatedDescriptorArchiving(
          eservice.id,
          descriptor.id,
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        )
      ).rejects.toThrow(operationForbidden);
    });
  });

  describe("reject", () => {
    it("Should reject a pending request with a rejection reason", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.deprecated,
        interface: mockDocument,
        delegatedArchivingRequest: [pendingRequest],
      };
      const eservice = buildEservice(descriptor);
      await setupActiveDelegation(eservice);

      const response = await catalogService.rejectDelegatedDescriptorArchiving(
        eservice.id,
        descriptor.id,
        { rejectionReason: "Not the right time" },
        getMockContext({ authData: getMockAuthData(producer.id) })
      );

      const receivedDescriptor = response.data.descriptors[0];
      expect(receivedDescriptor.state).toBe(descriptorState.deprecated);
      expect(
        receivedDescriptor.delegatedArchivingRequest?.[0].rejectedAt
      ).toBeDefined();
      expect(
        receivedDescriptor.delegatedArchivingRequest?.[0].rejectionReason
      ).toBe("Not the right time");
    });

    it("Should throw noDelegatedArchivingRequestFound when there is no request", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.deprecated,
        interface: mockDocument,
      };
      const eservice = buildEservice(descriptor);
      await setupActiveDelegation(eservice);

      const expectedError = noDelegatedArchivingRequestFound(
        eservice.id,
        descriptor.id
      );

      await expect(
        catalogService.rejectDelegatedDescriptorArchiving(
          eservice.id,
          descriptor.id,
          { rejectionReason: "Not the right time" },
          getMockContext({ authData: getMockAuthData(producer.id) })
        )
      ).rejects.toThrow(expectedError);
    });

    it("Should throw operationForbidden when the requester is not the producer", async () => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.deprecated,
        interface: mockDocument,
        delegatedArchivingRequest: [pendingRequest],
      };
      const eservice = buildEservice(descriptor);
      await setupActiveDelegation(eservice);

      await expect(
        catalogService.rejectDelegatedDescriptorArchiving(
          eservice.id,
          descriptor.id,
          { rejectionReason: "Not the right time" },
          getMockContext({ authData: getMockAuthData(mockDelegateTenant.id) })
        )
      ).rejects.toThrow(operationForbidden);
    });
  });
});
