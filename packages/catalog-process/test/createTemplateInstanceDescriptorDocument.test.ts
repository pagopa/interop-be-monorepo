/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  unsafeBrandId,
  generateId,
  EServiceDescriptorDocumentAddedByTemplateUpdateV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import { decodeProtobufPayload } from "pagopa-interop-commons-test/index.js";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  buildInterfaceSeed,
  getMockAuthData,
  readLastEserviceEvent,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  buildDocumentSeed,
} from "./utils.js";

describe("createTemplateInstanceDescriptorDocument", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();

  it.each(
    Object.values(descriptorState).filter(
      (state) => state !== descriptorState.archived
    )
  )(
    "should write on event-store for the internal creation of a document when descriptor state is %s",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        serverUrls: [],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);

      const newDocument = buildDocumentSeed();

      await catalogService.createTemplateInstanceDescriptorDocument(
        eservice.id,
        descriptor.id,
        newDocument,
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      );

      const writtenEvent = await readLastEserviceEvent(mockEService.id);

      expect(writtenEvent).toMatchObject({
        stream_id: mockEService.id,
        version: "1",
        type: "EServiceDescriptorDocumentAddedByTemplateUpdate",
        event_version: 2,
      });

      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorDocumentAddedByTemplateUpdateV2,
        payload: writtenEvent.data,
      });

      const updatedEService: EService = {
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            docs: [
              {
                ...mockDocument,
                id: unsafeBrandId(
                  writtenPayload.eservice!.descriptors[0]!.docs[0]!.id
                ),
                checksum: newDocument.checksum,
                uploadDate: new Date(
                  writtenPayload.eservice!.descriptors[0]!.docs[0]!.uploadDate
                ),
              },
            ],
          },
        ],
      };

      expect(writtenPayload.eservice).toEqual(toEServiceV2(updatedEService));
    }
  );

  it("should not write on event-store for the internal creation of a document if the descriptor already has the document", async () => {
    const newDocument = buildDocumentSeed();

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      docs: [
        {
          ...getMockDocument(),
          ...newDocument,
        },
      ],
      serverUrls: [],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await catalogService.createTemplateInstanceDescriptorDocument(
      eservice.id,
      descriptor.id,
      newDocument,
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    const writtenEvent = await readLastEserviceEvent(mockEService.id);

    expect(writtenEvent).not.toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "EServiceDescriptorDocumentAddedByTemplateUpdate",
      event_version: 2,
    });
  });

  it("should not write on event-store for the internal creation of a document if the descriptor is in archived state", async () => {
    const newDocument = buildDocumentSeed();

    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.archived,
      serverUrls: [],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);

    await catalogService.createTemplateInstanceDescriptorDocument(
      eservice.id,
      descriptor.id,
      newDocument,
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );

    const writtenEvent = await readLastEserviceEvent(mockEService.id);

    expect(writtenEvent).not.toMatchObject({
      stream_id: mockEService.id,
      version: "1",
      type: "EServiceDescriptorDocumentAddedByTemplateUpdate",
      event_version: 2,
    });
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", () => {
    expect(
      catalogService.createTemplateInstanceDescriptorDocument(
        mockEService.id,
        mockDescriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(),
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
    expect(
      catalogService.createTemplateInstanceDescriptorDocument(
        eservice.id,
        mockDescriptor.id,
        buildInterfaceSeed(),
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
});
