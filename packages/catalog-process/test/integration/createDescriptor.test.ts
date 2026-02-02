/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  decodeProtobufPayload,
  getMockContext,
  getMockDelegation,
  getMockAuthData,
  readEventByStreamIdAndVersion,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  Attribute,
  generateId,
  EService,
  EServiceDescriptorAddedV2,
  toEServiceV2,
  Descriptor,
  descriptorState,
  operationForbidden,
  EServiceDescriptorDocumentAddedV2,
  delegationState,
  delegationKind,
  EServiceTemplateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  draftDescriptorAlreadyExists,
  eServiceNotFound,
  attributeNotFound,
  inconsistentDailyCalls,
  templateInstanceNotAllowed,
} from "../../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneDelegation,
  addOneEService,
  catalogService,
  postgresDB,
  readLastEserviceEvent,
} from "../integrationUtils.js";
import { buildCreateDescriptorSeed } from "../mockUtils.js";

describe("create descriptor", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it("should write on event-store for the creation of a descriptor (eservice had no descriptors)", async () => {
    const mockDescriptor = {
      ...getMockDescriptor(),
      docs: [],
    };
    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);
    const descriptorSeed: catalogApi.EServiceDescriptorSeed = {
      ...buildCreateDescriptorSeed(mockDescriptor),
      attributes: {
        certified: [],
        declared: [[{ id: attribute.id }]],
        verified: [],
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [],
    };
    await addOneEService(eservice);
    const createDescriptorResponse = await catalogService.createDescriptor(
      eservice.id,
      descriptorSeed,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );
    const newDescriptorId = createDescriptorResponse.data.createdDescriptorId;
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });
    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: writtenEvent.data,
    });

    const expectedDescriptor = {
      ...mockDescriptor,
      version: "1",
      createdAt: new Date(
        Number(writtenPayload.eservice!.descriptors[0]!.createdAt)
      ),
      id: newDescriptorId,
      serverUrls: [],
      attributes: {
        certified: [],
        declared: [[{ id: attribute.id }]],
        verified: [],
      },
    };

    const expectedEservice = {
      ...eservice,
      descriptors: [expectedDescriptor],
    };

    expect(createDescriptorResponse).toEqual({
      data: {
        createdDescriptorId: newDescriptorId,
        eservice: expectedEservice,
      },
      metadata: { version: 1 },
    });
    expect(writtenPayload).toEqual({
      descriptorId: newDescriptorId,
      eservice: toEServiceV2(expectedEservice),
    });
  });

  it("should write on event-store for the creation of a descriptor (eservice already had one descriptor)", async () => {
    const mockDocument = getMockDocument();
    const existingDescriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      state: descriptorState.published,
    };
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      docs: [mockDocument],
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [existingDescriptor],
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
    const descriptorSeed: catalogApi.EServiceDescriptorSeed = {
      ...buildCreateDescriptorSeed(mockDescriptor),
      attributes: {
        certified: [],
        declared: [[{ id: attribute.id }]],
        verified: [],
      },
    };

    const createDescriptorResponse = await catalogService.createDescriptor(
      eservice.id,
      descriptorSeed,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
    );

    const newDescriptorId = createDescriptorResponse.data.createdDescriptorId;
    const descriptorCreationEvent = await readEventByStreamIdAndVersion(
      eservice.id,
      1,
      "catalog",
      postgresDB
    );
    const documentAdditionEvent = await readLastEserviceEvent(eservice.id);

    expect(descriptorCreationEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });
    expect(documentAdditionEvent).toMatchObject({
      stream_id: eservice.id,
      version: "2",
      type: "EServiceDescriptorDocumentAdded",
      event_version: 2,
    });

    const descriptorCreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: descriptorCreationEvent.data,
    });
    const documentAdditionPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorDocumentAddedV2,
      payload: documentAdditionEvent.data,
    });

    const newDescriptor: Descriptor = {
      ...mockDescriptor,
      version: "2",
      createdAt: new Date(),
      id: newDescriptorId,
      serverUrls: [],
      attributes: {
        certified: [],
        declared: [[{ id: attribute.id }]],
        verified: [],
      },
      docs: [],
    };

    const expectedEserviceAfterDescriptorCreation: EService = {
      ...eservice,
      descriptors: [...eservice.descriptors, newDescriptor],
    };
    const expectedEserviceAfterDocumentAddition: EService = {
      ...expectedEserviceAfterDescriptorCreation,
      descriptors: expectedEserviceAfterDescriptorCreation.descriptors.map(
        (d) =>
          d.id === newDescriptor.id
            ? { ...newDescriptor, docs: [mockDocument] }
            : d
      ),
    };

    expect(createDescriptorResponse).toEqual({
      data: {
        createdDescriptorId: newDescriptorId,
        eservice: expectedEserviceAfterDocumentAddition,
      },
      metadata: { version: 2 },
    });
    expect(descriptorCreationPayload).toEqual({
      descriptorId: newDescriptorId,
      eservice: toEServiceV2(expectedEserviceAfterDescriptorCreation),
    });
    expect(documentAdditionPayload).toEqual({
      documentId: mockDocument.id,
      descriptorId: newDescriptorId,
      eservice: toEServiceV2(expectedEserviceAfterDocumentAddition),
    });
  });

  it("should write on event-store for the creation of a descriptor (delegate)", async () => {
    const mockDocument = getMockDocument();
    const existingDescriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      state: descriptorState.published,
    };
    const mockDescriptor: Descriptor = {
      ...getMockDescriptor(),
      docs: [mockDocument],
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [existingDescriptor],
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
    const descriptorSeed: catalogApi.EServiceDescriptorSeed = {
      ...buildCreateDescriptorSeed(mockDescriptor),
      attributes: {
        certified: [],
        declared: [[{ id: attribute.id }]],
        verified: [],
      },
    };

    const createDescriptorResponse = await catalogService.createDescriptor(
      eservice.id,
      descriptorSeed,
      getMockContext({ authData: getMockAuthData(delegation.delegateId) })
    );

    const newDescriptorId = createDescriptorResponse.data.createdDescriptorId;
    const descriptorCreationEvent = await readEventByStreamIdAndVersion(
      eservice.id,
      1,
      "catalog",
      postgresDB
    );
    const documentAdditionEvent = await readLastEserviceEvent(eservice.id);

    expect(descriptorCreationEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorAdded",
      event_version: 2,
    });
    expect(documentAdditionEvent).toMatchObject({
      stream_id: eservice.id,
      version: "2",
      type: "EServiceDescriptorDocumentAdded",
      event_version: 2,
    });

    const descriptorCreationPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorAddedV2,
      payload: descriptorCreationEvent.data,
    });
    const documentAdditionPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorDocumentAddedV2,
      payload: documentAdditionEvent.data,
    });

    const newDescriptor: Descriptor = {
      ...mockDescriptor,
      version: "2",
      createdAt: new Date(),
      id: newDescriptorId,
      serverUrls: [],
      attributes: {
        certified: [],
        declared: [[{ id: attribute.id }]],
        verified: [],
      },
      docs: [],
    };

    const expectedEserviceAfterDescriptorCreation: EService = {
      ...eservice,
      descriptors: [...eservice.descriptors, newDescriptor],
    };
    const expectedEserviceAfterDocumentAddition: EService = {
      ...expectedEserviceAfterDescriptorCreation,
      descriptors: expectedEserviceAfterDescriptorCreation.descriptors.map(
        (d) =>
          d.id === newDescriptor.id
            ? { ...newDescriptor, docs: [mockDocument] }
            : d
      ),
    };

    expect(createDescriptorResponse).toEqual({
      data: {
        createdDescriptorId: newDescriptorId,
        eservice: expectedEserviceAfterDocumentAddition,
      },
      metadata: { version: 2 },
    });
    expect(descriptorCreationPayload).toEqual({
      descriptorId: newDescriptorId,
      eservice: toEServiceV2(expectedEserviceAfterDescriptorCreation),
    });
    expect(documentAdditionPayload).toEqual({
      documentId: mockDocument.id,
      descriptorId: newDescriptorId,
      eservice: toEServiceV2(expectedEserviceAfterDocumentAddition),
    });
  });

  it.each([descriptorState.draft, descriptorState.waitingForApproval])(
    "should throw draftDescriptorAlreadyExists if a descriptor with state %s already exists",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(),
        state,
      };
      const eservice: EService = {
        ...getMockEService(),
        descriptors: [descriptor],
      };

      await addOneEService(eservice);
      expect(
        catalogService.createDescriptor(
          eservice.id,
          buildCreateDescriptorSeed(descriptor),
          getMockContext({ authData: getMockAuthData(eservice.producerId) })
        )
      ).rejects.toThrowError(draftDescriptorAlreadyExists(eservice.id));
    }
  );

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const mockEService = getMockEService();
    expect(
      catalogService.createDescriptor(
        mockEService.id,
        buildCreateDescriptorSeed(getMockDescriptor()),
        getMockContext({ authData: getMockAuthData(mockEService.producerId) })
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });
  it("should throw attributeNotFound if at least one of the attributes doesn't exist", async () => {
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [],
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
      ...buildCreateDescriptorSeed(getMockDescriptor()),
      attributes: {
        certified: [],
        declared: [
          [
            { id: attribute.id },
            {
              id: notExistingId1,
            },
            {
              id: notExistingId2,
            },
          ],
        ],
        verified: [],
      },
    };

    expect(
      catalogService.createDescriptor(
        eservice.id,
        descriptorSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(attributeNotFound(notExistingId1));
  });
  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.createDescriptor(
        eservice.id,
        buildCreateDescriptorSeed(descriptor),
        getMockContext({})
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw operationForbidden if the requester if the given e-service has been delegated and caller is not the delegate", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      interface: getMockDocument(),
      state: descriptorState.published,
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [descriptor],
    };
    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    expect(
      catalogService.createDescriptor(
        eservice.id,
        buildCreateDescriptorSeed(descriptor),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const descriptorSeed: catalogApi.EServiceDescriptorSeed = {
      ...buildCreateDescriptorSeed(getMockDescriptor()),
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 50,
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [],
    };

    await addOneEService(eservice);
    expect(
      catalogService.createDescriptor(
        eservice.id,
        descriptorSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
  it("should throw templateInstanceNotAllowed if the templateId is defined", async () => {
    const templateId = unsafeBrandId<EServiceTemplateId>(generateId());
    const descriptorSeed: catalogApi.EServiceDescriptorSeed = {
      ...buildCreateDescriptorSeed(getMockDescriptor()),
    };
    const eservice: EService = {
      ...getMockEService(),
      templateId,
      descriptors: [],
    };

    await addOneEService(eservice);
    expect(
      catalogService.createDescriptor(
        eservice.id,
        descriptorSeed,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(templateInstanceNotAllowed(eservice.id, templateId));
  });
});
