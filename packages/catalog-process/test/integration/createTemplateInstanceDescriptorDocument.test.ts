/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  unsafeBrandId,
  EServiceDescriptorDocumentAddedByTemplateUpdateV2,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  decodeProtobufPayload,
  getMockContext,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  buildDocumentSeed,
  buildInterfaceSeed,
} from "../mockUtils.js";

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

      await catalogService.internalCreateTemplateInstanceDescriptorDocument(
        eservice.id,
        descriptor.id,
        newDocument,
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
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

    await catalogService.internalCreateTemplateInstanceDescriptorDocument(
      eservice.id,
      descriptor.id,
      newDocument,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
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

    await catalogService.internalCreateTemplateInstanceDescriptorDocument(
      eservice.id,
      descriptor.id,
      newDocument,
      getMockContext({ authData: getMockAuthData(eservice.producerId) })
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
      catalogService.internalCreateTemplateInstanceDescriptorDocument(
        mockEService.id,
        mockDescriptor.id,
        buildInterfaceSeed(),
        getMockContext({})
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
      catalogService.internalCreateTemplateInstanceDescriptorDocument(
        eservice.id,
        mockDescriptor.id,
        buildInterfaceSeed(),
        getMockContext({ authData: getMockAuthData(eservice.producerId) })
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });
});
