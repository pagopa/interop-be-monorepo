/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceDescriptorQuotasUpdatedV2,
  toEServiceV2,
  operationForbidden,
  delegationState,
  generateId,
  delegationKind,
  EServiceTemplateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  inconsistentDailyCalls,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";

describe("update descriptor", () => {
  const mockEService = getMockEService();
  const mockDescriptor = getMockDescriptor();
  const mockDocument = getMockDocument();
  it.each([
    descriptorState.published,
    descriptorState.suspended,
    descriptorState.deprecated,
  ])(
    "should write on event-store for the update of a descriptor with state %s",
    async (descriptorState) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState,
        interface: mockDocument,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
        {
          voucherLifespan: 1000,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
        };

      const expectedEService: EService = {
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            voucherLifespan: 1000,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          },
        ],
      };
      const updateDescriptorReturn = await catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        expectedDescriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      );
      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "EServiceDescriptorQuotasUpdated",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorQuotasUpdatedV2,
        payload: writtenEvent.data,
      });
      expect(writtenPayload).toEqual({
        eservice: toEServiceV2(expectedEService),
        descriptorId: descriptor.id,
      });
      expect(updateDescriptorReturn).toEqual({
        data: expectedEService,
        metadata: { version: 1 },
      });
    }
  );

  it.each([
    descriptorState.published,
    descriptorState.suspended,
    descriptorState.deprecated,
  ])(
    "should write on event-store for the update of a descriptor with state %s (delegate)",
    async (descriptorState) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: descriptorState,
        interface: mockDocument,
        publishedAt: new Date(),
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        eserviceId: eservice.id,
        state: delegationState.active,
      });

      await addOneEService(eservice);
      await addOneDelegation(delegation);

      const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
        {
          voucherLifespan: 1000,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
        };

      const expectedEService: EService = {
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            voucherLifespan: 1000,
            dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
            dailyCallsTotal: descriptor.dailyCallsTotal + 10,
          },
        ],
      };
      const updateDescriptorReturn = await catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        expectedDescriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(delegation.delegateId) })
      );
      const writtenEvent = await readLastEserviceEvent(eservice.id);
      expect(writtenEvent).toMatchObject({
        stream_id: eservice.id,
        version: "1",
        type: "EServiceDescriptorQuotasUpdated",
        event_version: 2,
      });
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorQuotasUpdatedV2,
        payload: writtenEvent.data,
      });
      expect(writtenPayload).toEqual({
        eservice: toEServiceV2(expectedEService),
        descriptorId: descriptor.id,
      });
      expect(updateDescriptorReturn).toEqual({
        data: expectedEService,
        metadata: { version: 1 },
      });
    }
  );

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
      {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: mockDescriptor.dailyCallsPerConsumer + 10,
        dailyCallsTotal: mockDescriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateDescriptor(
        mockEService.id,
        mockDescriptor.id,
        expectedDescriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);

    const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
      {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: mockDescriptor.dailyCallsPerConsumer + 10,
        dailyCallsTotal: mockDescriptor.dailyCallsTotal + 10,
      };

    expect(
      catalogService.updateDescriptor(
        mockEService.id,
        mockDescriptor.id,
        expectedDescriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it.each([
    descriptorState.draft,
    descriptorState.waitingForApproval,
    descriptorState.archived,
  ])(
    "should throw notValidDescriptorState if the descriptor is in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        interface: mockDocument,
        state,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      const updatedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
        {
          voucherLifespan: 1000,
          dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
          dailyCallsTotal: descriptor.dailyCallsTotal + 10,
        };

      expect(
        catalogService.updateDescriptor(
          eservice.id,
          descriptor.id,
          updatedDescriptorQuotasSeed,
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(notValidDescriptorState(mockDescriptor.id, state));
    }
  );

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
      {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
        dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        expectedDescriptorQuotasSeed,
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
      {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer + 10,
        dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        expectedDescriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
      {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: descriptor.dailyCallsTotal + 11,
        dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        expectedDescriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
  it("should throw templateInstanceNotAllowed if the templateId is defined", async () => {
    const templateId = unsafeBrandId<EServiceTemplateId>(generateId());
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.published,
      interface: mockDocument,
      publishedAt: new Date(),
    };
    const eservice: EService = {
      ...mockEService,
      templateId,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const expectedDescriptorQuotasSeed: catalogApi.UpdateEServiceDescriptorQuotasSeed =
      {
        voucherLifespan: 1000,
        dailyCallsPerConsumer: descriptor.dailyCallsTotal + 11,
        dailyCallsTotal: descriptor.dailyCallsTotal + 10,
      };
    expect(
      catalogService.updateDescriptor(
        eservice.id,
        descriptor.id,
        expectedDescriptorQuotasSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eservice.id, templateId));
  });
});
