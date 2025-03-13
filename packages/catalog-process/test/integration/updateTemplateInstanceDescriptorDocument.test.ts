/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import { decodeProtobufPayload } from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  EServiceDescriptorDocumentUpdatedByTemplateUpdateV2,
  generateId,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  eServiceDocumentNotFound,
} from "../../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  readLastEserviceEvent,
} from "../integrationUtils.js";
import {
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "../mockUtils.js";

describe("updateTemplateInstanceDescriptorDocument", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();

  it("should write on event-store for the intenral update of a document in a descriptor ", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      docs: [mockDocument],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await catalogService.innerUpdateTemplateInstanceDescriptorDocument(
      eservice.id,
      descriptor.id,
      mockDocument.id,
      { prettyName: "updated prettyName" },
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);
    const expectedEservice = toEServiceV2({
      ...eservice,
      descriptors: [
        {
          ...descriptor,
          docs: [
            {
              ...mockDocument,
              prettyName: "updated prettyName",
            },
          ],
        },
      ],
    });

    expect(writtenEvent).toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
      event_version: 2,
    });

    const writtenPayload = decodeProtobufPayload({
      messageType: EServiceDescriptorDocumentUpdatedByTemplateUpdateV2,
      payload: writtenEvent.data,
    });

    expect(writtenPayload.descriptorId).toEqual(descriptor.id);
    expect(writtenPayload.documentId).toEqual(mockDocument.id);
    expect(writtenPayload.eservice).toEqual(expectedEservice);
    expect(writtenPayload.eservice).toEqual(
      toEServiceV2({
        ...eservice,
        descriptors: [
          {
            ...descriptor,
            docs: [
              {
                ...mockDocument,
                prettyName: "updated prettyName",
              },
            ],
          },
        ],
      })
    );
  });

  it("should not write on event-store if the descriptor document already has the same prettyName", async () => {
    const descriptor: Descriptor = {
      ...getMockDescriptor(),
      docs: [{ ...mockDocument, prettyName: "updated prettyName" }],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    await catalogService.innerUpdateTemplateInstanceDescriptorDocument(
      eservice.id,
      descriptor.id,
      mockDocument.id,
      { prettyName: "updated prettyName" },
      {
        authData: getMockAuthData(eservice.producerId),
        correlationId: generateId(),
        serviceName: "",
        logger: genericLogger,
      }
    );
    const writtenEvent = await readLastEserviceEvent(eservice.id);

    expect(writtenEvent).not.toMatchObject({
      stream_id: eservice.id,
      version: "1",
      type: "EServiceDescriptorDocumentUpdatedByTemplateUpdate",
      event_version: 2,
    });
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    expect(
      catalogService.innerUpdateTemplateInstanceDescriptorDocument(
        mockEService.id,
        mockDescriptor.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
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
      catalogService.innerUpdateTemplateInstanceDescriptorDocument(
        eservice.id,
        mockDescriptor.id,
        generateId(),
        { prettyName: "updated prettyName" },
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

  it("should throw eServiceDocumentNotFound if the document doesn't exist", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.innerUpdateTemplateInstanceDescriptorDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      eServiceDocumentNotFound(eservice.id, descriptor.id, mockDocument.id)
    );
  });
});
