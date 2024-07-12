/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test/index.js";
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
} from "pagopa-interop-models";
import { expect, describe, it, afterAll, beforeAll, vi } from "vitest";
import {
  draftDescriptorAlreadyExists,
  eServiceNotFound,
  attributeNotFound,
  inconsistentDailyCalls,
} from "../src/model/domain/errors.js";
import { CreateEServiceDescriptorSeed } from "../src/model/domain/models.js";
import {
  addOneAttribute,
  addOneEService,
  catalogService,
  getMockAuthData,
  readLastEserviceEvent,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  buildCreateDescriptorSeed,
  postgresDB,
} from "./utils.js";

describe("create descriptor", async () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  // To do: remove this use case also from tests?
  it("should write on event-store for the creation of a descriptor (eservice had no descriptors)", async () => {
    const mockDescriptor = {
      ...getMockDescriptor(),
      docs: [getMockDocument()],
    };
    const attribute: Attribute = {
      name: "Attribute name",
      id: generateId(),
      kind: "Declared",
      description: "Attribute Description",
      creationTime: new Date(),
    };
    await addOneAttribute(attribute);
    const descriptorSeed: CreateEServiceDescriptorSeed = {
      ...buildCreateDescriptorSeed(mockDescriptor),
      attributes: {
        certified: [],
        declared: [
          [{ id: attribute.id, explicitAttributeVerification: false }],
        ],
        verified: [],
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      descriptors: [],
    };
    await addOneEService(eservice);
    const returnedDescriptor = await catalogService.createDescriptor(
      eservice.id,
      descriptorSeed,
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      }
    );
    const newDescriptorId = returnedDescriptor.id;
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

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...mockDescriptor,
          version: "1",
          createdAt: new Date(
            Number(writtenPayload.eservice!.descriptors[0]!.createdAt)
          ),
          id: newDescriptorId,
          serverUrls: [],
          attributes: {
            certified: [],
            declared: [
              [{ id: attribute.id, explicitAttributeVerification: false }],
            ],
            verified: [],
          },
        },
      ],
    });

    expect(writtenPayload).toEqual({
      descriptorId: newDescriptorId,
      eservice: expectedEservice,
    });
    expect(writtenPayload).toEqual({
      descriptorId: newDescriptorId,
      eservice: toEServiceV2({
        ...eservice,
        descriptors: [returnedDescriptor],
      }),
    });
  });

  // To do: this is the only use case that will remain active
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
    const descriptorSeed: CreateEServiceDescriptorSeed = {
      ...buildCreateDescriptorSeed(mockDescriptor),
      attributes: {
        certified: [],
        declared: [
          [{ id: attribute.id, explicitAttributeVerification: false }],
        ],
        verified: [],
      },
    };

    const returnedDescriptor = await catalogService.createDescriptor(
      eservice.id,
      descriptorSeed,
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      }
    );
    const newDescriptorId = returnedDescriptor.id;
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
        declared: [
          [{ id: attribute.id, explicitAttributeVerification: false }],
        ],
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

  it("should throw draftDescriptorAlreadyExists if a draft descriptor already exists", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
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
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(draftDescriptorAlreadyExists(eservice.id));
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const mockEService = getMockEService();
    expect(
      catalogService.createDescriptor(
        mockEService.id,
        buildCreateDescriptorSeed(getMockDescriptor()),
        {
          authData: getMockAuthData(mockEService.producerId),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
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
      catalogService.createDescriptor(eservice.id, descriptorSeed, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
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
        {
          authData: getMockAuthData(),
          correlationId: "",
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw inconsistentDailyCalls if dailyCallsPerConsumer is greater than dailyCallsTotal", async () => {
    const descriptorSeed: CreateEServiceDescriptorSeed = {
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
      catalogService.createDescriptor(eservice.id, descriptorSeed, {
        authData: getMockAuthData(eservice.producerId),
        correlationId: "",
        serviceName: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(inconsistentDailyCalls());
  });
});
