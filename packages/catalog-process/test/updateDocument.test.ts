/* eslint-disable @typescript-eslint/no-floating-promises */
import { genericLogger } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockDelegation,
} from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  descriptorState,
  EService,
  toEServiceV2,
  EServiceDescriptorDocumentUpdatedV2,
  operationForbidden,
  generateId,
  Document,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  notValidDescriptorState,
  eServiceDocumentNotFound,
  prettyNameDuplicate,
} from "../src/model/domain/errors.js";
import {
  addOneEService,
  catalogService,
  getMockAuthData,
  readLastEserviceEvent,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  addOneDelegation,
} from "./utils.js";

describe("update Document", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it.each(
    Object.values(descriptorState).filter(
      (state) =>
        state !== descriptorState.archived &&
        state !== descriptorState.waitingForApproval
    )
  )(
    "should write on event-store for the update of a document in a descriptor in %s state",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        docs: [mockDocument],
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      const returnedDocument = await catalogService.updateDocument(
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

      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceDescriptorDocumentUpdated");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorDocumentUpdatedV2,
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
              docs: [returnedDocument],
            },
          ],
        })
      );
    }
  );
  it.each(
    Object.values(descriptorState).filter(
      (state) =>
        state !== descriptorState.archived &&
        state !== descriptorState.waitingForApproval
    )
  )(
    "should write on event-store for the update of a document in a descriptor in %s state (delegate)",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        docs: [mockDocument],
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

      const returnedDocument = await catalogService.updateDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
        {
          authData: getMockAuthData(delegation.delegateId),
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

      expect(writtenEvent.stream_id).toBe(eservice.id);
      expect(writtenEvent.version).toBe("1");
      expect(writtenEvent.type).toBe("EServiceDescriptorDocumentUpdated");
      expect(writtenEvent.event_version).toBe(2);
      const writtenPayload = decodeProtobufPayload({
        messageType: EServiceDescriptorDocumentUpdatedV2,
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
              docs: [returnedDocument],
            },
          ],
        })
      );
    }
  );
  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    expect(
      catalogService.updateDocument(
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
  it("should throw operationForbidden if the requester is not the producer", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [mockDocument],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateDocument(
        eservice.id,
        descriptor.id,
        mockDocument.id,
        { prettyName: "updated prettyName" },
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
      docs: [mockDocument],
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
    expect(
      catalogService.updateDocument(
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
    ).rejects.toThrowError(operationForbidden);
  });
  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist", async () => {
    const eservice: EService = {
      ...mockEService,
      descriptors: [],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateDocument(
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
  it.each(
    Object.values(descriptorState).filter(
      (state) =>
        state === descriptorState.archived ||
        state === descriptorState.waitingForApproval
    )
  )(
    "should throw notValidDescriptorState if the descriptor is in s% state",
    async (state) => {
      const descriptor: Descriptor = {
        ...getMockDescriptor(state),
        interface: mockDocument,
      };
      const eservice: EService = {
        ...mockEService,
        descriptors: [descriptor],
      };
      await addOneEService(eservice);
      expect(
        catalogService.updateDocument(
          eservice.id,
          descriptor.id,
          generateId(),
          { prettyName: "updated prettyName" },
          {
            authData: getMockAuthData(eservice.producerId),
            correlationId: generateId(),
            serviceName: "",
            logger: genericLogger,
          }
        )
      ).rejects.toThrowError(notValidDescriptorState(descriptor.id, state));
    }
  );
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
      catalogService.updateDocument(
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
  it("should throw prettyNameDuplicate if a document with the same prettyName already exists in that descriptor, case insensitive", async () => {
    const document1: Document = {
      ...getMockDocument(),
      prettyName: "TEST A",
    };
    const document2: Document = {
      ...getMockDocument(),
      prettyName: "test b",
    };
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      state: descriptorState.draft,
      docs: [document1, document2],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    await addOneEService(eservice);
    expect(
      catalogService.updateDocument(
        eservice.id,
        descriptor.id,
        document2.id,
        { prettyName: document1.prettyName.toLowerCase() },
        {
          authData: getMockAuthData(eservice.producerId),
          correlationId: generateId(),
          serviceName: "",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      prettyNameDuplicate(document1.prettyName.toLowerCase(), descriptor.id)
    );
  });
});
