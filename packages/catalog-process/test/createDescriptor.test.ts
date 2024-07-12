/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { decodeProtobufPayload } from "pagopa-interop-commons-test/index.js";
import {
  Attribute,
  generateId,
  EService,
  EServiceDescriptorAddedV2,
  toEServiceV2,
  Descriptor,
  descriptorState,
  operationForbidden,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
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
} from "./utils.js";

describe("create descriptor", async () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();

  it("should write on event-store for the creation of a descriptor (eservice had no descriptors)", async () => {
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
      ...mockEService,
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

  it("should write on event-store for the creation of a descriptor (eservice already had one descriptor)", async () => {
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

    const newDescriptor: Descriptor = {
      ...mockDescriptor,
      version: "2",
      createdAt: new Date(
        Number(writtenPayload.eservice!.descriptors[1]!.createdAt)
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
    };

    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [...eservice.descriptors, newDescriptor],
    });

    expect(writtenPayload).toEqual({
      descriptorId: newDescriptorId,
      eservice: expectedEservice,
    });
    expect(writtenPayload).toEqual({
      descriptorId: newDescriptorId,
      eservice: toEServiceV2({
        ...eservice,
        descriptors: [...eservice.descriptors, returnedDescriptor],
      }),
    });
  });

  it("should throw draftDescriptorAlreadyExists if a draft descriptor already exists", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
    };
    const eservice: EService = {
      ...mockEService,
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
    expect(
      catalogService.createDescriptor(
        mockEService.id,
        buildCreateDescriptorSeed(mockDescriptor),
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
      ...mockEService,
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
      ...buildCreateDescriptorSeed(mockDescriptor),
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
      ...buildCreateDescriptorSeed(mockDescriptor),
      dailyCallsPerConsumer: 100,
      dailyCallsTotal: 50,
    };
    const eservice: EService = {
      ...mockEService,
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
