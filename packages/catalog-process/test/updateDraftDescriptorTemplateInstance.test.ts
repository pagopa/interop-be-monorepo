/* eslint-disable @typescript-eslint/no-floating-promises */
import { catalogApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockEServiceTemplate,
  getRandomAuthData,
} from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  Attribute,
  generateId,
  EServiceDraftDescriptorUpdatedV2,
  toEServiceV2,
  operationForbidden,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  inconsistentDailyCalls,
  eServiceNotAnInstance,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  addOneAttribute,
  catalogService,
  readLastEserviceEvent,
  getMockDescriptor,
  getMockEService,
  getMockDocument,
  buildUpdateDescriptorSeed,
  addOneDelegation,
  addOneEServiceTemplate,
} from "./utils.js";

describe("update draft descriptor instance", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should write on event-store for the update of a draft descriptor instance", async () => {
    const template = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateRef: {
        id: template.id,
        instanceLabel: "test",
      },
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);
    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);

    const expectedDescriptorSeed: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed =
      {
        ...buildUpdateDescriptorSeed(descriptor),
        dailyCallsTotal: 200,
      };

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          dailyCallsTotal: 200,
        },
      ],
    };
    await catalogService.updateDraftDescriptorTemplateInstance(
      eservice.id,
      descriptor.id,
      expectedDescriptorSeed,
      getMockContext({ authData: getRandomAuthData(eservice.producerId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDraftDescriptorUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDraftDescriptorUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
  });
  it("should write on event-store for the update of a draft descriptor instance (delegate)", async () => {
    const template = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateRef: {
        id: template.id,
        instanceLabel: "test",
      },
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);

    const expectedDescriptorSeed: catalogApi.UpdateEServiceDescriptorTemplateInstanceSeed =
      {
        ...buildUpdateDescriptorSeed(descriptor),
        dailyCallsTotal: 200,
      };

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          dailyCallsTotal: 200,
        },
      ],
    };
    await catalogService.updateDraftDescriptorTemplateInstance(
      eservice.id,
      descriptor.id,
      expectedDescriptorSeed,
      getMockContext({ authData: getRandomAuthData(delegation.delegateId) })
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDraftDescriptorUpdated",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDraftDescriptorUpdatedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        mockEService.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        getMockContext({ authData: getRandomAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const template = getMockEServiceTemplate();

    const eservice: EService = {
      ...mockEService,
      descriptors: [],
      name: `${template.name} test`,
      templateRef: {
        id: template.id,
        instanceLabel: "test",
      },
    };

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        mockEService.id,
        mockDescriptor.id,
        buildUpdateDescriptorSeed(mockDescriptor),
        getMockContext({ authData: getRandomAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it.each([
    descriptorState.published,
    descriptorState.deprecated,
    descriptorState.suspended,
    descriptorState.archived,
  ] as const)(
    "should throw notValidDescriptorState if the descriptor is in %s state",
    async (descriptorState) => {
      const template = getMockEServiceTemplate();

      const descriptor: Descriptor = {
        ...mockDescriptor,
        interface: mockDocument,
        state: descriptorState,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
        name: `${template.name} test`,
        templateRef: {
          id: template.id,
          instanceLabel: "test",
        },
      };
      await addOneEServiceTemplate(template);
      await addOneEService(eservice);

      expect(
        catalogService.updateDraftDescriptorTemplateInstance(
          eservice.id,
          descriptor.id,
          buildUpdateDescriptorSeed(descriptor),
          getMockContext({ authData: getRandomAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(
        notValidDescriptorState(mockDescriptor.id, descriptorState)
      );
    }
  );

  it("should throw operationForbidden if the requester is not the producer", async () => {
    const template = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateRef: {
        id: template.id,
        instanceLabel: "test",
      },
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const expectedDescriptor = {
      ...descriptor,
      dailyCallsTotal: 200,
    };
    expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(expectedDescriptor),
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const template = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateRef: {
        id: template.id,
        instanceLabel: "test",
      },
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneDelegation(delegation);

    const expectedDescriptor = {
      ...descriptor,
      dailyCallsTotal: 200,
    };
    expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(expectedDescriptor),
        getMockContext({ authData: getRandomAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const template = getMockEServiceTemplate();

    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
      name: `${template.name} test`,
      templateRef: {
        id: template.id,
        instanceLabel: "test",
      },
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const expectedDescriptor: Descriptor = {
      ...descriptor,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 50,
    };
    expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(expectedDescriptor),
        getMockContext({ authData: getRandomAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });

  it("should throw eServiceNotAnInstance if the eservice is not a template instance", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      attributes: {
        certified: [],
        declared: [],
        verified: [],
      },
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const descriptorSeed = {
      ...buildUpdateDescriptorSeed(mockDescriptor),
    };

    expect(
      catalogService.updateDraftDescriptorTemplateInstance(
        eservice.id,
        descriptor.id,
        descriptorSeed,
        getMockContext({ authData: getRandomAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(eServiceNotAnInstance(eservice.id));
  });
});
