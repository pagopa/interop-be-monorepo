import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DescriptorId,
  EServiceId,
  PurposeTemplateId,
  TenantId,
  generateId,
  descriptorState,
} from "pagopa-interop-models";
import {
  unexpectedEServiceError,
  missingExpectedEService,
  unexpectedAssociationEServiceError,
  eserviceAlreadyAssociatedError,
  missingDescriptorError,
  invalidDescriptorStateError,
} from "pagopa-interop-commons";
import {
  getMockEService,
  getMockDescriptor,
} from "pagopa-interop-commons-test";
import {
  associationEServicesForPurposeTemplateFailed,
  associationBetweenEServiceAndPurposeTemplateAlreadyExists,
} from "../../src/model/domain/errors.js";
import { validateEServicesForPurposeTemplate } from "../../src/services/validators.js";
import { ReadModelServiceSQL } from "../../src/services/readModelServiceSQL.js";

describe("Purpose Template Validation", () => {
  const mockReadModelService: ReadModelServiceSQL = {
    getEServiceById: vi.fn(),
    getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId:
      vi.fn(),
  } as unknown as ReadModelServiceSQL;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateEServicesForPurposeTemplate", () => {
    const purposeTemplateId = generateId<PurposeTemplateId>();
    const eserviceId1 = generateId<EServiceId>();
    const eserviceId2 = generateId<EServiceId>();
    const descriptorId1 = generateId<DescriptorId>();
    const descriptorId2 = generateId<DescriptorId>();

    const mockDescriptor1 = getMockDescriptor(descriptorState.published);
    mockDescriptor1.id = descriptorId1;

    const mockDescriptor2 = getMockDescriptor(descriptorState.draft);
    mockDescriptor2.id = descriptorId2;

    const mockEService1 = getMockEService(eserviceId1, generateId<TenantId>(), [
      mockDescriptor1,
    ]);
    const mockEService2 = getMockEService(eserviceId2, generateId<TenantId>(), [
      mockDescriptor2,
    ]);

    it("should return valid result when all validations pass", async () => {
      const eserviceIds = [eserviceId1, eserviceId2];

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValueOnce(mockEService1)
        .mockResolvedValueOnce(mockEService2);

      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockResolvedValue(undefined); // No existing associations

      const result = await validateEServicesForPurposeTemplate(
        eserviceIds,
        purposeTemplateId,
        mockReadModelService
      );

      expect(result).toEqual({
        type: "valid",
        value: [
          { eservice: mockEService1, descriptorId: descriptorId1 },
          { eservice: mockEService2, descriptorId: descriptorId2 },
        ],
      });
    });

    it("should throw associationEServicesForPurposeTemplateFailed when eservice is not found (missingExpectedEService)", async () => {
      const eserviceIds = [eserviceId1];

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(undefined);

      await expect(
        validateEServicesForPurposeTemplate(
          eserviceIds,
          purposeTemplateId,
          mockReadModelService
        )
      ).rejects.toThrow(
        associationEServicesForPurposeTemplateFailed(
          [missingExpectedEService(eserviceId1)],
          eserviceIds,
          purposeTemplateId
        )
      );
    });

    it("should throw associationEServicesForPurposeTemplateFailed when eservice retrieval fails (unexpectedEServiceError)", async () => {
      const eserviceIds = [eserviceId1];
      const errorMessage = "Database connection failed";

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockRejectedValue(new Error(errorMessage));

      await expect(
        validateEServicesForPurposeTemplate(
          eserviceIds,
          purposeTemplateId,
          mockReadModelService
        )
      ).rejects.toThrow(
        associationEServicesForPurposeTemplateFailed(
          [unexpectedEServiceError(errorMessage, eserviceId1)],
          eserviceIds,
          purposeTemplateId
        )
      );
    });

    it("should throw associationBetweenEServiceAndPurposeTemplateAlreadyExists when eservice is already associated (eserviceAlreadyAssociatedError)", async () => {
      const eserviceIds = [eserviceId1];
      const existingAssociation = {
        id: generateId(),
        createdAt: new Date(),
        eserviceId: eserviceId1,
        descriptorId: descriptorId1,
        purposeTemplateId,
      };

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(mockEService1);

      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockResolvedValue(existingAssociation);

      await expect(
        validateEServicesForPurposeTemplate(
          eserviceIds,
          purposeTemplateId,
          mockReadModelService
        )
      ).rejects.toThrow(
        associationBetweenEServiceAndPurposeTemplateAlreadyExists(
          [eserviceAlreadyAssociatedError(eserviceId1, purposeTemplateId)],
          eserviceIds,
          purposeTemplateId
        )
      );
    });

    it("should throw associationBetweenEServiceAndPurposeTemplateAlreadyExists when association check fails (unexpectedAssociationEServiceError)", async () => {
      const eserviceIds = [eserviceId1];
      const errorMessage = "Association check failed";

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(mockEService1);
      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockRejectedValue(new Error(errorMessage));

      await expect(
        validateEServicesForPurposeTemplate(
          eserviceIds,
          purposeTemplateId,
          mockReadModelService
        )
      ).rejects.toThrow(
        associationBetweenEServiceAndPurposeTemplateAlreadyExists(
          [unexpectedAssociationEServiceError(errorMessage, eserviceId1)],
          eserviceIds,
          purposeTemplateId
        )
      );
    });

    it("should return invalid result when eservice has no descriptors (validateEServiceDescriptors)", async () => {
      const eserviceIds = [eserviceId1];
      const eserviceWithoutDescriptors = getMockEService(
        eserviceId1,
        generateId<TenantId>(),
        []
      );

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(eserviceWithoutDescriptors);
      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockResolvedValue(undefined);

      const result = await validateEServicesForPurposeTemplate(
        eserviceIds,
        purposeTemplateId,
        mockReadModelService
      );

      expect(result).toEqual({
        type: "invalid",
        issues: [missingDescriptorError(eserviceId1)],
      });
    });

    it("should return invalid result when eservice has no valid descriptor states (validateEServiceDescriptors)", async () => {
      const eserviceIds = [eserviceId1];
      const invalidDescriptor = getMockDescriptor(descriptorState.suspended);
      invalidDescriptor.id = descriptorId1;
      const eserviceWithInvalidDescriptors = getMockEService(
        eserviceId1,
        generateId<TenantId>(),
        [invalidDescriptor]
      );

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(eserviceWithInvalidDescriptors);
      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockResolvedValue(undefined);

      const result = await validateEServicesForPurposeTemplate(
        eserviceIds,
        purposeTemplateId,
        mockReadModelService
      );

      expect(result).toEqual({
        type: "invalid",
        issues: [
          invalidDescriptorStateError(eserviceId1, ["Published", "Draft"]),
        ],
      });
    });
  });
});
