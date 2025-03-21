/* eslint-disable @typescript-eslint/no-floating-promises */
import { catalogApi } from "pagopa-interop-api-clients";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockEServiceTemplate,
  getMockAuthData,
} from "pagopa-interop-commons-test";
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
  attributeNotFound,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  addOneAttribute,
  catalogService,
  readLastEserviceEvent,
  addOneDelegation,
  addOneEServiceTemplate,
} from "../integrationUtils.js";
import {
  getMockDescriptor,
  getMockEService,
  getMockDocument,
  buildUpdateDescriptorSeed,
} from "../mockUtils.js";

describe("update draft descriptor", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should write on event-store for the update of a draft descriptor", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);

    const expectedDescriptorSeed: catalogApi.UpdateEServiceDescriptorSeed = {
      ...buildUpdateDescriptorSeed(descriptor),
      dailyCallsTotal: 200,
      attributes: {
        certified: [],
        declared: [
          [{ id: attribute.id, explicitAttributeVerification: false }],
        ],
        verified: [],
      },
    };

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          dailyCallsTotal: 200,
          attributes: {
            certified: [],
            declared: [
              [{ id: attribute.id, explicitAttributeVerification: false }],
            ],
            verified: [],
          },
        },
      ],
    };
    await catalogService.updateDraftDescriptor(
      eservice.id,
      descriptor.id,
      expectedDescriptorSeed,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
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
  it("should write on event-store for the update of a draft descriptor (delegate)", async () => {
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
    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);

    const expectedDescriptorSeed: catalogApi.UpdateEServiceDescriptorSeed = {
      ...buildUpdateDescriptorSeed(descriptor),
      dailyCallsTotal: 200,
      attributes: {
        certified: [],
        declared: [
          [{ id: attribute.id, explicitAttributeVerification: false }],
        ],
        verified: [],
      },
    };

    const updatedEService: EService = {
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          dailyCallsTotal: 200,
          attributes: {
            certified: [],
            declared: [
              [{ id: attribute.id, explicitAttributeVerification: false }],
            ],
            verified: [],
          },
        },
      ],
    };
    await catalogService.updateDraftDescriptor(
      eservice.id,
      descriptor.id,
      expectedDescriptorSeed,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
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
      catalogService.updateDraftDescriptor(
        mockEService.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
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

    expect(
      catalogService.updateDraftDescriptor(
        mockEService.id,
        mockDescriptor.id,
        buildUpdateDescriptorSeed(mockDescriptor),
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it("should throw notValidDescriptorState if the descriptor is in published state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      notValidDescriptorState(mockDescriptor.id, descriptorState.published)
    );
  });

  it("should throw notValidDescriptorState if the descriptor is in deprecated state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.deprecated,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      notValidDescriptorState(mockDescriptor.id, descriptorState.deprecated)
    );
  });

  it("should throw notValidDescriptorState if the descriptor is in suspended state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.suspended,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      notValidDescriptorState(mockDescriptor.id, descriptorState.suspended)
    );
  });

  it("should throw notValidDescriptorState if the descriptor is in archived state", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.archived,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(descriptor),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      notValidDescriptorState(mockDescriptor.id, descriptorState.archived)
    );
  });

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

    const expectedDescriptor = {
      ...descriptor,
      dailyCallsTotal: 200,
    };
    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(expectedDescriptor),
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

    const expectedDescriptor = {
      ...descriptor,
      dailyCallsTotal: 200,
    };
    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(expectedDescriptor),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });

  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    const expectedDescriptor: Descriptor = {
      ...descriptor,
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 50,
    };
    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        buildUpdateDescriptorSeed(expectedDescriptor),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });

  it("should throw attributeNotFound if at least one of the attributes doesn't exist", async () => {
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

    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);
    const notExistingId1 = generateId();
    const notExistingId2 = generateId();

    const descriptorSeed = {
      ...buildUpdateDescriptorSeed(mockDescriptor),
      attributes: {
        certified: [],
        declared: [
          [
            { id: attribute.id, explicitAttributeVerification: false },
            {
              id: notExistingId1,
              explicitAttributeVerification: false,
            },
            {
              id: notExistingId2,
              explicitAttributeVerification: false,
            },
          ],
        ],
        verified: [],
      },
    };

    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        descriptorSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(attributeNotFound(notExistingId1));
  });

  it("should throw templateInstanceNotAllowed if the eservice is a template instance", async () => {
    const template = getMockEServiceTemplate();

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
      name: template.name,
      templateRef: {
        id: template.id,
        instanceLabel: undefined,
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
    const notExistingId1 = generateId();
    const notExistingId2 = generateId();

    const descriptorSeed = {
      ...buildUpdateDescriptorSeed(mockDescriptor),
      attributes: {
        certified: [],
        declared: [
          [
            { id: attribute.id, explicitAttributeVerification: false },
            {
              id: notExistingId1,
              explicitAttributeVerification: false,
            },
            {
              id: notExistingId2,
              explicitAttributeVerification: false,
            },
          ],
        ],
        verified: [],
      },
    };

    expect(
      catalogService.updateDraftDescriptor(
        eservice.id,
        descriptor.id,
        descriptorSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      templateInstanceNotAllowed(eservice.id, template.id)
    );
  });
});
