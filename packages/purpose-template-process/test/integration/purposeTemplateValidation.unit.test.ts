import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DescriptorId,
  EServiceId,
  TenantId,
  generateId,
  descriptorState,
  PurposeTemplate,
  EService,
} from "pagopa-interop-models";
import {
  getMockEService,
  getMockDescriptor,
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
  unexpectedAssociationEServiceError,
  unexpectedEServiceError,
} from "../../src/errors/purposeTemplateValidationErrors.js";
import {
  ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_ASSOCIATION,
  ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_DISASSOCIATION,
  validateEservicesAssociations,
  validateEservicesDisassociations,
} from "../../src/services/validators.js";

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

    it("should throw associationEServicesForPurposeTemplateFailed when eservice retrieval fails (unexpectedEServiceError)", async () => {
      const eserviceIds = [eserviceId1];
      const errorMessage = "Database connection failed";

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockRejectedValue(new Error(errorMessage));

      await expect(
        validateEservicesAssociations(
          eserviceIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(
        associationEServicesForPurposeTemplateFailed(
          [unexpectedEServiceError(errorMessage, eserviceId1)],
          eserviceIds,
          purposeTemplate.id
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

    it("should throw associationBetweenEServiceAndPurposeTemplateAlreadyExists when association check fails (unexpectedAssociationEServiceError)", async () => {
      const eserviceIds = [eserviceId1];
      const errorMessage = "Association check failed";

      mockReadModelService.getEServiceById = vi
        .fn()
        .mockResolvedValue(mockEService1);
      mockReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId =
        vi.fn().mockRejectedValue(new Error(errorMessage));

      await expect(
        validateEservicesAssociations(
          eserviceIds,
          purposeTemplate,
          mockReadModelService
        )
      ).rejects.toThrow(
        unexpectedAssociationEServiceError(errorMessage, eserviceId1)
      );
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
  });
});
