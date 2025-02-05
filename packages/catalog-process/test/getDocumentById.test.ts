/* eslint-disable @typescript-eslint/no-floating-promises */
import { AuthData, userRoles, genericLogger } from "pagopa-interop-commons";
import {
  Descriptor,
  EService,
  generateId,
  descriptorState,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { expect, describe, it } from "vitest";
import { getMockDelegation } from "pagopa-interop-commons-test/index.js";
import {
  eServiceNotFound,
  eServiceDescriptorNotFound,
  eServiceDocumentNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneDelegation,
  addOneEService,
  catalogService,
  getMockAuthData,
  getMockDescriptor,
  getMockDocument,
  getMockEService,
} from "./utils.js";

describe("get document by id", () => {
  const mockDescriptor = getMockDescriptor();
  const mockEService = getMockEService();
  const mockDocument = getMockDocument();
  it("should get the document if it exists (requester is the producer, admin)", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      docs: [mockDocument],
    };
    const eservice: EService = {
      ...mockEService,
      id: generateId(),
      name: "eservice 001",
      descriptors: [descriptor],
    };
    const authData: AuthData = {
      ...getMockAuthData(eservice.producerId),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    await addOneEService(eservice);
    const result = await catalogService.getDocumentById(
      {
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        documentId: mockDocument.id,
      },
      {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "",
      }
    );
    expect(result).toEqual(mockDocument);
  });

  it("should get the interface if it exists (requester is the producer, admin)", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      docs: [],
    };
    const eservice: EService = {
      ...mockEService,
      id: generateId(),
      name: "eservice 001",
      descriptors: [descriptor],
    };
    const authData: AuthData = {
      ...getMockAuthData(eservice.producerId),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    await addOneEService(eservice);
    const result = await catalogService.getDocumentById(
      {
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        documentId: mockDocument.id,
      },
      {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "",
      }
    );
    expect(result).toEqual(mockDocument);
  });

  it("should get the interface if it exists (requester is the delegate, admin)", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      interface: mockDocument,
      docs: [],
    };
    const eservice: EService = {
      ...mockEService,
      id: generateId(),
      name: "eservice 001",
      descriptors: [descriptor],
    };

    const delegation = getMockDelegation({
      kind: delegationKind.delegatedProducer,
      eserviceId: eservice.id,
      state: delegationState.active,
    });

    const authData: AuthData = {
      ...getMockAuthData(delegation.delegateId),
      userRoles: [userRoles.ADMIN_ROLE],
    };

    await addOneEService(eservice);
    await addOneDelegation(delegation);

    const result = await catalogService.getDocumentById(
      {
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        documentId: mockDocument.id,
      },
      {
        authData,
        logger: genericLogger,
        correlationId: generateId(),
        serviceName: "",
      }
    );
    expect(result).toEqual(mockDocument);
  });

  it("should throw eServiceNotFound if the eservice doesn't exist", async () => {
    const authData: AuthData = {
      ...getMockAuthData(),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    expect(
      catalogService.getDocumentById(
        {
          eserviceId: mockEService.id,
          descriptorId: mockDescriptor.id,
          documentId: mockDocument.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(eServiceNotFound(mockEService.id));
  });

  it("should throw eServiceDescriptorNotFound if the descriptor doesn't exist (requester is the producer, admin)", async () => {
    const eservice: EService = {
      ...mockEService,
      id: generateId(),
      descriptors: [],
    };
    await addOneEService(eservice);
    const authData: AuthData = {
      ...getMockAuthData(),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    expect(
      catalogService.getDocumentById(
        {
          eserviceId: eservice.id,
          descriptorId: mockDescriptor.id,
          documentId: mockDocument.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      eServiceDescriptorNotFound(eservice.id, mockDescriptor.id)
    );
  });

  it("should throw eServiceDocumentNotFound if the document doesn't exist (requester is the producer, admin)", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [],
    };
    const eservice: EService = {
      ...mockEService,
      id: generateId(),
      name: "eservice 001",
      descriptors: [descriptor],
    };
    const authData: AuthData = {
      ...getMockAuthData(eservice.producerId),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    await addOneEService(eservice);
    expect(
      catalogService.getDocumentById(
        {
          eserviceId: eservice.id,
          descriptorId: mockDescriptor.id,
          documentId: mockDocument.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(
      eServiceDocumentNotFound(eservice.id, mockDescriptor.id, mockDocument.id)
    );
  });
  it("should throw eServiceNotFound if the document belongs to a draft descriptor (requester is not the producer)", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [mockDocument],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const authData: AuthData = {
      ...getMockAuthData(),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    await addOneEService(eservice);
    expect(
      catalogService.getDocumentById(
        {
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          documentId: mockDocument.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
  it("should throw eServiceNotFound if the document belongs to a draft descriptor (requester is the producer but not admin, nor api, nor support)", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [mockDocument],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const authData: AuthData = {
      ...getMockAuthData(eservice.producerId),
      userRoles: [userRoles.SECURITY_ROLE],
    };
    await addOneEService(eservice);
    expect(
      catalogService.getDocumentById(
        {
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          documentId: mockDocument.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
  it("should throw eServiceNotFound if the document belongs to a draft descriptor (requester is not the producer)", async () => {
    const descriptor: Descriptor = {
      ...mockDescriptor,
      state: descriptorState.draft,
      docs: [mockDocument],
    };
    const eservice: EService = {
      ...mockEService,
      descriptors: [descriptor],
    };
    const authData: AuthData = {
      ...getMockAuthData(),
      userRoles: [userRoles.ADMIN_ROLE],
    };
    await addOneEService(eservice);
    expect(
      catalogService.getDocumentById(
        {
          eserviceId: eservice.id,
          descriptorId: descriptor.id,
          documentId: mockDocument.id,
        },
        {
          authData,
          logger: genericLogger,
          correlationId: generateId(),
          serviceName: "",
        }
      )
    ).rejects.toThrowError(eServiceNotFound(eservice.id));
  });
});
