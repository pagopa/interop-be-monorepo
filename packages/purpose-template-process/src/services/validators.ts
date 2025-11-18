import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  hasAtLeastOneSystemRole,
  hasAtLeastOneUserRole,
  M2MAdminAuthData,
  M2MAuthData,
  RiskAnalysisTemplateValidatedForm,
  RiskAnalysisTemplateValidatedSingleOrMultiAnswer,
  riskAnalysisValidatedFormTemplateToNewRiskAnalysisFormTemplate,
  systemRole,
  UIAuthData,
  validateNoHyperlinks,
  validatePurposeTemplateRiskAnalysis,
  validateRiskAnalysisAnswer,
} from "pagopa-interop-commons";
import {
  DescriptorId,
  DescriptorState,
  descriptorState,
  EService,
  EServiceDescriptorPurposeTemplate,
  EServiceId,
  PurposeTemplate,
  PurposeTemplateId,
  purposeTemplateState,
  PurposeTemplateState,
  RiskAnalysisFormTemplate,
  RiskAnalysisMultiAnswerId,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisTemplateAnswer,
  RiskAnalysisTemplateAnswerAnnotationDocument,
  TenantId,
  TenantKind,
  userRole,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { config } from "../config/config.js";
import {
  eserviceAlreadyAssociatedError,
  eserviceNotAssociatedError,
  eserviceNotFound,
  invalidDescriptorStateError,
  invalidDescriptorStateForPublicationError,
  invalidPurposeTemplateResult,
  missingDescriptorError,
  purposeTemplateEServicePersonalDataFlagMismatch,
  PurposeTemplateValidationIssue,
  PurposeTemplateValidationResult,
  unexpectedAssociationEServiceError,
  unexpectedEServiceError,
  unexpectedUnassociationEServiceError,
  validPurposeTemplateResult,
} from "../errors/purposeTemplateValidationErrors.js";
import {
  toRiskAnalysisFormTemplateToValidate,
  toRiskAnalysisTemplateAnswerToValidate,
} from "../model/domain/apiConverter.js";
import {
  annotationDocumentLimitExceeded,
  associationBetweenEServiceAndPurposeTemplateAlreadyExists,
  associationBetweenEServiceAndPurposeTemplateDoesNotExist,
  associationEServicesForPurposeTemplateFailed,
  conflictDocumentPrettyNameDuplicate,
  conflictDuplicatedDocument,
  disassociationEServicesFromPurposeTemplateFailed,
  hyperlinkDetectionError,
  missingFreeOfChargeReason,
  purposeTemplateNameConflict,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  purposeTemplateStateConflict,
  riskAnalysisTemplateAnswerNotFound,
  riskAnalysisTemplateValidationFailed,
  tenantNotAllowed,
  tooManyEServicesForPurposeTemplate,
} from "../model/domain/errors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const ANNOTATION_DOCUMENTS_LIMIT = 2;

export const ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_PUBLICATION = [
  descriptorState.published,
  descriptorState.draft,
  descriptorState.waitingForApproval,
  descriptorState.deprecated,
];

export const ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_ASSOCIATION: DescriptorState[] =
  [descriptorState.published];

export const ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_DISASSOCIATION: DescriptorState[] =
  [
    descriptorState.published,
    descriptorState.suspended,
    descriptorState.deprecated,
    descriptorState.archived,
  ];

export const isRequesterCreator = (
  creatorId: TenantId,
  authData: Pick<UIAuthData | M2MAuthData | M2MAdminAuthData, "organizationId">
): boolean => authData.organizationId === creatorId;

export const isPurposeTemplateDraft = (
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

export const assertDocumentsLimitsNotReached = (
  docs: RiskAnalysisTemplateAnswerAnnotationDocument[] | undefined,
  answerId: string
): void => {
  const totalDocs = docs?.length || 0;
  if (totalDocs === ANNOTATION_DOCUMENTS_LIMIT) {
    throw annotationDocumentLimitExceeded(answerId);
  }
};

const assertPrettyNameIsUnique = (
  docPrettyName: string,
  newPrettyName: string,
  answerId: string
): void => {
  if (docPrettyName === newPrettyName) {
    throw conflictDocumentPrettyNameDuplicate(answerId, newPrettyName);
  }
};

export const assertAnnotationDocumentPrettyNameIsUnique = (
  { answer }: RiskAnalysisTemplateAnswer,
  newPrettyName: string
): void =>
  [...(answer?.annotation?.docs || [])].forEach((doc) => {
    assertPrettyNameIsUnique(doc.prettyName, newPrettyName, answer.id);
  });

export const assertAnnotationDocumentIsUnique = (
  { answer }: RiskAnalysisTemplateAnswer,
  newPrettyName: string,
  newChecksum: string
): void =>
  [...(answer?.annotation?.docs || [])].forEach((doc) => {
    assertPrettyNameIsUnique(doc.prettyName, newPrettyName, answer.id);

    if (doc?.checksum === newChecksum) {
      throw conflictDuplicatedDocument(answer.id, newChecksum);
    }
  });

export function validateAndTransformRiskAnalysisTemplate(
  riskAnalysisFormTemplate:
    | purposeTemplateApi.RiskAnalysisFormTemplateSeed
    | undefined,
  tenantKind: TenantKind,
  personalDataInPurposeTemplate: boolean
): RiskAnalysisFormTemplate | undefined {
  if (!riskAnalysisFormTemplate) {
    return undefined;
  }

  const validatedForm = validateRiskAnalysisTemplateOrThrow({
    riskAnalysisFormTemplate,
    tenantKind,
    personalDataInPurposeTemplate,
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
  personalDataInPurposeTemplate,
}: {
  riskAnalysisFormTemplate: purposeTemplateApi.RiskAnalysisFormTemplateSeed;
  tenantKind: TenantKind;
  personalDataInPurposeTemplate: boolean;
}): RiskAnalysisTemplateValidatedForm {
  const result = validatePurposeTemplateRiskAnalysis(
    toRiskAnalysisFormTemplateToValidate(riskAnalysisFormTemplate),
    tenantKind,
    personalDataInPurposeTemplate
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
    toRiskAnalysisTemplateAnswerToValidate(riskAnalysisAnswer.answerData),
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
    purposeTemplateState.published
  );
};

export const assertSuspendableState = (
  purposeTemplate: PurposeTemplate
): void => {
  assertPurposeTemplateStateIsValid(
    purposeTemplate,
    [purposeTemplateState.published],
    purposeTemplateState.suspended
  );
};

export const archivableInitialStates: PurposeTemplateState[] = [
  purposeTemplateState.published,
  purposeTemplateState.suspended,
];
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

export const assertAnswerExistsInRiskAnalysisTemplate = (
  purposeTemplate: PurposeTemplate,
  answerId: RiskAnalysisSingleAnswerId | RiskAnalysisMultiAnswerId
): void => {
  const riskAnalysisTemplate = purposeTemplate.purposeRiskAnalysisForm;
  const answerExists =
    riskAnalysisTemplate?.singleAnswers.some((a) => a.id === answerId) ||
    riskAnalysisTemplate?.multiAnswers.some((a) => a.id === answerId);

  if (!answerExists) {
    throw riskAnalysisTemplateAnswerNotFound({
      purposeTemplateId: purposeTemplate.id,
      answerId,
    });
  }
};

/**
 * Validate the existence of the eservices and check that their personal data flag matches the purpose template one
 * For each eservice id:
 * - Promise.fulfilled: return the eservice if found
 * - Promise.fulfilled: return validation issue with the eservice id if not found
 * - Promise.rejected: return a validation issue with the eservice id and the error message
 * Finally, return the validation issues and the valid eservices
 *
 * @param eserviceIds the list of eservice ids to validate
 * @param purposeTemplate the purpose template to use
 * @param readModelService the read model service to use
 * @returns the validation issues and the valid eservices
 */
async function validateEServiceExistence(
  eserviceIds: EServiceId[],
  purposeTemplate: PurposeTemplate,
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

          if (res.value.personalData !== purposeTemplate.handlesPersonalData) {
            return {
              ...acc,
              validationIssues: [
                ...acc.validationIssues,
                purposeTemplateEServicePersonalDataFlagMismatch(
                  res.value,
                  purposeTemplate
                ),
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
): Promise<
  Array<PromiseSettledResult<EServiceDescriptorPurposeTemplate | undefined>>
> {
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
 * @returns the validation issues and the valid eservice descriptor purpose templates retrieved
 */
async function validateEServiceDisassociations(
  validEservices: EService[],
  purposeTemplateId: PurposeTemplateId,
  readModelService: ReadModelServiceSQL
): Promise<{
  validationIssues: PurposeTemplateValidationIssue[];
  validEServiceDescriptorPurposeTemplates: EServiceDescriptorPurposeTemplate[];
}> {
  const validationIssues: PurposeTemplateValidationIssue[] = [];
  const validEServiceDescriptorPurposeTemplates: EServiceDescriptorPurposeTemplate[] =
    [];

  const eServiceAssociationResults = await getEServiceAssociationResults(
    validEservices,
    purposeTemplateId,
    readModelService
  );

  eServiceAssociationResults.forEach((result, index) => {
    if (result.status === "rejected") {
      throw unexpectedUnassociationEServiceError(
        result.reason.message,
        validEservices[index].id
      );
    }

    if (result.value === undefined) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        eserviceNotAssociatedError(validEservices[index].id, purposeTemplateId)
      );
      return;
    }

    // eslint-disable-next-line functional/immutable-data
    validEServiceDescriptorPurposeTemplates.push(result.value);
  });

  return { validationIssues, validEServiceDescriptorPurposeTemplates };
}

/**
 * Validate the descriptors for each eservice when associating
 * For each eservice:
 * - If the eservice has no descriptors, return a validation issue with the eservice id
 * - If the eservice has descriptors, return the descriptor id if the descriptor is Published
 * Finally, return the validation issues and the valid eservice descriptor pairs
 *
 * @param validEservices the list of valid eservices
 * @returns the validation issues and the valid eservice descriptor pairs
 */
function validateEServiceDescriptorsToAssociate(validEservices: EService[]): {
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

    const validDescriptor = eservice.descriptors.find((descriptor) =>
      ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_ASSOCIATION.includes(
        descriptor.state
      )
    );

    if (!validDescriptor) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        invalidDescriptorStateError(
          eservice.id,
          ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_ASSOCIATION
        )
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

/**
 * Validate the descriptors for each eservice when disassociating
 * For each eservice:
 * - If the eservice has no descriptors, return a validation issue with the eservice id
 * - If the eservice has descriptors, return the descriptor id if the descriptor is in one of the valid states
 * Finally, return the validation issues and the valid eservice descriptor pairs
 *
 * @param validEservices the list of valid eservices
 * @param validEServiceDescriptorPurposeTemplates the list of valid eservice descriptor purpose templates
 * @returns the validation issues and the valid eservice descriptor pairs
 */
function validateEServiceDescriptorsToDisassociate(
  validEservices: EService[],
  validEServiceDescriptorPurposeTemplates: EServiceDescriptorPurposeTemplate[]
): {
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

  // Get the eservice from the eservice id.
  // If the eservice is not found, return a validation issue.
  const eserviceDisassociationData =
    validEServiceDescriptorPurposeTemplates.reduce(
      (acc, { eserviceId, descriptorId, purposeTemplateId }) => {
        const eservice = validEservices.find(
          (eservice) => eservice.id === eserviceId
        );

        if (!eservice) {
          // eslint-disable-next-line functional/immutable-data
          validationIssues.push(
            eserviceNotAssociatedError(eserviceId, purposeTemplateId)
          );
          return acc;
        }

        return [
          ...acc,
          {
            eservice,
            descriptorId,
            purposeTemplateId,
          },
        ];
      },
      [] as Array<{
        eservice: EService;
        descriptorId: DescriptorId;
        purposeTemplateId: PurposeTemplateId;
      }>
    );

  // Validate the descriptors, checking the descriptor is linked to the purpose template and is in a valid state
  eserviceDisassociationData.forEach((disassociationData) => {
    const { eservice, descriptorId, purposeTemplateId } = disassociationData;

    if (!eservice.descriptors || eservice.descriptors.length === 0) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(missingDescriptorError(eservice.id));
      return;
    }

    const descriptor = eservice.descriptors.find(
      (descriptor) => descriptor.id === descriptorId
    );

    if (!descriptor) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        eserviceNotAssociatedError(eservice.id, purposeTemplateId)
      );
      return;
    }

    const descriptorIsValid =
      ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_DISASSOCIATION.includes(
        descriptor.state
      );

    if (!descriptorIsValid) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        invalidDescriptorStateError(
          eservice.id,
          ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_DISASSOCIATION
        )
      );
      return;
    }

    // eslint-disable-next-line functional/immutable-data
    validEServiceDescriptorPairs.push({
      eservice,
      descriptorId,
    });
  });

  return { validationIssues, validEServiceDescriptorPairs };
}

export const validateAssociatedEserviceForPublication = async (
  readModelService: ReadModelServiceSQL,
  purposeTemplateId: PurposeTemplateId
): Promise<PurposeTemplateValidationIssue[]> => {
  const associatedEservicesWithDescriptorInNotValidState =
    await readModelService.getPurposeTemplateEServiceWithDescriptorState(
      purposeTemplateId,
      ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_PUBLICATION
    );

  if (associatedEservicesWithDescriptorInNotValidState.totalCount) {
    return associatedEservicesWithDescriptorInNotValidState.results.reduce(
      (errors, eservice) => [
        ...errors,
        invalidDescriptorStateForPublicationError(
          eservice,
          ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_PUBLICATION
        ),
      ],
      [] as PurposeTemplateValidationIssue[]
    );
  }

  return [];
};

export async function validateEservicesAssociations(
  eserviceIds: EServiceId[],
  purposeTemplate: PurposeTemplate,
  readModelService: ReadModelServiceSQL
): Promise<
  PurposeTemplateValidationResult<
    Array<{ eservice: EService; descriptorId: DescriptorId }>
  >
> {
  const { validationIssues, validEservices } = await validateEServiceExistence(
    eserviceIds,
    purposeTemplate,
    readModelService
  );

  if (validationIssues.length > 0) {
    throw associationEServicesForPurposeTemplateFailed(
      validationIssues,
      eserviceIds,
      purposeTemplate.id
    );
  }

  const associationValidationIssues = await validateEServiceAssociations(
    validEservices,
    purposeTemplate.id,
    readModelService
  );

  if (associationValidationIssues.length > 0) {
    throw associationBetweenEServiceAndPurposeTemplateAlreadyExists(
      associationValidationIssues,
      eserviceIds,
      purposeTemplate.id
    );
  }

  const {
    validationIssues: descriptorValidationIssues,
    validEServiceDescriptorPairs,
  } = validateEServiceDescriptorsToAssociate(validEservices);

  if (descriptorValidationIssues.length > 0) {
    return invalidPurposeTemplateResult(descriptorValidationIssues);
  }

  return validPurposeTemplateResult(validEServiceDescriptorPairs);
}

export async function validateEservicesDisassociations(
  eserviceIds: EServiceId[],
  purposeTemplate: PurposeTemplate,
  readModelService: ReadModelServiceSQL
): Promise<
  PurposeTemplateValidationResult<
    Array<{ eservice: EService; descriptorId: DescriptorId }>
  >
> {
  const { validationIssues, validEservices } = await validateEServiceExistence(
    eserviceIds,
    purposeTemplate,
    readModelService
  );

  if (validationIssues.length > 0) {
    throw disassociationEServicesFromPurposeTemplateFailed(
      validationIssues,
      eserviceIds,
      purposeTemplate.id
    );
  }

  const {
    validationIssues: disassociationValidationIssues,
    validEServiceDescriptorPurposeTemplates,
  } = await validateEServiceDisassociations(
    validEservices,
    purposeTemplate.id,
    readModelService
  );

  if (disassociationValidationIssues.length > 0) {
    throw associationBetweenEServiceAndPurposeTemplateDoesNotExist(
      disassociationValidationIssues,
      eserviceIds,
      purposeTemplate.id
    );
  }

  const {
    validationIssues: descriptorValidationIssues,
    validEServiceDescriptorPairs,
  } = validateEServiceDescriptorsToDisassociate(
    validEservices,
    validEServiceDescriptorPurposeTemplates
  );

  if (descriptorValidationIssues.length > 0) {
    return invalidPurposeTemplateResult(descriptorValidationIssues);
  }

  return validPurposeTemplateResult(validEServiceDescriptorPairs);
}

export function hasRoleToAccessDraftPurposeTemplates(
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): boolean {
  return (
    hasAtLeastOneUserRole(authData, [
      userRole.ADMIN_ROLE,
      userRole.API_ROLE,
      userRole.SUPPORT_ROLE,
    ]) ||
    hasAtLeastOneSystemRole(authData, [
      systemRole.M2M_ADMIN_ROLE,
      systemRole.M2M_ROLE,
    ])
  );
}
