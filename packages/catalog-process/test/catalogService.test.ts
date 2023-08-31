import { describe, expect, it } from "vitest";
import { generateMock } from "@anatine/zod-mock";
import { Descriptor, EService } from "pagopa-interop-models";
import {
  createEserviceLogic,
  deleteEserviceLogic,
  updateEserviceLogic,
  uploadDocumentLogic,
} from "../src/services/catalogService.js";
import {
  eServiceCannotBeDeleted,
  eServiceCannotBeUpdated,
  eServiceDescriptorNotFound,
  eServiceDuplicate,
  eServiceNotFound,
  operationForbidden,
} from "../src/model/domain/errors.js";
import * as api from "../src/model/generated/api.js";
import { WithMetadata } from "../src/model/domain/models.js";
import { apiTechnologyToTechnology } from "../src/model/domain/apiConverter.js";

const mockEservice: EService = generateMock(EService);
const mockEserviceSeed = generateMock(api.schemas.EServiceSeed);
const mockDescriptor = generateMock(Descriptor);
const mockDocument = generateMock(
  api.schemas.CreateEServiceDescriptorDocumentSeed
);

const authData = {
  organizationId: mockEservice.producerId,
  userId: "userId",
  userRoles: ["ADMIN"],
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
        eServices: { results: [], totalCount: 0 },
        apiEServicesSeed: mockEserviceSeed,
        authData,
      });
      expect(event.event.type).toBe("EServiceAdded");
      expect(event.event.data).toMatchObject({
        eService: {
          ...eService,
          id: event.streamId,
          createdAt: (event.event.data as { eService: { createdAt: Date } })
            .eService.createdAt,
          description: mockEserviceSeed.description,
          name: mockEserviceSeed.name,
          technology: apiTechnologyToTechnology(mockEserviceSeed.technology),
          producerId: authData.organizationId,
        },
      });
    });

    it("returns an error if the eservice list is not empty", async () => {
      expect(() =>
        createEserviceLogic({
          eServices: { results: [mockEservice], totalCount: 1 },
          apiEServicesSeed: mockEserviceSeed,
          authData,
        })
      ).toThrowError(eServiceDuplicate(mockEserviceSeed.name));
    });
  });
  describe("updateEService", () => {
    it("updates the eservice", async () => {
      const eService = { ...mockEservice, descriptors: [] };

      const event = updateEserviceLogic({
        eService: addMetadata(eService),
        eServiceId: mockEservice.id,
        eServiceSeed: mockEserviceSeed,
        authData,
      });
      expect(event.event.type).toBe("EServiceUpdated");
      expect(event.event.data).toMatchObject({
        eService: {
          ...eService,
          description: mockEserviceSeed.description,
          name: mockEserviceSeed.name,
          technology: apiTechnologyToTechnology(mockEserviceSeed.technology),
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
        })
      ).toThrowError(eServiceCannotBeUpdated(mockEservice.id));
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
        })
      ).toThrowError(operationForbidden);
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
        })
      ).toThrowError(eServiceNotFound(eServiceId));
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
      const event = uploadDocumentLogic({
        eServiceId: mockEservice.id,
        descriptorId: mockEservice.descriptors[0].id,
        document: mockDocument,
        authData,
        eService: addMetadata(mockEservice),
      });
      expect(event.event.type).toBe("EServiceDocumentAdded");
      expect(event.event.data).toMatchObject({
        eServiceId: mockEservice.id,
        descriptorId: mockEservice.descriptors[0].id,
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
});
