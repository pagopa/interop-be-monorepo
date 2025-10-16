import {
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  PurposeTemplateId,
  PurposeTemplate,
  purposeTemplateState,
  PurposeTemplateState,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswer,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  TenantId,
  TenantKind,
} from "pagopa-interop-models";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import {
  M2MAdminAuthData,
  M2MAuthData,
  RiskAnalysisTemplateValidatedForm,
  RiskAnalysisTemplateValidatedSingleOrMultiAnswer,
  riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate,
  UIAuthData,
  validatePurposeTemplateRiskAnalysis,
  validateRiskAnalysisAnswer,
  validateNoHyperlinks,
} from "pagopa-interop-commons";
import {
  associationBetweenEServiceAndPurposeTemplateAlreadyExists,
  associationEServicesForPurposeTemplateFailed,
  annotationDocumentLimitExceeded,
  conflictDocumentPrettyNameDuplicate,
  conflictDuplicatedDocument,
  hyperlinkDetectionError,
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  purposeTemplateStateConflict,
  riskAnalysisTemplateValidationFailed,
  tooManyEServicesForPurposeTemplate,
  associationBetweenEServiceAndPurposeTemplateDoesNotExist,
  disassociationEServicesFromPurposeTemplateFailed,
  tenantNotAllowed,
} from "../model/domain/errors.js";
import { config } from "../config/config.js";
import {
  eserviceAlreadyAssociatedError,
  eserviceNotAssociatedError,
  eserviceNotFound,
  invalidDescriptorStateError,
  invalidPurposeTemplateResult,
  missingDescriptorError,
  PurposeTemplateValidationIssue,
  PurposeTemplateValidationResult,
  unexpectedAssociationEServiceError,
  unexpectedEServiceError,
  unexpectedUnassociationEServiceError,
  validPurposeTemplateResult,
} from "../errors/purposeTemplateValidationErrors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const ANNOTATION_DOCUMENTS_LIMIT = 2;

const isRequesterCreator = (
  creatorId: TenantId,
  authData: Pick<UIAuthData | M2MAuthData | M2MAdminAuthData, "organizationId">
): boolean => authData.organizationId === creatorId;

const isPurposeTemplateActive = (
  currentPurposeTemplateState: PurposeTemplateState
): boolean => currentPurposeTemplateState === purposeTemplateState.active;

const isPurposeTemplateArchived = (
  currentPurposeTemplateState: PurposeTemplateState
): boolean => currentPurposeTemplateState === purposeTemplateState.archived;

const isPurposeTemplateDraft = (
  currentPurposeTemplateState: PurposeTemplateState
): boolean => currentPurposeTemplateState === purposeTemplateState.draft;

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

export const assertPurposeTemplateStateIsNotDraft = (
  purposeTemplate: PurposeTemplate
): void => {
  if (purposeTemplate.state !== purposeTemplateState.draft) {
    throw purposeTemplateNotInExpectedStates(
      purposeTemplate.id,
      purposeTemplate.state,
      [purposeTemplateState.draft]
    );
  }
};

export const assertDocumentsLimitsNotReached = (
  docs: RiskAnalysisTemplateAnswerAnnotationDocument[] | undefined,
  answerId: string
): void => {
  const totalDocs = docs?.length || 0;
  if (totalDocs === ANNOTATION_DOCUMENTS_LIMIT) {
    throw annotationDocumentLimitExceeded(answerId);
  }
};

export const assertAnnotationDocumentIsUnique = (
  { answer }: RiskAnalysisTemplateAnswer,
  newPrettyName: string,
  newChecksum: string
): void =>
  [...(answer?.annotation?.docs || [])].forEach((doc) => {
    if (doc.prettyName === newPrettyName) {
      throw conflictDocumentPrettyNameDuplicate(answer.id, newPrettyName);
    }

    if (doc?.checksum === newChecksum) {
      throw conflictDuplicatedDocument(answer.id, newChecksum);
    }
  });

export function validateAndTransformRiskAnalysisTemplate(
  riskAnalysisFormTemplate:
    | purposeTemplateApi.RiskAnalysisFormTemplateSeed
    | undefined,
  tenantKind: TenantKind
): RiskAnalysisFormTemplate | undefined {
  if (!riskAnalysisFormTemplate) {
    return undefined;
  }

  const validatedForm = validateRiskAnalysisTemplateOrThrow({
    riskAnalysisFormTemplate,
    tenantKind,
  });

  return riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate(
    validatedForm
  );
}

export function validateRiskAnalysisAnswerAnnotationOrThrow(
  text: string
): void {
  validateNoHyperlinks(text, hyperlinkDetectionError(text));
}

export function validateRiskAnalysisTemplateOrThrow({
  riskAnalysisFormTemplate,
  tenantKind,
}: {
  riskAnalysisFormTemplate: purposeTemplateApi.RiskAnalysisFormTemplateSeed;
  tenantKind: TenantKind;
}): RiskAnalysisTemplateValidatedForm {
  const result = validatePurposeTemplateRiskAnalysis(
    riskAnalysisFormTemplate,
    tenantKind
  );

  return match(result)
    .with({ type: "invalid" }, ({ issues }) => {
      throw riskAnalysisTemplateValidationFailed(issues);
    })
    .with({ type: "valid" }, ({ value }) => value)
    .exhaustive();
}

export function validateRiskAnalysisAnswerOrThrow({
  riskAnalysisAnswer,
  tenantKind,
}: {
  riskAnalysisAnswer: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest;
  tenantKind: TenantKind;
}): RiskAnalysisTemplateValidatedSingleOrMultiAnswer {
  if (riskAnalysisAnswer.answerData.annotation) {
    validateRiskAnalysisAnswerAnnotationOrThrow(
      riskAnalysisAnswer.answerData.annotation.text
    );
  }

  const result = validateRiskAnalysisAnswer(
    riskAnalysisAnswer.answerKey,
    riskAnalysisAnswer.answerData,
    tenantKind
  );

  if (result.type === "invalid") {
    throw riskAnalysisTemplateValidationFailed(result.issues);
  }

  return result.value;
}

export const assertPurposeTemplateIsDraft = (
  purposeTemplate: PurposeTemplate
): void => {
  if (!isPurposeTemplateDraft(purposeTemplate.state)) {
    throw purposeTemplateNotInExpectedStates(
      purposeTemplate.id,
      purposeTemplate.state,
      [purposeTemplateState.draft]
    );
  }
};

export const assertRequesterIsCreator = (
  creatorId: TenantId,
  authData: Pick<UIAuthData | M2MAdminAuthData, "organizationId">
): void => {
  if (!isRequesterCreator(creatorId, authData)) {
    throw tenantNotAllowed(authData.organizationId);
  }
};

export const assertRequesterCanRetrievePurposeTemplate = async (
  purposeTemplate: PurposeTemplate,
  authData: Pick<UIAuthData | M2MAuthData | M2MAdminAuthData, "organizationId">
): Promise<void> => {
  if (
    !isPurposeTemplateActive(purposeTemplate.state) &&
    !isRequesterCreator(purposeTemplate.creatorId, authData)
  ) {
    throw tenantNotAllowed(authData.organizationId);
  }
};

export const assertPurposeTemplateStateIsValid = (
  purposeTemplate: PurposeTemplate,
  expectedInitialStates: PurposeTemplateState[],
  conflictState?: PurposeTemplateState
): void => {
  match(purposeTemplate)
    .when(
      (p) => p.state === conflictState,
      () => {
        throw purposeTemplateStateConflict(
          purposeTemplate.id,
          purposeTemplate.state
        );
      }
    )
    .when(
      (p) => !expectedInitialStates.includes(p.state),
      () => {
        throw purposeTemplateNotInExpectedStates(
          purposeTemplate.id,
          purposeTemplate.state,
          expectedInitialStates
        );
      }
    );
};

export const assertActivatableState = (
  purposeTemplate: PurposeTemplate,
  expectedInitialState: PurposeTemplateState
): void => {
  assertPurposeTemplateStateIsValid(
    purposeTemplate,
    [expectedInitialState],
    purposeTemplateState.active
  );
};

export const assertSuspendableState = (
  purposeTemplate: PurposeTemplate
): void => {
  assertPurposeTemplateStateIsValid(
    purposeTemplate,
    [purposeTemplateState.active],
    purposeTemplateState.suspended
  );
};

export const archivableInitialStates = Object.values(
  purposeTemplateState
).filter((state) => !isPurposeTemplateArchived(state));
export const assertArchivableState = (
  purposeTemplate: PurposeTemplate
): void => {
  assertPurposeTemplateStateIsValid(
    purposeTemplate,
    archivableInitialStates,
    purposeTemplateState.archived
  );
};

export function assertPurposeTemplateHasRiskAnalysisForm(
  purposeTemplate: PurposeTemplate
): asserts purposeTemplate is PurposeTemplate & {
  purposeRiskAnalysisForm: RiskAnalysisFormTemplate;
} {
  if (!purposeTemplate.purposeRiskAnalysisForm) {
    throw purposeTemplateRiskAnalysisFormNotFound(purposeTemplate.id);
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

  return eserviceResults.reduce(
    (acc, result, index) =>
      match(result)
        .with({ status: "fulfilled" }, (res) => {
          if (!res.value) {
            return {
              ...acc,
              validationIssues: [
                ...acc.validationIssues,
                eserviceNotFound(eserviceIds[index]),
              ],
            };
          }

          return {
            ...acc,
            validEservices: [...acc.validEservices, res.value],
          };
        })
        .with({ status: "rejected" }, (res) => ({
          ...acc,
          validationIssues: [
            ...acc.validationIssues,
            unexpectedEServiceError(res.reason.message, eserviceIds[index]),
          ],
        }))
        .exhaustive(),
    {
      validationIssues: new Array<PurposeTemplateValidationIssue>(),
      validEservices: new Array<EService>(),
    }
  );
}

/**
 * Helper function to validate eservice associations with a purpose template
 *
 * @param validEservices the list of valid eservices
 * @param purposeTemplateId the purpose template id
 * @param readModelService the read model service to use
 * @returns the association validation results
 */
async function getEServiceAssociationResults(
  validEservices: EService[],
  purposeTemplateId: PurposeTemplateId,
  readModelService: ReadModelServiceSQL
): Promise<Array<PromiseSettledResult<unknown>>> {
  return Promise.allSettled(
    validEservices.map(
      async (eservice) =>
        await readModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateIdAndEserviceId(
          purposeTemplateId,
          eservice.id
        )
    )
  );
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
  const associationValidationResults = await getEServiceAssociationResults(
    validEservices,
    purposeTemplateId,
    readModelService
  );

  return associationValidationResults.flatMap((result, index) => {
    if (result.status === "rejected") {
      throw unexpectedAssociationEServiceError(
        result.reason.message,
        validEservices[index].id
      );
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
 * Validate the disassociations between the eservices and the purpose template
 * For each eservice:
 * - Promise.fulfilled: return error if the eservice is not associated with the purpose template
 * - Promise.rejected: return a validation issue with the eservice id and the error message
 * Finally, return the validation issues
 *
 * @param validEservices the list of valid eservices
 * @param purposeTemplateId the purpose template id
 * @param readModelService the read model service to use
 * @returns the validation issues
 */
async function validateEServiceDisassociations(
  validEservices: EService[],
  purposeTemplateId: PurposeTemplateId,
  readModelService: ReadModelServiceSQL
): Promise<PurposeTemplateValidationIssue[]> {
  const associationValidationResults = await getEServiceAssociationResults(
    validEservices,
    purposeTemplateId,
    readModelService
  );

  return associationValidationResults.flatMap((result, index) => {
    if (result.status === "rejected") {
      throw unexpectedUnassociationEServiceError(
        result.reason.message,
        validEservices[index].id
      );
    }

    if (result.status === "fulfilled" && result.value === undefined) {
      return [
        eserviceNotAssociatedError(validEservices[index].id, purposeTemplateId),
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
        descriptor.state === descriptorState.published ||
        descriptor.state === descriptorState.draft
    );

    if (!validDescriptor) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        invalidDescriptorStateError(eservice.id, [
          descriptorState.published,
          descriptorState.draft,
        ])
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

export async function validateEservicesAssociations(
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

export async function validateEservicesDisassociations(
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
    throw disassociationEServicesFromPurposeTemplateFailed(
      validationIssues,
      eserviceIds,
      purposeTemplateId
    );
  }

  const disassociationValidationIssues = await validateEServiceDisassociations(
    validEservices,
    purposeTemplateId,
    readModelService
  );

  if (disassociationValidationIssues.length > 0) {
    throw associationBetweenEServiceAndPurposeTemplateDoesNotExist(
      disassociationValidationIssues,
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
