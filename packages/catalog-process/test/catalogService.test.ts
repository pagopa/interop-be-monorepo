/* eslint-disable @typescript-eslint/no-floating-promises */
import { generateMock } from "@anatine/zod-mock";
import { describe, expect, it, vi } from "vitest";
import {
  Descriptor,
  EService,
  descriptorState,
  WithMetadata,
  operationForbidden,
} from "pagopa-interop-models";
import { AuthData } from "pagopa-interop-commons";
import {
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiTechnologyToTechnology,
} from "../src/model/domain/apiConverter.js";
import {
  activateDescriptorLogic,
  archiveDescriptorLogic,
  cloneDescriptorLogic,
  createDescriptorLogic,
  createEserviceLogic,
  deleteDocumentLogic,
  deleteDraftDescriptorLogic,
  deleteEserviceLogic,
  publishDescriptorLogic,
  suspendDescriptorLogic,
  updateDescriptorLogic,
  updateDocumentLogic,
  updateEserviceLogic,
  uploadDocumentLogic,
} from "../src/services/catalogService.js";
import * as api from "../src/model/generated/api.js";
import {
  toAgreementApprovalPolicyV1,
  toDescriptorV1,
  toEServiceAttributeV1,
  toEServiceDescriptorStateV1,
  toEServiceTechnologyV1,
  toEServiceV1,
} from "../src/model/domain/toEvent.js";
import {
  draftDescriptorAlreadyExists,
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceDescriptorNotFound,
  eServiceDocumentNotFound,
  eServiceDuplicate,
  eServiceNotFound,
  notValidDescriptor,
} from "../src/model/domain/errors.js";

const shuffle = <T>(array: T[]): T[] => array.sort(() => Math.random() - 0.5);

const mockEservice: EService = generateMock(EService);
const mockEserviceSeed = generateMock(api.schemas.EServiceSeed);
const mockDescriptor = generateMock(Descriptor);
const mockDocument = generateMock(
  api.schemas.CreateEServiceDescriptorDocumentSeed
);
const mockUpdateDocumentSeed = generateMock(
  api.schemas.UpdateEServiceDescriptorDocumentSeed
);
const mockEserviceDescriptorSeed = generateMock(api.schemas.EServiceDescriptor);
const mockUpdateDescriptorSeed = generateMock(
  api.schemas.EServiceDescriptorSeed
);

const authData: AuthData = {
  organizationId: mockEservice.producerId,
  userId: "userId",
  userRoles: ["ADMIN"],
  externalId: {
    origin: "IPA",
    value: "123456",
  },
};

const addMetadata = (eService: EService): WithMetadata<EService> => ({
  data: eService,
  metadata: { version: 0 },
});

describe("CatalogService", () => {
  describe("createEService", () => {
    it("creates the eservice", async () => {
      const eService = {
        ...mockEservice,
        attributes: undefined,
        descriptors: [],
      };

      const event = createEserviceLogic({
        eService: undefined,
        apiEServicesSeed: mockEserviceSeed,
        authData,
      });
      expect(event.event.type).toBe("EServiceAdded");
      expect(event.event.data).toMatchObject({
        eService: {
          ...toEServiceV1(eService),
          id: event.streamId,
          createdAt: (
            event.event.data as unknown as { eService: { createdAt: Date } }
          ).eService.createdAt,
          description: mockEserviceSeed.description,
          name: mockEserviceSeed.name,
          technology: toEServiceTechnologyV1(
            apiTechnologyToTechnology(mockEserviceSeed.technology)
          ),
          producerId: authData.organizationId,
        },
      });
    });

    it("returns an error if the eservice list is not empty", async () => {
      expect(() =>
        createEserviceLogic({
          eService: addMetadata(mockEservice),
          apiEServicesSeed: mockEserviceSeed,
          authData,
        })
      ).toThrowError(eServiceDuplicate(mockEserviceSeed.name));
    });
  });
  describe("updateEService", () => {
    it("updates the eservice", async () => {
      const eService = { ...mockEservice, descriptors: [] };

      const event = await updateEserviceLogic({
        eService: addMetadata(eService),
        eServiceId: mockEservice.id,
        eServiceSeed: mockEserviceSeed,
        authData,
        getEServiceByNameAndProducerId: () => Promise.resolve(undefined),
      });
      expect(event.event.type).toBe("EServiceUpdated");
      expect(event.event.data).toMatchObject({
        eService: {
          ...toEServiceV1(eService),
          description: mockEserviceSeed.description,
          name: mockEserviceSeed.name,
          technology: toEServiceTechnologyV1(
            apiTechnologyToTechnology(mockEserviceSeed.technology)
          ),
          producerId: authData.organizationId,
        },
      });
    });

    it("returns an error if the eservice contains valid descriptors", async () => {
      expect(() =>
        updateEserviceLogic({
          eService: addMetadata({
            ...mockEservice,
            descriptors: [{ ...mockDescriptor, state: "Archived" }],
          }),
          eServiceId: mockEservice.id,
          authData,
          eServiceSeed: mockEserviceSeed,
          getEServiceByNameAndProducerId: () => Promise.resolve(undefined),
        })
      ).rejects.toThrowError(eServiceCannotBeUpdated(mockEservice.id));
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      expect(() =>
        updateEserviceLogic({
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
          eServiceId: mockEservice.id,
          eServiceSeed: mockEserviceSeed,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          getEServiceByNameAndProducerId: () => Promise.resolve(undefined),
        })
      ).rejects.toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      expect(() =>
        updateEserviceLogic({
          eService: undefined,
          eServiceId,
          eServiceSeed: mockEserviceSeed,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          getEServiceByNameAndProducerId: () => Promise.resolve(undefined),
        })
      ).rejects.toThrowError(eServiceNotFound(eServiceId));
    });
  });
  describe("deleteEService", () => {
    it("delete the eservice", async () => {
      const event = deleteEserviceLogic({
        eServiceId: mockEservice.id,
        authData,
        eService: addMetadata({ ...mockEservice, descriptors: [] }),
      });
      expect(event.event.type).toBe("EServiceDeleted");
      expect(event.event.data).toMatchObject({
        eServiceId: mockEservice.id,
      });
    });

    it("returns an error if the eservice contains descriptors", async () => {
      expect(() =>
        deleteEserviceLogic({
          eServiceId: mockEservice.id,
          authData,
          eService: addMetadata({
            ...mockEservice,
            descriptors: [{ ...mockDescriptor, state: "Archived" }],
          }),
        })
      ).toThrowError(eServiceCannotBeDeleted(mockEservice.id));
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      expect(() =>
        deleteEserviceLogic({
          eServiceId: mockEservice.id,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
        })
      ).toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      expect(() =>
        deleteEserviceLogic({
          eServiceId,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          eService: undefined,
        })
      ).toThrowError(eServiceNotFound(eServiceId));
    });
  });
  describe("uploadDocument", () => {
    it("uploads the document", async () => {
      const descriptor = {
        ...mockDescriptor,
        state: descriptorState.draft,
      };
      const eService = {
        ...mockEservice,
        descriptors: [descriptor],
      };
      const event = uploadDocumentLogic({
        eServiceId: eService.id,
        descriptorId: eService.descriptors[0].id,
        document: mockDocument,
        authData,
        eService: addMetadata(eService),
      });
      expect(event.event.type).toBe("EServiceDocumentAdded");
      expect(event.event.data).toMatchObject({
        eServiceId: eService.id,
        descriptorId: eService.descriptors[0].id,
        document: {
          id: mockDocument.documentId,
          name: mockDocument.fileName,
          contentType: mockDocument.contentType,
          prettyName: mockDocument.prettyName,
          path: mockDocument.filePath,
          checksum: mockDocument.checksum,
          uploadDate: (event.event.data as { document: { uploadDate: Date } })
            .document.uploadDate,
        },
        isInterface: mockDocument.kind === "INTERFACE",
        serverUrls: mockDocument.serverUrls,
      });
    });

    it("returns an error if the eservice doesn't contains the descriptor", async () => {
      const descriptorId = "descriptor-not-present-id";
      expect(() =>
        uploadDocumentLogic({
          eServiceId: mockEservice.id,
          descriptorId,
          document: mockDocument,
          authData,
          eService: addMetadata(mockEservice),
        })
      ).toThrowError(eServiceDescriptorNotFound(mockEservice.id, descriptorId));
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      expect(() =>
        uploadDocumentLogic({
          eServiceId: mockEservice.id,
          descriptorId: mockEservice.descriptors[0].id,
          document: mockDocument,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
        })
      ).toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      expect(() =>
        uploadDocumentLogic({
          eServiceId,
          descriptorId: mockEservice.descriptors[0].id,
          document: mockDocument,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          eService: undefined,
        })
      ).toThrowError(eServiceNotFound(eServiceId));
    });
  });
  describe("deleteDocument", () => {
    it("delete the document", async () => {
      const event = await deleteDocumentLogic({
        eServiceId: mockEservice.id,
        descriptorId: mockEservice.descriptors[0].id,
        documentId: mockDocument.documentId,
        authData,
        eService: addMetadata({
          ...mockEservice,
          descriptors: [
            {
              ...mockEservice.descriptors[0],
              docs: [
                {
                  path: mockDocument.filePath,
                  id: mockDocument.documentId,
                  name: mockDocument.fileName,
                  contentType: mockDocument.contentType,
                  prettyName: mockDocument.prettyName,
                  checksum: mockDocument.checksum,
                  uploadDate: new Date(),
                },
              ],
            },
          ],
        }),
        deleteRemoteFile: () => Promise.resolve(),
      });
      expect(event.event.type).toBe("EServiceDocumentDeleted");
      expect(event.event.data).toMatchObject({
        eServiceId: mockEservice.id,
        descriptorId: mockEservice.descriptors[0].id,
        documentId: mockDocument.documentId,
      });
    });

    it("returns an error if the eservice doesn't contains the document", async () => {
      const documentId = "document-not-present-id";
      await expect(() =>
        deleteDocumentLogic({
          eServiceId: mockEservice.id,
          descriptorId: mockEservice.descriptors[0].id,
          documentId,
          authData,
          eService: addMetadata(mockEservice),
          deleteRemoteFile: () => Promise.resolve(),
        })
      ).rejects.toThrowError(
        eServiceDocumentNotFound(
          mockEservice.id,
          mockEservice.descriptors[0].id,
          documentId
        )
      );
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      await expect(() =>
        deleteDocumentLogic({
          eServiceId: mockEservice.id,
          descriptorId: mockEservice.descriptors[0].id,
          documentId: mockDocument.documentId,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
          deleteRemoteFile: () => Promise.resolve(),
        })
      ).rejects.toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      await expect(() =>
        deleteDocumentLogic({
          eServiceId,
          descriptorId: mockEservice.descriptors[0].id,
          documentId: mockDocument.documentId,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          eService: undefined,
          deleteRemoteFile: () => Promise.resolve(),
        })
      ).rejects.toThrowError(eServiceNotFound(eServiceId));
    });
  });
  describe("updateDocument", () => {
    it("update the document", async () => {
      const refDate = new Date();
      const event = await updateDocumentLogic({
        eServiceId: mockEservice.id,
        descriptorId: mockEservice.descriptors[0].id,
        documentId: mockDocument.documentId,
        apiEServiceDescriptorDocumentUpdateSeed: mockUpdateDocumentSeed,
        authData,
        eService: addMetadata({
          ...mockEservice,
          descriptors: [
            {
              ...mockEservice.descriptors[0],
              docs: [
                {
                  path: mockDocument.filePath,
                  id: mockDocument.documentId,
                  name: mockDocument.fileName,
                  contentType: mockDocument.contentType,
                  prettyName: mockDocument.prettyName,
                  checksum: mockDocument.checksum,
                  uploadDate: refDate,
                },
              ],
            },
          ],
        }),
      });
      expect(event.event.type).toBe("EServiceDocumentUpdated");
      expect(event.event.data).toMatchObject({
        eServiceId: mockEservice.id,
        descriptorId: mockEservice.descriptors[0].id,
        documentId: mockDocument.documentId,
        updatedDocument: {
          id: mockDocument.documentId,
          name: mockDocument.fileName,
          contentType: mockDocument.contentType,
          prettyName: mockUpdateDocumentSeed.prettyName,
          path: mockDocument.filePath,
          checksum: mockDocument.checksum,
          uploadDate: refDate.toISOString(),
        },
        serverUrls: mockEservice.descriptors[0].serverUrls,
      });
    });

    it("returns an error if the eservice doesn't contains the descriptor", async () => {
      const descriptorId = "descriptor-not-present-id";
      await expect(() =>
        updateDocumentLogic({
          eServiceId: mockEservice.id,
          descriptorId,
          documentId: mockDocument.documentId,
          apiEServiceDescriptorDocumentUpdateSeed: mockUpdateDocumentSeed,
          authData,
          eService: addMetadata(mockEservice),
        })
      ).rejects.toThrowError(
        eServiceDescriptorNotFound(mockEservice.id, descriptorId)
      );
    });

    it("returns an error if the eservice doesn't contains the document", async () => {
      const documentId = "document-not-present-id";
      await expect(() =>
        updateDocumentLogic({
          eServiceId: mockEservice.id,
          descriptorId: mockEservice.descriptors[0].id,
          documentId,
          apiEServiceDescriptorDocumentUpdateSeed: mockUpdateDocumentSeed,
          authData,
          eService: addMetadata(mockEservice),
        })
      ).rejects.toThrowError(
        eServiceDocumentNotFound(
          mockEservice.id,
          mockEservice.descriptors[0].id,
          documentId
        )
      );
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      await expect(() =>
        updateDocumentLogic({
          eServiceId: mockEservice.id,
          descriptorId: mockEservice.descriptors[0].id,
          documentId: mockDocument.documentId,
          apiEServiceDescriptorDocumentUpdateSeed: mockUpdateDocumentSeed,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
        })
      ).rejects.toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      await expect(() =>
        updateDocumentLogic({
          eServiceId,
          descriptorId: mockEservice.descriptors[0].id,
          documentId: mockDocument.documentId,
          apiEServiceDescriptorDocumentUpdateSeed: mockUpdateDocumentSeed,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          eService: undefined,
        })
      ).rejects.toThrowError(eServiceNotFound(eServiceId));
    });
  });
  describe("createDescriptor", () => {
    it("create the descriptor", async () => {
      const descriptors = shuffle(
        mockEservice.descriptors.map((d, i) => ({
          ...d,
          state: descriptorState.archived,
          version: (i + 1).toString(),
        }))
      );
      const event = createDescriptorLogic({
        eServiceId: mockEservice.id,
        eserviceDescriptorSeed: mockEserviceDescriptorSeed,
        authData,
        eService: addMetadata({ ...mockEservice, descriptors }),
      });
      expect(event.event.type).toBe("EServiceDescriptorAdded");
      expect(event.event.data).toMatchObject({
        eServiceId: mockEservice.id,
        eServiceDescriptor: {
          id: (event.event.data as { eServiceDescriptor: { id: string } })
            .eServiceDescriptor.id,
          description: mockEserviceDescriptorSeed.description,
          version: descriptors.length.toString(),
          interface: undefined,
          docs: [],
          state: toEServiceDescriptorStateV1("Draft"),
          voucherLifespan: mockEserviceDescriptorSeed.voucherLifespan,
          audience: mockEserviceDescriptorSeed.audience,
          dailyCallsPerConsumer:
            mockEserviceDescriptorSeed.dailyCallsPerConsumer,
          dailyCallsTotal: mockEserviceDescriptorSeed.dailyCallsTotal,
          agreementApprovalPolicy: toAgreementApprovalPolicyV1(
            apiAgreementApprovalPolicyToAgreementApprovalPolicy(
              mockEserviceDescriptorSeed.agreementApprovalPolicy
            )
          ),
          serverUrls: [],
          publishedAt: undefined,
          suspendedAt: undefined,
          deprecatedAt: undefined,
          archivedAt: undefined,
          createdAt: (
            event.event.data as { eServiceDescriptor: { createdAt: Date } }
          ).eServiceDescriptor.createdAt,
          attributes: {
            certified: mockEserviceDescriptorSeed.attributes.certified.map(
              toEServiceAttributeV1
            ),
            declared: [],
            verified: [],
          },
        },
      });
    });

    it("returns an error if the eservice doesn't contains a draft descriptor", async () => {
      expect(() =>
        createDescriptorLogic({
          eServiceId: mockEservice.id,
          eserviceDescriptorSeed: mockEserviceDescriptorSeed,
          authData,
          eService: addMetadata({
            ...mockEservice,
            descriptors: [{ ...mockDescriptor, state: "Draft" }],
          }),
        })
      ).toThrowError(draftDescriptorAlreadyExists(mockEservice.id));
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      expect(() =>
        createDescriptorLogic({
          eServiceId: mockEservice.id,
          eserviceDescriptorSeed: mockEserviceDescriptorSeed,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
        })
      ).toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      expect(() =>
        createDescriptorLogic({
          eServiceId,
          eserviceDescriptorSeed: mockEserviceDescriptorSeed,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          eService: undefined,
        })
      ).toThrowError(eServiceNotFound(eServiceId));
    });
  });
  describe("deleteDraftDescriptor", () => {
    it("update the descriptor", async () => {
      const eService: EService = {
        ...mockEservice,
        descriptors: [{ ...mockDescriptor, state: "Draft" }],
      };
      const event = await deleteDraftDescriptorLogic({
        eServiceId: eService.id,
        descriptorId: eService.descriptors[0].id,
        authData,
        deleteFile: () => Promise.resolve(),
        eService: addMetadata(eService),
      });
      expect(event.event.type).toBe("EServiceWithDescriptorsDeleted");
      expect(event.event.data).toMatchObject({
        eService: toEServiceV1(eService),
        descriptorId: eService.descriptors[0].id,
      });
    });

    it("returns an error if the eservice doesn't contains the descriptor", async () => {
      const descriptorId = "descriptor-not-present-id";
      await expect(() =>
        deleteDraftDescriptorLogic({
          eServiceId: mockEservice.id,
          descriptorId,
          authData,
          deleteFile: () => Promise.resolve(),
          eService: addMetadata(mockEservice),
        })
      ).rejects.toThrowError(
        eServiceDescriptorNotFound(mockEservice.id, descriptorId)
      );
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      await expect(() =>
        deleteDraftDescriptorLogic({
          eServiceId: mockEservice.id,
          descriptorId: mockEservice.descriptors[0].id,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          deleteFile: () => Promise.resolve(),
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
        })
      ).rejects.toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      await expect(() =>
        deleteDraftDescriptorLogic({
          eServiceId,
          descriptorId: mockEservice.descriptors[0].id,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          deleteFile: () => Promise.resolve(),
          eService: undefined,
        })
      ).rejects.toThrowError(eServiceNotFound(eServiceId));
    });
  });
  describe("updateDescriptor", () => {
    it("update the descriptor", async () => {
      const descriptor: Descriptor = { ...mockDescriptor, state: "Draft" };
      const eService: EService = {
        ...mockEservice,
        descriptors: [descriptor],
      };
      const event = updateDescriptorLogic({
        eServiceId: eService.id,
        descriptorId: eService.descriptors[0].id,
        seed: mockUpdateDescriptorSeed,
        authData,
        eService: addMetadata(eService),
      });
      expect(event.event.type).toBe("EServiceUpdated");
      expect(event.event.data).toMatchObject({
        eService: {
          ...toEServiceV1(eService),
          descriptors: [
            {
              ...toDescriptorV1(descriptor),
              description: mockUpdateDescriptorSeed.description,
              audience: mockUpdateDescriptorSeed.audience,
              voucherLifespan: mockUpdateDescriptorSeed.voucherLifespan,
              dailyCallsPerConsumer:
                mockUpdateDescriptorSeed.dailyCallsPerConsumer,
              state: toEServiceDescriptorStateV1("Draft"),
              dailyCallsTotal: mockUpdateDescriptorSeed.dailyCallsTotal,
              agreementApprovalPolicy: toAgreementApprovalPolicyV1(
                apiAgreementApprovalPolicyToAgreementApprovalPolicy(
                  mockUpdateDescriptorSeed.agreementApprovalPolicy
                )
              ),
            },
          ],
        },
      });
    });

    it("returns an error if the eservice doesn't contains the descriptor", async () => {
      const descriptor: Descriptor = { ...mockDescriptor, state: "Draft" };
      const eService: EService = {
        ...mockEservice,
        descriptors: [descriptor],
      };
      const descriptorId = "descriptor-not-present-id";
      expect(() =>
        updateDescriptorLogic({
          eServiceId: eService.id,
          descriptorId,
          seed: mockEserviceDescriptorSeed,
          authData,
          eService: addMetadata(eService),
        })
      ).toThrowError(eServiceDescriptorNotFound(eService.id, descriptorId));
    });

    it("returns an error if the eservice updated descriptor is not in a Draft state", async () => {
      const descriptor: Descriptor = { ...mockDescriptor, state: "Published" };
      const eService: EService = {
        ...mockEservice,
        descriptors: [descriptor],
      };
      expect(() =>
        updateDescriptorLogic({
          eServiceId: eService.id,
          descriptorId: eService.descriptors[0].id,
          seed: mockEserviceDescriptorSeed,
          authData,
          eService: addMetadata(eService),
        })
      ).toThrowError(
        notValidDescriptor(eService.descriptors[0].id, "Published")
      );
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      expect(() =>
        updateDescriptorLogic({
          eServiceId: mockEservice.id,
          descriptorId: mockEservice.descriptors[0].id,
          seed: mockEserviceDescriptorSeed,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
        })
      ).toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      expect(() =>
        updateDescriptorLogic({
          eServiceId,
          descriptorId: mockEservice.descriptors[0].id,
          seed: mockEserviceDescriptorSeed,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          eService: undefined,
        })
      ).toThrowError(eServiceNotFound(eServiceId));
    });
  });
  describe("publishDescriptor", () => {
    it("publish the descriptor", async () => {
      const eService: EService = {
        ...mockEservice,
        descriptors: [{ ...mockDescriptor, state: "Draft" }],
      };
      const event = publishDescriptorLogic({
        eServiceId: eService.id,
        descriptorId: eService.descriptors[0].id,
        authData,
        eService: addMetadata(eService),
      });
      expect(event[0].event.type).toBe("EServiceDescriptorUpdated");
      expect(event[0].event.data).toMatchObject({
        eServiceId: eService.id,
        eServiceDescriptor: {
          ...toDescriptorV1(mockDescriptor),
          publishedAt: (
            event[0].event.data as { eServiceDescriptor: { publishedAt: Date } }
          ).eServiceDescriptor.publishedAt,
          state: toEServiceDescriptorStateV1("Published"),
        },
      });
    });

    it("publish the descriptor and deprecate the current published descriptor", async () => {
      const publishedDescriptorId = "published-descriptor-id";
      const eService: EService = {
        ...mockEservice,
        descriptors: [
          {
            ...mockDescriptor,
            id: publishedDescriptorId,
            state: "Published",
          },
          { ...mockDescriptor, state: "Draft" },
        ],
      };
      const event = publishDescriptorLogic({
        eServiceId: eService.id,
        descriptorId: eService.descriptors[1].id,
        authData,
        eService: addMetadata(eService),
      });
      expect(event[0].event.type).toBe("EServiceDescriptorUpdated");
      expect(event[0].event.data).toMatchObject({
        eServiceId: eService.id,
        eServiceDescriptor: {
          ...toDescriptorV1(mockDescriptor),
          id: publishedDescriptorId,
          deprecatedAt: (
            event[0].event.data as {
              eServiceDescriptor: { deprecatedAt: Date };
            }
          ).eServiceDescriptor.deprecatedAt,
          state: toEServiceDescriptorStateV1("Deprecated"),
        },
      });
      expect(event[1].event.type).toBe("EServiceDescriptorUpdated");
      expect(event[1].event.data).toMatchObject({
        eServiceId: eService.id,
        eServiceDescriptor: {
          ...toDescriptorV1(mockDescriptor),
          publishedAt: (
            event[1].event.data as { eServiceDescriptor: { publishedAt: Date } }
          ).eServiceDescriptor.publishedAt,
          state: toEServiceDescriptorStateV1("Published"),
        },
      });
    });

    it("returns an error if the eservice doesn't contains the descriptor", async () => {
      const descriptorId = "descriptor-not-present-id";
      expect(() =>
        publishDescriptorLogic({
          eServiceId: mockEservice.id,
          descriptorId,
          authData,
          eService: addMetadata(mockEservice),
        })
      ).toThrowError(eServiceDescriptorNotFound(mockEservice.id, descriptorId));
    });

    it("returns an error if the eservice target descriptor is not in a Draft state", async () => {
      const descriptor: Descriptor = { ...mockDescriptor, state: "Published" };
      const eService: EService = {
        ...mockEservice,
        descriptors: [descriptor],
      };
      expect(() =>
        publishDescriptorLogic({
          eServiceId: eService.id,
          descriptorId: eService.descriptors[0].id,
          authData,
          eService: addMetadata(eService),
        })
      ).toThrowError(
        notValidDescriptor(eService.descriptors[0].id, "Published")
      );
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      expect(() =>
        publishDescriptorLogic({
          eServiceId: mockEservice.id,
          descriptorId: mockEservice.descriptors[0].id,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
        })
      ).toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      expect(() =>
        publishDescriptorLogic({
          eServiceId,
          descriptorId: mockEservice.descriptors[0].id,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          eService: undefined,
        })
      ).toThrowError(eServiceNotFound(eServiceId));
    });
  });
  describe("suspendDescriptor", () => {
    it("suspend the descriptor", async () => {
      const publishedDescriptor: Descriptor = {
        ...mockDescriptor,
        state: "Published",
      };
      const deprecatedDescriptor: Descriptor = {
        ...mockDescriptor,
        state: "Deprecated",
      };
      const eService: EService = {
        ...mockEservice,
        descriptors: [publishedDescriptor, deprecatedDescriptor],
      };
      const event1 = suspendDescriptorLogic({
        eServiceId: eService.id,
        descriptorId: eService.descriptors[0].id,
        authData,
        eService: addMetadata(eService),
      });
      const event2 = suspendDescriptorLogic({
        eServiceId: eService.id,
        descriptorId: eService.descriptors[1].id,
        authData,
        eService: addMetadata(eService),
      });
      expect(event1.event.type).toBe("EServiceDescriptorUpdated");
      expect(event1.event.data).toMatchObject({
        eServiceId: eService.id,
        eServiceDescriptor: {
          ...toDescriptorV1(publishedDescriptor),
          state: toEServiceDescriptorStateV1("Suspended"),
          suspendedAt: (
            event1.event.data as { eServiceDescriptor: { suspendedAt: Date } }
          ).eServiceDescriptor.suspendedAt,
        },
      });
      expect(event2.event.type).toBe("EServiceDescriptorUpdated");
      expect(event2.event.data).toMatchObject({
        eServiceId: eService.id,
        eServiceDescriptor: {
          ...toDescriptorV1(deprecatedDescriptor),
          state: toEServiceDescriptorStateV1("Suspended"),
          suspendedAt: (
            event2.event.data as { eServiceDescriptor: { suspendedAt: Date } }
          ).eServiceDescriptor.suspendedAt,
        },
      });
    });

    it("returns an error if the eservice doesn't contains the descriptor", async () => {
      const descriptor: Descriptor = { ...mockDescriptor, state: "Published" };
      const eService: EService = {
        ...mockEservice,
        descriptors: [descriptor],
      };
      const descriptorId = "descriptor-not-present-id";
      expect(() =>
        suspendDescriptorLogic({
          eServiceId: eService.id,
          descriptorId,
          authData,
          eService: addMetadata(eService),
        })
      ).toThrowError(eServiceDescriptorNotFound(eService.id, descriptorId));
    });

    it("returns an error if the eservice suspended descriptor is not in a Published or Deprecated state", async () => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: "Draft",
      };
      const eService: EService = {
        ...mockEservice,
        descriptors: [descriptor],
      };
      expect(() =>
        suspendDescriptorLogic({
          eServiceId: eService.id,
          descriptorId: eService.descriptors[0].id,
          authData,
          eService: addMetadata(eService),
        })
      ).toThrowError(notValidDescriptor(eService.descriptors[0].id, "Draft"));
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      expect(() =>
        suspendDescriptorLogic({
          eServiceId: mockEservice.id,
          descriptorId: mockEservice.descriptors[0].id,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
        })
      ).toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      expect(() =>
        suspendDescriptorLogic({
          eServiceId,
          descriptorId: mockEservice.descriptors[0].id,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          eService: undefined,
        })
      ).toThrowError(eServiceNotFound(eServiceId));
    });
  });
  describe("activateDescriptor", () => {
    it("activate the descriptor", async () => {
      const eService: EService = {
        ...mockEservice,
        descriptors: [{ ...mockDescriptor, state: "Suspended", version: "1" }],
      };
      const event = activateDescriptorLogic({
        eServiceId: eService.id,
        descriptorId: eService.descriptors[0].id,
        authData,
        eService: addMetadata(eService),
      });
      expect(event.event.type).toBe("EServiceDescriptorUpdated");
      expect(event.event.data).toMatchObject({
        eServiceId: eService.id,
        eServiceDescriptor: {
          ...toDescriptorV1(mockDescriptor),
          state: toEServiceDescriptorStateV1("Published"),
          version: "1",
          suspendedAt: (
            event.event.data as { eServiceDescriptor: { suspendedAt: Date } }
          ).eServiceDescriptor.suspendedAt,
        },
      });
    });

    it("returns an error if the descriptor is not in a Suspended state", async () => {
      const descriptor: Descriptor = {
        ...mockDescriptor,
        state: "Draft",
      };
      const eService: EService = {
        ...mockEservice,
        descriptors: [descriptor],
      };
      expect(() =>
        activateDescriptorLogic({
          eServiceId: eService.id,
          descriptorId: eService.descriptors[0].id,
          authData,
          eService: addMetadata(eService),
        })
      ).toThrowError(notValidDescriptor(eService.descriptors[0].id, "Draft"));
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      expect(() =>
        activateDescriptorLogic({
          eServiceId: mockEservice.id,
          descriptorId: mockEservice.descriptors[0].id,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
        })
      ).toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      expect(() =>
        activateDescriptorLogic({
          eServiceId,
          descriptorId: mockEservice.descriptors[0].id,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          eService: undefined,
        })
      ).toThrowError(eServiceNotFound(eServiceId));
    });
  });
  describe("cloneDescriptor", () => {
    it("clone the eService", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());

      const eService: EService = {
        ...mockEservice,
        descriptors: [{ ...mockDescriptor, version: "1" }],
      };
      const mockEserviceV1 = toEServiceV1(mockEservice);
      const mockDescriptorV1 = toDescriptorV1(mockDescriptor);
      const { event } = await cloneDescriptorLogic({
        eServiceId: eService.id,
        descriptorId: eService.descriptors[0].id,
        authData,
        copyFile: () => Promise.resolve(""),
        eService: addMetadata(eService),
        getEServiceByNameAndProducerId: () => Promise.resolve(undefined),
      });
      expect(event.event.type).toBe("ClonedEServiceAdded");
      const clonedDescriptor = (
        event.event.data as { eService: { descriptors: unknown[] } }
      ).eService.descriptors[0] as {
        id: string;
        docs: Array<{ id: string; uploadDate: Date }>;
        createdAt: Date;
        interface: { id: string; uploadDate: Date };
      };
      const currentDate = new Date();
      expect(event.event.data).toMatchObject({
        eService: {
          ...mockEserviceV1,
          name: `${
            mockEserviceV1.name
          } - clone - ${currentDate.toLocaleDateString(
            "it-IT"
          )} ${currentDate.toLocaleTimeString("it-IT")}`,
          createdAt: (
            event.event.data as unknown as { eService: { createdAt: Date } }
          ).eService.createdAt,
          id: (event.event.data as { eService: { id: string } }).eService.id,
          descriptors: [
            {
              ...mockDescriptorV1,
              id: clonedDescriptor.id,
              version: "1",
              state: toEServiceDescriptorStateV1("Draft"),
              createdAt: clonedDescriptor.createdAt,
              docs: mockDescriptorV1.docs.map((d, i) => ({
                ...d,
                id: clonedDescriptor.docs[i].id,
                path: "",
                uploadDate: clonedDescriptor.docs[i].uploadDate,
              })),
              interface: {
                ...mockDescriptorV1.docs[0],
                id: clonedDescriptor.interface.id,
                path: "",
                uploadDate: clonedDescriptor.interface.uploadDate,
              },
              publishedAt: undefined,
              suspendedAt: undefined,
              deprecatedAt: undefined,
              archivedAt: undefined,
            },
          ],
        },
      });
      vi.useRealTimers();
    });

    it("returns an error if the eservice doesn't contains the descriptor", async () => {
      const eService: EService = {
        ...mockEservice,
        descriptors: [mockDescriptor],
      };
      const descriptorId = "descriptor-not-present-id";
      expect(() =>
        archiveDescriptorLogic({
          eServiceId: eService.id,
          descriptorId,
          authData,
          eService: addMetadata(eService),
        })
      ).toThrowError(eServiceDescriptorNotFound(eService.id, descriptorId));
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      expect(() =>
        suspendDescriptorLogic({
          eServiceId: mockEservice.id,
          descriptorId: mockEservice.descriptors[0].id,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
        })
      ).toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      expect(() =>
        suspendDescriptorLogic({
          eServiceId,
          descriptorId: mockEservice.descriptors[0].id,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          eService: undefined,
        })
      ).toThrowError(eServiceNotFound(eServiceId));
    });
  });
  describe("archiveDescriptor", () => {
    it("archive the descriptor", async () => {
      const eService: EService = {
        ...mockEservice,
        descriptors: [mockDescriptor],
      };
      const event = archiveDescriptorLogic({
        eServiceId: eService.id,
        descriptorId: eService.descriptors[0].id,
        authData,
        eService: addMetadata(eService),
      });
      expect(event.event.type).toBe("EServiceDescriptorUpdated");
      expect(event.event.data).toMatchObject({
        eServiceId: eService.id,
        eServiceDescriptor: {
          ...toDescriptorV1(mockDescriptor),
          state: toEServiceDescriptorStateV1("Archived"),
          archivedAt: (
            event.event.data as { eServiceDescriptor: { archivedAt: Date } }
          ).eServiceDescriptor.archivedAt,
          suspendedAt: (
            event.event.data as { eServiceDescriptor: { suspendedAt: Date } }
          ).eServiceDescriptor.suspendedAt,
        },
      });
    });

    it("returns an error if the eservice doesn't contains the descriptor", async () => {
      const eService: EService = {
        ...mockEservice,
        descriptors: [mockDescriptor],
      };
      const descriptorId = "descriptor-not-present-id";
      expect(() =>
        archiveDescriptorLogic({
          eServiceId: eService.id,
          descriptorId,
          authData,
          eService: addMetadata(eService),
        })
      ).toThrowError(eServiceDescriptorNotFound(eService.id, descriptorId));
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      expect(() =>
        suspendDescriptorLogic({
          eServiceId: mockEservice.id,
          descriptorId: mockEservice.descriptors[0].id,
          authData: {
            ...authData,
            organizationId: "other-org-id",
          },
          eService: addMetadata({
            ...mockEservice,
            producerId: "some-org-id",
          }),
        })
      ).toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      const eServiceId = "not-existing-id";
      expect(() =>
        suspendDescriptorLogic({
          eServiceId,
          descriptorId: mockEservice.descriptors[0].id,
          authData: {
            ...authData,
            organizationId: "organizationId",
          },
          eService: undefined,
        })
      ).toThrowError(eServiceNotFound(eServiceId));
    });
  });
});
