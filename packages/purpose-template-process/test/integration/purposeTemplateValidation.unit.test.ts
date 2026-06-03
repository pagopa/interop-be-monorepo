import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DescriptorId,
  EServiceId,
  EServiceTemplate,
  EServiceTemplateId,
  TenantId,
  generateId,
  descriptorState,
  PurposeTemplate,
  EService,
} from "pagopa-interop-models";
import {
  getMockEService,
  getMockDescriptor,
  getMockEServiceTemplate,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  associationEServicesForPurposeTemplateFailed,
  associationBetweenEServiceAndPurposeTemplateAlreadyExists,
  associationBetweenEServiceAndPurposeTemplateDoesNotExist,
} from "../../src/model/domain/errors.js";
import { ReadModelServiceSQL } from "../../src/services/readModelServiceSQL.js";
import {
  eserviceAlreadyAssociatedError,
  eserviceNotAssociatedError,
  eserviceNotFound,
  invalidDescriptorStateError,
  missingDescriptorError,
  purposeTemplateEServicePersonalDataFlagMismatch,
} from "../../src/errors/purposeTemplateValidationErrors.js";
import {
  ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_ASSOCIATION,
  ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_DISASSOCIATION,
  validateEservicesAssociations,
  validateEservicesDisassociations,
  validateEServiceTemplatesAssociations,
  validateEServiceTemplatesDisassociations,
} from "../../src/services/validators.js";

describe("Purpose Template Validation", () => {
  const mockReadModelService: ReadModelServiceSQL = {
    getEServiceById: vi.fn(),
    getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId:
      vi.fn(),
    getEServiceTemplateById: vi.fn(),
    getEServiceTemplateVersionPurposeTemplateByPurposeTemplateIdAndEServiceTemplateId:
      vi.fn(),
  } as unknown as ReadModelServiceSQL;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateEServicesForPurposeTemplate", () => {
    const purposeTemplate: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      handlesPersonalData: true,
    };
    const eserviceId1 = generateId<EServiceId>();
    const descriptorId1 = generateId<DescriptorId>();

    const mockDescriptor1 = getMockDescriptor(descriptorState.published);
    mockDescriptor1.id = descriptorId1;

    const mockEService1: EService = {
      ...getMockEService(eserviceId1, generateId<TenantId>(), [
        mockDescriptor1,
      ]),
      personalData: true,
    };

    it("should return valid result when all validations pass", async () => {
      const eserviceIds = [eserviceId1];

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValueOnce(mockEService1);

      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockResolvedValue(undefined); // No existing associations

      const result = await validateEservicesAssociations(
        eserviceIds,
        purposeTemplate,
        mockReadModelService
      );

      expect(result).toEqual({
        type: "valid",
        value: [{ eservice: mockEService1, descriptorId: descriptorId1 }],
      });
    });

    it("should throw associationEServicesForPurposeTemplateFailed when eservice is not found (eserviceNotFound)", async () => {
      const eserviceIds = [eserviceId1];

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(undefined);

      await expect(
        validateEservicesAssociations(
          eserviceIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(
        associationEServicesForPurposeTemplateFailed(
          [eserviceNotFound(eserviceId1)],
          eserviceIds,
          purposeTemplate.id
        )
      );
    });

    it("should throw associationEServicesForPurposeTemplateFailed when the purpose template and eService personal data flags do not match (purposeTemplateEServicePersonalDataFlagMismatch)", async () => {
      const eserviceIds = [eserviceId1];

      const eserviceWithWrongPersonalDataFlag = {
        ...mockEService1,
        personalData: false,
      };

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(eserviceWithWrongPersonalDataFlag);

      await expect(
        validateEservicesAssociations(
          eserviceIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(
        associationEServicesForPurposeTemplateFailed(
          [
            purposeTemplateEServicePersonalDataFlagMismatch(
              eserviceWithWrongPersonalDataFlag,
              purposeTemplate
            ),
          ],
          eserviceIds,
          purposeTemplate.id
        )
      );
    });

    it("should propagate the original error when eservice retrieval fails (infra error -> default mapper -> 500)", async () => {
      const eserviceIds = [eserviceId1];
      const errorMessage = "Database connection failed";
      const dbError = new Error(errorMessage);

      mockReadModelService.getEServiceById = vi.fn().mockRejectedValue(dbError);

      await expect(
        validateEservicesAssociations(
          eserviceIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(dbError);
    });

    it("should throw associationBetweenEServiceAndPurposeTemplateAlreadyExists when eservice is already associated (eserviceAlreadyAssociatedError)", async () => {
      const eserviceIds = [eserviceId1];
      const existingAssociation = {
        id: generateId(),
        createdAt: new Date(),
        eserviceId: eserviceId1,
        descriptorId: descriptorId1,
        purposeTemplateId: purposeTemplate.id,
      };

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(mockEService1);

      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockResolvedValue(existingAssociation);

      await expect(
        validateEservicesAssociations(
          eserviceIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(
        associationBetweenEServiceAndPurposeTemplateAlreadyExists(
          [eserviceAlreadyAssociatedError(eserviceId1, purposeTemplate.id)],
          eserviceIds,
          purposeTemplate.id
        )
      );
    });

    it("should propagate the original error when association check fails (infra error -> default mapper -> 500)", async () => {
      const eserviceIds = [eserviceId1];
      const errorMessage = "Association check failed";
      const dbError = new Error(errorMessage);

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(mockEService1);
      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockRejectedValue(dbError);

      await expect(
        validateEservicesAssociations(
          eserviceIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(dbError);
    });

    it("should return invalid result when eservice has no descriptors (validateEServiceDescriptors)", async () => {
      const eserviceIds = [eserviceId1];
      const eserviceWithoutDescriptors: EService = {
        ...getMockEService(eserviceId1, generateId<TenantId>(), []),
        personalData: true,
      };

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(eserviceWithoutDescriptors);
      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockResolvedValue(undefined);

      const result = await validateEservicesAssociations(
        eserviceIds,
        purposeTemplate,
        mockReadModelService
      );

      expect(result).toEqual({
        type: "invalid",
        issues: [missingDescriptorError(eserviceId1)],
      });
    });

    it.each(
      Object.values(descriptorState).filter(
        (state) =>
          !ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_ASSOCIATION.includes(
            state
          )
      )
    )(
      "should return invalid result (invalidDescriptorStateError) when associating an eservice that only has invalid descriptor state %s (validateEServiceDescriptors)",
      async (invalidState) => {
        const eserviceIds = [eserviceId1];
        const invalidDescriptor = getMockDescriptor(invalidState);
        invalidDescriptor.id = descriptorId1;
        const eserviceWithInvalidDescriptors = {
          ...getMockEService(eserviceId1, generateId<TenantId>(), [
            invalidDescriptor,
          ]),
          personalData: true,
        };

        mockReadModelService.getEServiceById = vi
          .fn()
          .mockResolvedValue(eserviceWithInvalidDescriptors);
        mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
          vi.fn().mockResolvedValue(undefined);

        const result = await validateEservicesAssociations(
          eserviceIds,
          purposeTemplate,
          mockReadModelService
        );

        expect(result).toEqual({
          type: "invalid",
          issues: [
            invalidDescriptorStateError(eserviceId1, [
              descriptorState.published,
            ]),
          ],
        });
      }
    );

    it.each(
      Object.values(descriptorState).filter(
        (state) =>
          !ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_DISASSOCIATION.includes(
            state
          )
      )
    )(
      "should return invalid result (invalidDescriptorStateError) when disassociating an eservice that only has invalid descriptor state %s (validateEServiceDescriptors)",
      async (invalidState) => {
        const eserviceIds = [eserviceId1];
        const invalidDescriptor = getMockDescriptor(invalidState);
        invalidDescriptor.id = descriptorId1;
        const eserviceWithInvalidDescriptors = {
          ...getMockEService(eserviceId1, generateId<TenantId>(), [
            invalidDescriptor,
          ]),
          personalData: true,
        };

        const existingAssociation = {
          eserviceId: eserviceWithInvalidDescriptors.id,
          descriptorId: invalidDescriptor.id,
          purposeTemplateId: purposeTemplate.id,
        };

        mockReadModelService.getEServiceById = vi
          .fn()
          .mockResolvedValue(eserviceWithInvalidDescriptors);
        mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
          vi.fn().mockResolvedValue(existingAssociation);

        const result = await validateEservicesDisassociations(
          eserviceIds,
          purposeTemplate,
          mockReadModelService
        );

        expect(result).toEqual({
          type: "invalid",
          issues: [
            invalidDescriptorStateError(
              eserviceId1,
              ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_DISASSOCIATION
            ),
          ],
        });
      }
    );

    it("should return error when trying to unlink eservice that is not associated", async () => {
      const eserviceIds = [eserviceId1];
      const mockEService1 = {
        ...getMockEService(eserviceId1, generateId<TenantId>(), [
          getMockDescriptor(descriptorState.published),
        ]),
        personalData: true,
      };

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(mockEService1);

      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockResolvedValue(undefined); // No existing association

      await expect(
        validateEservicesDisassociations(
          eserviceIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(
        associationBetweenEServiceAndPurposeTemplateDoesNotExist(
          [eserviceNotAssociatedError(eserviceId1, purposeTemplate.id)],
          eserviceIds,
          purposeTemplate.id
        )
      );
    });

    it("should return valid when trying to unlink eservice that is associated", async () => {
      const eserviceIds = [eserviceId1];
      const mockDescriptor = getMockDescriptor(descriptorState.published);
      mockDescriptor.id = descriptorId1;
      const mockEService1 = {
        ...getMockEService(eserviceId1, generateId<TenantId>(), [
          mockDescriptor,
        ]),
        personalData: true,
      };

      const existingAssociation = {
        eserviceId: eserviceId1,
        descriptorId: descriptorId1,
        purposeTemplateId: purposeTemplate.id,
      };

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(mockEService1);

      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockResolvedValue(existingAssociation);

      const result = await validateEservicesDisassociations(
        eserviceIds,
        purposeTemplate,
        mockReadModelService
      );

      expect(result).toEqual({
        type: "valid",
        value: [
          {
            eservice: mockEService1,
            descriptorId: descriptorId1,
          },
        ],
      });
    });

    it("should propagate the original error when disassociation check fails (infra error -> default mapper -> 500)", async () => {
      const eserviceIds = [eserviceId1];
      const errorMessage = "Disassociation check failed";
      const dbError = new Error(errorMessage);

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(mockEService1);
      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockRejectedValue(dbError);

      await expect(
        validateEservicesDisassociations(
          eserviceIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(dbError);
    });
  });

  describe("validateEServiceTemplatesForPurposeTemplate", () => {
    const purposeTemplate: PurposeTemplate = {
      ...getMockPurposeTemplate(),
      handlesPersonalData: true,
    };
    const eserviceTemplateId1 = generateId<EServiceTemplateId>();

    const mockEServiceTemplate1: EServiceTemplate = {
      ...getMockEServiceTemplate(eserviceTemplateId1),
      personalData: true,
    };

    it("should propagate the original error when eservice template retrieval fails (infra error -> default mapper -> 500)", async () => {
      const eserviceTemplateIds = [eserviceTemplateId1];
      const errorMessage = "Database connection failed";
      const dbError = new Error(errorMessage);

      mockReadModelService.getEServiceTemplateById = vi
        .fn()
        .mockRejectedValue(dbError);

      await expect(
        validateEServiceTemplatesAssociations(
          eserviceTemplateIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(dbError);
    });

    it("should propagate the original error when eservice template association check fails (infra error -> default mapper -> 500)", async () => {
      const eserviceTemplateIds = [eserviceTemplateId1];
      const errorMessage = "Association check failed";
      const dbError = new Error(errorMessage);

      mockReadModelService.getEServiceTemplateById = vi
        .fn()
        .mockResolvedValue(mockEServiceTemplate1);
      mockReadModelService.getEServiceTemplateVersionPurposeTemplateByPurposeTemplateIdAndEServiceTemplateId =
        vi.fn().mockRejectedValue(dbError);

      await expect(
        validateEServiceTemplatesAssociations(
          eserviceTemplateIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(dbError);
    });

    it("should propagate the original error when eservice template retrieval fails during disassociation (infra error -> default mapper -> 500)", async () => {
      const eserviceTemplateIds = [eserviceTemplateId1];
      const errorMessage = "Database connection failed";
      const dbError = new Error(errorMessage);

      mockReadModelService.getEServiceTemplateById = vi
        .fn()
        .mockRejectedValue(dbError);

      await expect(
        validateEServiceTemplatesDisassociations(
          eserviceTemplateIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(dbError);
    });

    it("should propagate the original error when eservice template disassociation check fails (infra error -> default mapper -> 500)", async () => {
      const eserviceTemplateIds = [eserviceTemplateId1];
      const errorMessage = "Disassociation check failed";
      const dbError = new Error(errorMessage);

      mockReadModelService.getEServiceTemplateById = vi
        .fn()
        .mockResolvedValue(mockEServiceTemplate1);
      mockReadModelService.getEServiceTemplateVersionPurposeTemplateByPurposeTemplateIdAndEServiceTemplateId =
        vi.fn().mockRejectedValue(dbError);

      await expect(
        validateEServiceTemplatesDisassociations(
          eserviceTemplateIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(dbError);
    });
  });
});
