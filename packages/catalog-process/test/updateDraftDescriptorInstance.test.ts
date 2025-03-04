/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockDelegation,
  getMockEServiceTemplate,
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
  getMockAuthData,
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
        instanceId: "test",
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

    const expectedDescriptorSeed: catalogApi.UpdateEServiceDescriptorInstanceSeed =
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
    await catalogService.updateDraftDescriptorInstance(
      eservice.id,
      descriptor.id,
      expectedDescriptorSeed,
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
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
        instanceId: "test",
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

    const expectedDescriptorSeed: catalogApi.UpdateEServiceDescriptorInstanceSeed =
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
    await catalogService.updateDraftDescriptorInstance(
      eservice.id,
      descriptor.id,
      expectedDescriptorSeed,
      {
        authData: getMockAuthData(delegation.delegateId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
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
      catalogService.updateDraftDescriptorInstance(
        mockEService.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
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
    const template = getMockEServiceTemplate();

    const eservice: EService = {
      ...mockEService,
      descriptors: [],
      name: `${template.name} test`,
      templateRef: {
        id: template.id,
        instanceId: "test",
      },
    };

    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    expect(
      catalogService.updateDraftDescriptorInstance(
        mockEService.id,
        mockDescriptor.id,
        buildUpdateDescriptorSeed(mockDescriptor),
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
          instanceId: "test",
        },
      };
      await addOneEServiceTemplate(template);
      await addOneEService(eservice);

      expect(
        catalogService.updateDraftDescriptorInstance(
          eservice.id,
          descriptor.id,
          buildUpdateDescriptorSeed(descriptor),
          {
            authData: getMockAuthData(eservice.producerId),
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
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
        instanceId: "test",
      },
    };
    await addOneEServiceTemplate(template);
    await addOneEService(eservice);

    const expectedDescriptor = {
      ...descriptor,
      dailyCallsTotal: 200,
    };
    expect(
      catalogService.updateDraftDescriptorInstance(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(expectedDescriptor),
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
        instanceId: "test",
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
      catalogService.updateDraftDescriptorInstance(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(expectedDescriptor),
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
        instanceId: "test",
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
      catalogService.updateDraftDescriptorInstance(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(expectedDescriptor),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
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
      catalogService.updateDraftDescriptorInstance(
        eservice.id,
        descriptor.id,
        descriptorSeed,
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotAnInstance(eservice.id));
  });
});
