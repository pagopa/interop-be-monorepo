import { describe, expect, it } from "vitest";
import { generateMock } from "@anatine/zod-mock";
import * as z from "zod";
import { updateEserviceLogic } from "../src/services/CatalogService.js";
import {
  eServiceCannotBeUpdated,
  eServiceNotFound,
  operationForbidden,
} from "../src/model/domain/errors.js";
import * as api from "../src/model/generated/api.js";
import { EService } from "../src/model/domain/models.js";

const mockEservice: EService = {
  ...generateMock(api.schemas.EService.extend({ version: z.number() })),
  descriptors: [],
};
const mockDescriptor = generateMock(api.schemas.EServiceDescriptor);

describe("CatalogService", () => {
  describe("updateEService", () => {
    it("updates the eservice", async () => {
      const event = updateEserviceLogic({
        eservice: mockEservice,
        eServiceId: mockEservice.id,
        eserviceSeed: mockEservice,
        authData: {
          organizationId: mockEservice.producerId,
        },
      });
      expect(event.type).toBe("EServiceUpdated");
      expect(event.data).toMatchObject(mockEservice);
    });

    it("returns an error if the eservice contains valid descriptors", async () => {
      expect(() =>
        updateEserviceLogic({
          eservice: {
            ...mockEservice,
            descriptors: [{ ...mockDescriptor, state: "ARCHIVED" }],
          },
          eServiceId: mockEservice.id,
          authData: {
            organizationId: mockEservice.producerId,
          },
          eserviceSeed: mockEservice,
        })
      ).toThrowError(eServiceCannotBeUpdated(mockEservice.id));
    });

    it("returns an error if the authenticated organization is not the producer", async () => {
      expect(() =>
        updateEserviceLogic({
          eservice: {
            ...mockEservice,
            producerId: "some-org-id",
          },
          eServiceId: mockEservice.id,
          eserviceSeed: mockEservice,
          authData: {
            organizationId: "other-org-id",
          },
        })
      ).toThrowError(operationForbidden);
    });

    it("returns an error when the service does not exist", async () => {
      expect(() =>
        updateEserviceLogic({
          eservice: undefined,
          eServiceId: "not-existing-id",
          eserviceSeed: mockEservice,
          authData: {
            organizationId: "organizationId",
          },
        })
      ).toThrowError(eServiceNotFound("not-existing-id"));
    });
  });
});
