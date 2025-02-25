/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAuthData,
  getMockDelegation,
} from "pagopa-interop-commons-test/index.js";
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
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  inconsistentDailyCalls,
} from "../src/model/domain/errors.js";
import { eServiceToApiEService } from "../src/model/domain/apiConverter.js";
import {
  addOneDelegation,
  addOneEService,
  catalogService,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  readLastEserviceEvent,
} from "./utils.js";
import { mockEserviceRouterRequest } from "./supertestSetup.js";

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

      const updatedEService: EService = {
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

      const returnedEService = await mockEserviceRouterRequest.post({
        path: "/eservices/:eServiceId/descriptors/:descriptorId/update",
        pathParams: { eServiceId: eservice.id, descriptorId: descriptor.id },
        body: { ...expectedDescriptorQuotasSeed },
        authData: getMockAuthData(eservice.producerId),
      });

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
      expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
      expect(returnedEService).toEqual(eServiceToApiEService(updatedEService));
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

      const updatedEService: EService = {
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

      const returnedEService = await mockEserviceRouterRequest.post({
        path: "/eservices/:eServiceId/descriptors/:descriptorId/update",
        pathParams: { eServiceId: eservice.id, descriptorId: descriptor.id },
        body: { ...expectedDescriptorQuotasSeed },
        authData: getMockAuthData(delegation.delegateId),
      });

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
      expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
      expect(returnedEService).toEqual(eServiceToApiEService(updatedEService));
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
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
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
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
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
          {
            authData: getMockAuthData(eservice.producerId),
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
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
        {
          authData: getMockAuthData(),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
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
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
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
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
