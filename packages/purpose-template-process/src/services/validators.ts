import {
  DescriptorId,
  EService,
  EServiceId,
  PurposeTemplateId,
  RiskAnalysisFormTemplate,
  TenantKind,
} from "pagopa-interop-models";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  eserviceAlreadyAssociatedError,
  invalidDescriptorStateError,
  RiskAnalysisTemplateValidatedForm,
  riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate,
  validatePurposeTemplateRiskAnalysis,
  unexpectedAssociationEServiceError,
  PurposeTemplateValidationIssue,
  unexpectedEServiceError,
  missingExpectedEService,
  invalidPurposeTemplateResult,
  PurposeTemplateValidationResult,
  missingDescriptorError,
  validPurposeTemplateResult,
} from "pagopa-interop-commons";
import {
  associationBetweenEServiceAndPurposeTemplateAlreadyExists,
  associationEServicesForPurposeTemplateFailed,
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
  riskAnalysisTemplateValidationFailed,
  tooManyEServicesForPurposeTemplate,
} from "../model/domain/errors.js";
import { config } from "../config/config.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const assertConsistentFreeOfCharge = (
  isFreeOfCharge: boolean,
  freeOfChargeReason: string | undefined
): void => {
  if (isFreeOfCharge && !freeOfChargeReason) {
    throw missingFreeOfChargeReason();
  }
};

export const assertPurposeTemplateTitleIsNotDuplicated = async ({
  readModelService,
  title,
}: {
  readModelService: ReadModelServiceSQL;
  title: string;
}): Promise<void> => {
  const purposeTemplateWithSameName = await readModelService.getPurposeTemplate(
    title
  );
  if (purposeTemplateWithSameName) {
    throw purposeTemplateNameConflict(
      purposeTemplateWithSameName.data.id,
      purposeTemplateWithSameName.data.purposeTitle
    );
  }
};

export const assertEServiceIdsCountIsBelowThreshold = (
  eserviceIdsSize: number
): void => {
  if (eserviceIdsSize > config.maxEServicesPerLinkRequest) {
    throw tooManyEServicesForPurposeTemplate(
      eserviceIdsSize,
      config.maxEServicesPerLinkRequest
    );
  }
};

export function validateAndTransformRiskAnalysisTemplate(
  purposeRiskAnalysisForm:
    | purposeTemplateApi.RiskAnalysisFormTemplateSeed
    | undefined,
  tenantKind: TenantKind
): RiskAnalysisFormTemplate | undefined {
  if (!purposeRiskAnalysisForm) {
    return undefined;
  }

  const validatedForm = validateRiskAnalysisTemplateOrThrow({
    riskAnalysisForm: purposeRiskAnalysisForm,
    tenantKind,
  });

  return riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate(
    validatedForm
  );
}

function validateRiskAnalysisTemplateOrThrow({
  riskAnalysisForm,
  tenantKind,
}: {
  riskAnalysisForm: purposeTemplateApi.RiskAnalysisFormTemplateSeed;
  tenantKind: TenantKind;
}): RiskAnalysisTemplateValidatedForm {
  const result = validatePurposeTemplateRiskAnalysis(
    riskAnalysisForm,
    tenantKind
  );

  if (result.type === "invalid") {
    throw riskAnalysisTemplateValidationFailed(result.issues);
  } else {
    return result.value;
  }
}

/**
 * Validate the existence of the eservices
 * For each eservice id:
 * - Promise.fulfilled: return the eservice if found
 * - Promise.fulfilled: return validation issue with the eservice id if not found
 * - Promise.rejected: return a validation issue with the eservice id and the error message
 * Finally, return the validation issues and the valid eservices
 *
 * @param eserviceIds the list of eservice ids to validate
 * @param readModelService the read model service to use
 * @returns the validation issues and the valid eservices
 */
async function validateEServiceExistence(
  eserviceIds: EServiceId[],
  readModelService: ReadModelServiceSQL
): Promise<{
  validationIssues: PurposeTemplateValidationIssue[];
  validEservices: EService[];
}> {
  const eserviceResults = await Promise.allSettled(
    eserviceIds.map(
      async (eserviceId) => await readModelService.getEServiceById(eserviceId)
    )
  );

  const validationIssues = eserviceResults.flatMap((result, index) => {
    if (result.status === "rejected") {
      return [
        unexpectedEServiceError(result.reason.message, eserviceIds[index]),
      ];
    }

    // eservice not found
    if (result.status === "fulfilled" && !result.value) {
      return [missingExpectedEService(eserviceIds[index])];
    }

    return [];
  });

  const validEservices = eserviceResults
    .filter(
      (result): result is PromiseFulfilledResult<EService> =>
        result.status === "fulfilled" && result.value !== undefined
    )
    .map((result) => result.value);

  return { validationIssues, validEservices };
}

/**
 * Validate the associations between the eservices and the purpose template
 * For each eservice:
 * - Promise.fulfilled: return error if the eservice is already associated with the purpose template
 * - Promise.rejected: return a validation issue with the eservice id and the error message
 * Finally, return the validation issues
 *
 * @param validEservices the list of valid eservices
 * @param purposeTemplateId the purpose template id
 * @param readModelService the read model service to use
 * @returns the validation issues
 */
async function validateEServiceAssociations(
  validEservices: EService[],
  purposeTemplateId: PurposeTemplateId,
  readModelService: ReadModelServiceSQL
): Promise<PurposeTemplateValidationIssue[]> {
  const associationValidationResults = await Promise.allSettled(
    validEservices.map(
      async (eservice) =>
        await readModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId(
          purposeTemplateId,
          eservice.id
        )
    )
  );

  return associationValidationResults.flatMap((result, index) => {
    if (result.status === "rejected") {
      return [
        unexpectedAssociationEServiceError(
          result.reason.message,
          validEservices[index].id
        ),
      ];
    }

    if (result.status === "fulfilled" && result.value !== undefined) {
      return [
        eserviceAlreadyAssociatedError(
          validEservices[index].id,
          purposeTemplateId
        ),
      ];
    }
    return [];
  });
}

/**
 * Validate the descriptors for each eservice
 * For each eservice:
 * - If the eservice has no descriptors, return a validation issue with the eservice id
 * - If the eservice has descriptors, return the descriptor id if the descriptor is in the "Published" or "Draft" state
 * Finally, return the validation issues and the valid eservice descriptor pairs
 *
 * @param validEservices the list of valid eservices
 * @returns the validation issues and the valid eservice descriptor pairs
 */
function validateEServiceDescriptors(validEservices: EService[]): {
  validationIssues: PurposeTemplateValidationIssue[];
  validEServiceDescriptorPairs: Array<{
    eservice: EService;
    descriptorId: DescriptorId;
  }>;
} {
  const validationIssues: PurposeTemplateValidationIssue[] = [];
  const validEServiceDescriptorPairs: Array<{
    eservice: EService;
    descriptorId: DescriptorId;
  }> = [];

  validEservices.forEach((eservice) => {
    if (!eservice.descriptors || eservice.descriptors.length === 0) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(missingDescriptorError(eservice.id));
      return;
    }

    const validDescriptor = eservice.descriptors.find(
      (descriptor) =>
        descriptor.state === "Published" || descriptor.state === "Draft"
    );

    if (!validDescriptor) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        invalidDescriptorStateError(eservice.id, ["Published", "Draft"])
      );
      return;
    }

    // eslint-disable-next-line functional/immutable-data
    validEServiceDescriptorPairs.push({
      eservice,
      descriptorId: validDescriptor.id,
    });
  });

  return { validationIssues, validEServiceDescriptorPairs };
}

export async function validateEServicesForPurposeTemplate(
  eserviceIds: EServiceId[],
  purposeTemplateId: PurposeTemplateId,
  readModelService: ReadModelServiceSQL
): Promise<
  PurposeTemplateValidationResult<
    Array<{ eservice: EService; descriptorId: DescriptorId }>
  >
> {
  const { validationIssues, validEservices } = await validateEServiceExistence(
    eserviceIds,
    readModelService
  );

  if (validationIssues.length > 0) {
    throw associationEServicesForPurposeTemplateFailed(
      validationIssues,
      eserviceIds,
      purposeTemplateId
    );
  }

  const associationValidationIssues = await validateEServiceAssociations(
    validEservices,
    purposeTemplateId,
    readModelService
  );

  if (associationValidationIssues.length > 0) {
    throw associationBetweenEServiceAndPurposeTemplateAlreadyExists(
      associationValidationIssues,
      eserviceIds,
      purposeTemplateId
    );
  }

  const {
    validationIssues: descriptorValidationIssues,
    validEServiceDescriptorPairs,
  } = validateEServiceDescriptors(validEservices);

  if (descriptorValidationIssues.length > 0) {
    return invalidPurposeTemplateResult(descriptorValidationIssues);
  }

  return validPurposeTemplateResult(validEServiceDescriptorPairs);
}
