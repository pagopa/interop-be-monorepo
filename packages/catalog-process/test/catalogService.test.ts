import { describe, expect, it } from "vitest";
import { generateMock } from "@anatine/zod-mock";
import { Descriptor, EService } from "pagopa-interop-models";
import { updateEserviceLogic } from "../src/services/catalogService.js";
import {
  eServiceCannotBeUpdated,
  operationForbidden,
} from "../src/model/domain/errors.js";
import * as api from "../src/model/generated/api.js";
import { WithMetadata } from "../src/model/domain/models.js";

const mockEservice: EService = generateMock(EService);
const mockEserviceSeed = generateMock(api.schemas.EServiceSeed);
const mockDescriptor = generateMock(Descriptor);

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
  describe("updateEService", () => {
    it("updates the eservice", async () => {
      const event = updateEserviceLogic({
        eService: addMetadata(mockEservice),
        eServiceId: mockEservice.id,
        eServiceSeed: mockEserviceSeed,
        authData,
      });
      expect(event.event.type).toBe("EServiceUpdated");
      expect(event.event.data).toMatchObject(mockEservice);
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

    // it("returns an error when the service does not exist", async () => {
    //   expect(() =>
    //     updateEserviceLogic({
    //       eService: undefined,
    //       eServiceId: "not-existing-id",
    //       eserviceSeed: mockEservice,
    //       authData: {
    //         ...authData,
    //         organizationId: "organizationId",
    //       },
    //     })
    //   ).toThrowError(eServiceNotFound("not-existing-id"));
    // });
  });
});
