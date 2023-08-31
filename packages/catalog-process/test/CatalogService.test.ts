import { describe, expect, it, vi } from "vitest";
import { catalogService } from "../src/services/CatalogService.js";
import {
  eServiceCannotBeUpdated,
  eServiceNotFound,
  operationForbidden,
} from "../src/model/domain/errors.js";
import { EService } from "../src/model/domain/models.js";
import { readModelGateway } from "../src/services/ReadModelGateway.js";

const mockEservice: EService = {
  id: "5b041dd3-6b06-4467-9c3d-1ef11acedb88",
  name: "name",
  description: "description",
  technology: "REST",
  descriptors: [],
  producerId: "producerId",
  version: 1,
};

describe("CatalogService", () => {
  describe("updateEService", () => {
    it("returns an error if the eservice contains valid descriptors", async () => {
      readModelGateway.getEServiceById = vi.fn().mockReturnValueOnce({
        ...mockEservice,
        descriptors: [{ state: "ARCHIVED" }],
      });

      await expect(() =>
        catalogService.updateEService(mockEservice.id, mockEservice, {
          organizationId: mockEservice.producerId,
        })
      ).rejects.toThrowError(eServiceCannotBeUpdated(mockEservice.id));
    });
    it("returns an error if the authenticated organization is not the producer", async () => {
      readModelGateway.getEServiceById = vi
        .fn()
        .mockReturnValueOnce({ mockEservice, producerId: "some-org-id" });

      await expect(() =>
        catalogService.updateEService(mockEservice.id, mockEservice, {
          organizationId: "other-org-id",
        })
      ).rejects.toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      readModelGateway.getEServiceById = vi.fn().mockReturnValueOnce(undefined);

      await expect(() =>
        catalogService.updateEService("not-existing-id", mockEservice, {
          organizationId: "organizationId",
        })
      ).rejects.toThrowError(eServiceNotFound("not-existing-id"));
    });
  });
});
