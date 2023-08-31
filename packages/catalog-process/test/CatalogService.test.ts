import { describe, expect, it, vi } from "vitest";
import { generateMock } from "@anatine/zod-mock";
import * as z from "zod";
import { catalogService } from "../src/services/CatalogService.js";
import {
  eServiceCannotBeUpdated,
  eServiceNotFound,
  operationForbidden,
} from "../src/model/domain/errors.js";
import { readModelGateway } from "../src/services/ReadModelGateway.js";
import { eventRepository } from "../src/repositories/events.js";
import * as api from "../src/model/generated/api.js";
import { EService } from "../src/model/domain/models.js";

const mockEservice: EService = {
  ...generateMock(api.schemas.EService.extend({ version: z.number() })),
  descriptors: [],
};
const mockDescriptor = generateMock(api.schemas.EServiceDescriptor);

vi.mock("../src/services/ReadModelGateway.js");
const mockedReadModelGateway = vi.mocked(readModelGateway);

vi.mock("../src/repositories/events.js");
const mockedEventRepository = vi.mocked(eventRepository);

describe("CatalogService", () => {
  describe("updateEService", () => {
    it("updates the eservice", async () => {
      mockedReadModelGateway.getEServiceById.mockResolvedValueOnce(
        mockEservice
      );

      mockedEventRepository.createEvent.mockResolvedValueOnce(mockEservice.id);

      await expect(
        catalogService.updateEService(mockEservice.id, mockEservice, {
          organizationId: mockEservice.producerId,
        })
      ).resolves.toBeUndefined();
      expect(mockedEventRepository.createEvent).toHaveBeenCalledOnce();
      expect(
        mockedEventRepository.createEvent.mock.lastCall?.[0].data
      ).toMatchObject(mockEservice);
    });

    it("returns an error if the eservice contains valid descriptors", async () => {
      mockedReadModelGateway.getEServiceById.mockResolvedValueOnce({
        ...mockEservice,
        descriptors: [{ ...mockDescriptor, state: "ARCHIVED" }],
      });

      await expect(
        catalogService.updateEService(mockEservice.id, mockEservice, {
          organizationId: mockEservice.producerId,
        })
      ).rejects.toThrowError(eServiceCannotBeUpdated(mockEservice.id));
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      mockedReadModelGateway.getEServiceById.mockResolvedValueOnce({
        ...mockEservice,
        producerId: "some-org-id",
      });

      await expect(
        catalogService.updateEService(mockEservice.id, mockEservice, {
          organizationId: "other-org-id",
        })
      ).rejects.toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      mockedReadModelGateway.getEServiceById.mockResolvedValueOnce(undefined);

      await expect(
        catalogService.updateEService("not-existing-id", mockEservice, {
          organizationId: "organizationId",
        })
      ).rejects.toThrowError(eServiceNotFound("not-existing-id"));
    });
  });
});
