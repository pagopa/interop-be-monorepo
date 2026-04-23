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
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  EServiceTemplateVersionPurposeTemplate,
  EServiceTemplateVersionState,
  eserviceTemplateVersionState,
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
  TargetTenantKind,
  userRole,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { config } from "../config/config.js";
import {
  eserviceAlreadyAssociatedError,
  eserviceIsInstanceOfEServiceTemplateError,
  eserviceNotAssociatedError,
  eserviceNotFound,
  eserviceTemplateAlreadyAssociatedError,
  eserviceTemplateNotAssociatedError,
  eserviceTemplateNotFound,
  invalidDescriptorStateError,
  invalidDescriptorStateForPublicationError,
  invalidEServiceTemplateVersionStateError,
  invalidPurposeTemplateResult,
  missingDescriptorError,
  missingEServiceTemplateVersionError,
  purposeTemplateEServicePersonalDataFlagMismatch,
  purposeTemplateEServiceTemplatePersonalDataFlagMismatch,
  PurposeTemplateValidationIssue,
  PurposeTemplateValidationResult,
  unexpectedAssociationEServiceError,
  unexpectedAssociationEServiceTemplateError,
  unexpectedEServiceError,
  unexpectedEServiceTemplateError,
  unexpectedUnassociationEServiceError,
  unexpectedUnassociationEServiceTemplateError,
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
  associationBetweenEServiceTemplateAndPurposeTemplateAlreadyExists,
  associationBetweenEServiceTemplateAndPurposeTemplateDoesNotExist,
  associationEServicesForPurposeTemplateFailed,
  associationEServiceTemplatesForPurposeTemplateFailed,
  conflictDocumentPrettyNameDuplicate,
  conflictDuplicatedDocument,
  disassociationEServicesFromPurposeTemplateFailed,
  disassociationEServiceTemplatesFromPurposeTemplateFailed,
  hyperlinkDetectionError,
  invalidFreeOfChargeReason,
  missingFreeOfChargeReason,
  purposeTemplateTitleConflict,
  purposeTemplateNotInExpectedStates,
  purposeTemplateRiskAnalysisFormNotFound,
  purposeTemplateStateConflict,
  riskAnalysisTemplateAnswerNotFound,
  riskAnalysisTemplateValidationFailed,
  tooManyEServicesForPurposeTemplate,
  tooManyEServiceTemplatesForPurposeTemplate,
  purposeTemplateNotFound,
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

export const ALLOWED_ESERVICE_TEMPLATE_VERSION_STATES_FOR_PURPOSE_TEMPLATE_ASSOCIATION: EServiceTemplateVersionState[] =
  [eserviceTemplateVersionState.published];

export const ALLOWED_ESERVICE_TEMPLATE_VERSION_STATES_FOR_PURPOSE_TEMPLATE_DISASSOCIATION: EServiceTemplateVersionState[] =
  [
    eserviceTemplateVersionState.published,
    eserviceTemplateVersionState.suspended,
    eserviceTemplateVersionState.deprecated,
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
  freeOfChargeReason: string | undefined | null
): void => {
  if (isFreeOfCharge && !freeOfChargeReason) {
    throw missingFreeOfChargeReason();
  }

  if (!isFreeOfCharge && typeof freeOfChargeReason === "string") {
    throw invalidFreeOfChargeReason(isFreeOfCharge, freeOfChargeReason);
  }
};

export const assertPurposeTemplateTitleIsNotDuplicated = async ({
  readModelService,
  title,
}: {
  readModelService: ReadModelServiceSQL;
  title: string;
}): Promise<void> => {
  const purposeTemplatesWithSameTitle =
    await readModelService.getPurposeTemplatesByTitle(title);
  if (purposeTemplatesWithSameTitle.length > 0) {
    throw purposeTemplateTitleConflict(
      purposeTemplatesWithSameTitle.map((pt) => pt.data.id),
      title
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

export const assertEServiceTemplateIdsCountIsBelowThreshold = (
  eserviceTemplateIdsSize: number
): void => {
  if (eserviceTemplateIdsSize > config.maxEServiceTemplatesPerLinkRequest) {
    throw tooManyEServiceTemplatesForPurposeTemplate(
      eserviceTemplateIdsSize,
      config.maxEServiceTemplatesPerLinkRequest
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
  targetTenantKind: TargetTenantKind,
  personalDataInPurposeTemplate: boolean
): RiskAnalysisFormTemplate | undefined {
  if (!riskAnalysisFormTemplate) {
    return undefined;
  }

  const validatedForm = validateRiskAnalysisTemplateOrThrow({
    riskAnalysisFormTemplate,
    targetTenantKind,
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
  targetTenantKind,
  personalDataInPurposeTemplate,
}: {
  riskAnalysisFormTemplate: purposeTemplateApi.RiskAnalysisFormTemplateSeed;
  targetTenantKind: TargetTenantKind;
  personalDataInPurposeTemplate: boolean;
}): RiskAnalysisTemplateValidatedForm {
  const result = validatePurposeTemplateRiskAnalysis(
    toRiskAnalysisFormTemplateToValidate(riskAnalysisFormTemplate),
    targetTenantKind,
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
  targetTenantKind,
}: {
  riskAnalysisAnswer: purposeTemplateApi.RiskAnalysisTemplateAnswerRequest;
  targetTenantKind: TargetTenantKind;
}): RiskAnalysisTemplateValidatedSingleOrMultiAnswer {
  if (riskAnalysisAnswer.answerData.annotation) {
    validateRiskAnalysisAnswerAnnotationOrThrow(
      riskAnalysisAnswer.answerData.annotation.text
    );
  }

  const result = validateRiskAnalysisAnswer(
    riskAnalysisAnswer.answerKey,
    toRiskAnalysisTemplateAnswerToValidate(riskAnalysisAnswer.answerData),
    targetTenantKind
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
  purposeTemplateId: PurposeTemplateId,
  creatorId: TenantId,
  authData: Pick<UIAuthData | M2MAdminAuthData, "organizationId">
): void => {
  if (!isRequesterCreator(creatorId, authData)) {
    throw purposeTemplateNotFound(purposeTemplateId);
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

    if (
      !ALLOWED_DESCRIPTOR_STATES_FOR_PURPOSE_TEMPLATE_ESERVICE_DISASSOCIATION.includes(
        descriptor.state
      )
    ) {
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

  const {
    validationIssues: instanceOfTemplateIssues,
    validEservices: nonTemplateInstanceEservices,
  } = excludeEServiceInstancesOfTemplates(validEservices);

  if (instanceOfTemplateIssues.length > 0) {
    throw associationEServicesForPurposeTemplateFailed(
      instanceOfTemplateIssues,
      eserviceIds,
      purposeTemplate.id
    );
  }

  const associationValidationIssues = await validateEServiceAssociations(
    nonTemplateInstanceEservices,
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
  } = validateEServiceDescriptorsToAssociate(nonTemplateInstanceEservices);

  if (descriptorValidationIssues.length > 0) {
    return invalidPurposeTemplateResult(descriptorValidationIssues);
  }

  return validPurposeTemplateResult(validEServiceDescriptorPairs);
}

/**
 * Filter out e-services that are instances of an e-service template.
 * Link to a purpose template is not allowed for template-derived instances:
 * the link must target the originating e-service template instead.
 *
 * Applied only in the association (link) flow, NOT in disassociation (unlink),
 * to avoid blocking the unlink of entries that predate this validation.
 */
export function excludeEServiceInstancesOfTemplates(eservices: EService[]): {
  validationIssues: PurposeTemplateValidationIssue[];
  validEservices: EService[];
} {
  const validationIssues: PurposeTemplateValidationIssue[] = [];
  const validEservices: EService[] = [];

  eservices.forEach((eservice) => {
    if (eservice.templateId !== undefined) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        eserviceIsInstanceOfEServiceTemplateError(
          eservice.id,
          eservice.templateId
        )
      );
      return;
    }
    // eslint-disable-next-line functional/immutable-data
    validEservices.push(eservice);
  });

  return { validationIssues, validEservices };
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

/**
 * Validate the existence of e-service templates by their ids.
 * For each eservice template:
 * - Promise.fulfilled: return error if not found, or mismatch on the personalData flag
 * - Promise.rejected: return a validation issue
 * Finally, return the valid e-service templates and the validation issues.
 */
async function validateEServiceTemplateExistence(
  eserviceTemplateIds: EServiceTemplateId[],
  purposeTemplate: PurposeTemplate,
  readModelService: ReadModelServiceSQL
): Promise<{
  validationIssues: PurposeTemplateValidationIssue[];
  validEServiceTemplates: EServiceTemplate[];
}> {
  const results = await Promise.allSettled(
    eserviceTemplateIds.map(
      async (id) => await readModelService.getEServiceTemplateById(id)
    )
  );

  return results.reduce(
    (acc, result, index) =>
      match(result)
        .with({ status: "fulfilled" }, (res) => {
          if (!res.value) {
            return {
              ...acc,
              validationIssues: [
                ...acc.validationIssues,
                eserviceTemplateNotFound(eserviceTemplateIds[index]),
              ],
            };
          }

          if (res.value.personalData !== purposeTemplate.handlesPersonalData) {
            return {
              ...acc,
              validationIssues: [
                ...acc.validationIssues,
                purposeTemplateEServiceTemplatePersonalDataFlagMismatch(
                  res.value,
                  purposeTemplate
                ),
              ],
            };
          }

          return {
            ...acc,
            validEServiceTemplates: [...acc.validEServiceTemplates, res.value],
          };
        })
        .with({ status: "rejected" }, (res) => ({
          ...acc,
          validationIssues: [
            ...acc.validationIssues,
            unexpectedEServiceTemplateError(
              res.reason.message,
              eserviceTemplateIds[index]
            ),
          ],
        }))
        .exhaustive(),
    {
      validationIssues: new Array<PurposeTemplateValidationIssue>(),
      validEServiceTemplates: new Array<EServiceTemplate>(),
    }
  );
}

/**
 * For each valid e-service template, verify there's no pre-existing association
 * with the given purpose template.
 */
async function validateEServiceTemplateAssociations(
  validEServiceTemplates: EServiceTemplate[],
  purposeTemplateId: PurposeTemplateId,
  readModelService: ReadModelServiceSQL
): Promise<PurposeTemplateValidationIssue[]> {
  const associationResults = await Promise.allSettled(
    validEServiceTemplates.map(
      async (eserviceTemplate) =>
        await readModelService.getEServiceTemplateVersionPurposeTemplateByPurposeTemplateIdAndEServiceTemplateId(
          purposeTemplateId,
          eserviceTemplate.id
        )
    )
  );

  return associationResults.flatMap((result, index) => {
    if (result.status === "rejected") {
      throw unexpectedAssociationEServiceTemplateError(
        result.reason.message,
        validEServiceTemplates[index].id
      );
    }

    if (result.status === "fulfilled" && result.value !== undefined) {
      return [
        eserviceTemplateAlreadyAssociatedError(
          validEServiceTemplates[index].id,
          purposeTemplateId
        ),
      ];
    }
    return [];
  });
}

/**
 * For each e-service template, find the first version in an allowed state (Published).
 * Return `{eserviceTemplate, eserviceTemplateVersionId}` pairs for the valid ones, and
 * validation issues for templates without any acceptable version.
 */
function validateEServiceTemplateVersionsToAssociate(
  validEServiceTemplates: EServiceTemplate[]
): {
  validationIssues: PurposeTemplateValidationIssue[];
  validEServiceTemplateVersionPairs: Array<{
    eserviceTemplate: EServiceTemplate;
    eserviceTemplateVersionId: EServiceTemplateVersionId;
  }>;
} {
  const validationIssues: PurposeTemplateValidationIssue[] = [];
  const validEServiceTemplateVersionPairs: Array<{
    eserviceTemplate: EServiceTemplate;
    eserviceTemplateVersionId: EServiceTemplateVersionId;
  }> = [];

  validEServiceTemplates.forEach((eserviceTemplate) => {
    if (!eserviceTemplate.versions || eserviceTemplate.versions.length === 0) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        missingEServiceTemplateVersionError(eserviceTemplate.id)
      );
      return;
    }

    const validVersion = eserviceTemplate.versions.find((version) =>
      ALLOWED_ESERVICE_TEMPLATE_VERSION_STATES_FOR_PURPOSE_TEMPLATE_ASSOCIATION.includes(
        version.state
      )
    );

    if (!validVersion) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        invalidEServiceTemplateVersionStateError(
          eserviceTemplate.id,
          ALLOWED_ESERVICE_TEMPLATE_VERSION_STATES_FOR_PURPOSE_TEMPLATE_ASSOCIATION
        )
      );
      return;
    }

    // eslint-disable-next-line functional/immutable-data
    validEServiceTemplateVersionPairs.push({
      eserviceTemplate,
      eserviceTemplateVersionId: validVersion.id,
    });
  });

  return { validationIssues, validEServiceTemplateVersionPairs };
}

export async function validateEServiceTemplatesAssociations(
  eserviceTemplateIds: EServiceTemplateId[],
  purposeTemplate: PurposeTemplate,
  readModelService: ReadModelServiceSQL
): Promise<
  PurposeTemplateValidationResult<
    Array<{
      eserviceTemplate: EServiceTemplate;
      eserviceTemplateVersionId: EServiceTemplateVersionId;
    }>
  >
> {
  const { validationIssues, validEServiceTemplates } =
    await validateEServiceTemplateExistence(
      eserviceTemplateIds,
      purposeTemplate,
      readModelService
    );

  if (validationIssues.length > 0) {
    throw associationEServiceTemplatesForPurposeTemplateFailed(
      validationIssues,
      eserviceTemplateIds,
      purposeTemplate.id
    );
  }

  const associationValidationIssues =
    await validateEServiceTemplateAssociations(
      validEServiceTemplates,
      purposeTemplate.id,
      readModelService
    );

  if (associationValidationIssues.length > 0) {
    throw associationBetweenEServiceTemplateAndPurposeTemplateAlreadyExists(
      associationValidationIssues,
      eserviceTemplateIds,
      purposeTemplate.id
    );
  }

  const {
    validationIssues: versionValidationIssues,
    validEServiceTemplateVersionPairs,
  } = validateEServiceTemplateVersionsToAssociate(validEServiceTemplates);

  if (versionValidationIssues.length > 0) {
    return invalidPurposeTemplateResult(versionValidationIssues);
  }

  return validPurposeTemplateResult(validEServiceTemplateVersionPairs);
}

/**
 * Validate the existence of e-service templates in the disassociation flow.
 * Variant of `validateEServiceTemplateExistence` without the `personalData` check:
 * the purpose template's `handlesPersonalData` flag may drift after the link is
 * created (while the purpose template is still in Draft state), and blocking
 * the unlink on such drift would leave the creator unable to tear down the link.
 */
async function validateEServiceTemplateExistenceForDisassociation(
  eserviceTemplateIds: EServiceTemplateId[],
  readModelService: ReadModelServiceSQL
): Promise<{
  validationIssues: PurposeTemplateValidationIssue[];
  validEServiceTemplates: EServiceTemplate[];
}> {
  const results = await Promise.allSettled(
    eserviceTemplateIds.map(
      async (id) => await readModelService.getEServiceTemplateById(id)
    )
  );

  return results.reduce(
    (acc, result, index) =>
      match(result)
        .with({ status: "fulfilled" }, (res) => {
          if (!res.value) {
            return {
              ...acc,
              validationIssues: [
                ...acc.validationIssues,
                eserviceTemplateNotFound(eserviceTemplateIds[index]),
              ],
            };
          }

          return {
            ...acc,
            validEServiceTemplates: [...acc.validEServiceTemplates, res.value],
          };
        })
        .with({ status: "rejected" }, (res) => ({
          ...acc,
          validationIssues: [
            ...acc.validationIssues,
            unexpectedEServiceTemplateError(
              res.reason.message,
              eserviceTemplateIds[index]
            ),
          ],
        }))
        .exhaustive(),
    {
      validationIssues: new Array<PurposeTemplateValidationIssue>(),
      validEServiceTemplates: new Array<EServiceTemplate>(),
    }
  );
}

/**
 * For each valid e-service template, verify that a link with the given purpose
 * template exists in the readmodel. Return the existing links (to later resolve
 * the crystallised version id) and a validation issue for each missing link.
 */
async function validateEServiceTemplateDisassociations(
  validEServiceTemplates: EServiceTemplate[],
  purposeTemplateId: PurposeTemplateId,
  readModelService: ReadModelServiceSQL
): Promise<{
  validationIssues: PurposeTemplateValidationIssue[];
  validEServiceTemplateVersionPurposeTemplates: EServiceTemplateVersionPurposeTemplate[];
}> {
  const validationIssues: PurposeTemplateValidationIssue[] = [];
  const validEServiceTemplateVersionPurposeTemplates: EServiceTemplateVersionPurposeTemplate[] =
    [];

  const associationResults = await Promise.allSettled(
    validEServiceTemplates.map(
      async (eserviceTemplate) =>
        await readModelService.getEServiceTemplateVersionPurposeTemplateByPurposeTemplateIdAndEServiceTemplateId(
          purposeTemplateId,
          eserviceTemplate.id
        )
    )
  );

  associationResults.forEach((result, index) => {
    if (result.status === "rejected") {
      throw unexpectedUnassociationEServiceTemplateError(
        result.reason.message,
        validEServiceTemplates[index].id
      );
    }

    if (result.value === undefined) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        eserviceTemplateNotAssociatedError(
          validEServiceTemplates[index].id,
          purposeTemplateId
        )
      );
      return;
    }

    // eslint-disable-next-line functional/immutable-data
    validEServiceTemplateVersionPurposeTemplates.push(result.value);
  });

  return {
    validationIssues,
    validEServiceTemplateVersionPurposeTemplates,
  };
}

/**
 * Validate the crystallised version for each link.
 * For each `(eserviceTemplate, link)` pair:
 * - If the template has no versions, push `missingEServiceTemplateVersion`.
 * - If the crystallised `eserviceTemplateVersionId` is not found in the template
 *   versions, push `eserviceTemplateNotAssociated` (defensive).
 * - If the version state is not in
 *   `ALLOWED_ESERVICE_TEMPLATE_VERSION_STATES_FOR_PURPOSE_TEMPLATE_DISASSOCIATION`,
 *   push `invalidEServiceTemplateVersionState`.
 *
 * The state check mirrors AS-IS `validateEServiceDescriptorsToDisassociate`:
 * symmetric with the unlink flow for concrete e-services. Draft is excluded
 * defensively (not reachable from a normal flow, but kept for pattern parity).
 */
function validateEServiceTemplateVersionsToDisassociate(
  validEServiceTemplates: EServiceTemplate[],
  validEServiceTemplateVersionPurposeTemplates: EServiceTemplateVersionPurposeTemplate[]
): {
  validationIssues: PurposeTemplateValidationIssue[];
  validEServiceTemplateVersionPairs: Array<{
    eserviceTemplate: EServiceTemplate;
    eserviceTemplateVersionId: EServiceTemplateVersionId;
  }>;
} {
  const validationIssues: PurposeTemplateValidationIssue[] = [];
  const validEServiceTemplateVersionPairs: Array<{
    eserviceTemplate: EServiceTemplate;
    eserviceTemplateVersionId: EServiceTemplateVersionId;
  }> = [];

  validEServiceTemplateVersionPurposeTemplates.forEach((link) => {
    const eserviceTemplate = validEServiceTemplates.find(
      (t) => t.id === link.eserviceTemplateId
    );

    if (!eserviceTemplate) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        eserviceTemplateNotAssociatedError(
          link.eserviceTemplateId,
          link.purposeTemplateId
        )
      );
      return;
    }

    if (!eserviceTemplate.versions || eserviceTemplate.versions.length === 0) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        missingEServiceTemplateVersionError(eserviceTemplate.id)
      );
      return;
    }

    const version = eserviceTemplate.versions.find(
      (v) => v.id === link.eserviceTemplateVersionId
    );

    if (!version) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        eserviceTemplateNotAssociatedError(
          eserviceTemplate.id,
          link.purposeTemplateId
        )
      );
      return;
    }

    if (
      !ALLOWED_ESERVICE_TEMPLATE_VERSION_STATES_FOR_PURPOSE_TEMPLATE_DISASSOCIATION.includes(
        version.state
      )
    ) {
      // eslint-disable-next-line functional/immutable-data
      validationIssues.push(
        invalidEServiceTemplateVersionStateError(
          eserviceTemplate.id,
          ALLOWED_ESERVICE_TEMPLATE_VERSION_STATES_FOR_PURPOSE_TEMPLATE_DISASSOCIATION
        )
      );
      return;
    }

    // eslint-disable-next-line functional/immutable-data
    validEServiceTemplateVersionPairs.push({
      eserviceTemplate,
      eserviceTemplateVersionId: link.eserviceTemplateVersionId,
    });
  });

  return { validationIssues, validEServiceTemplateVersionPairs };
}

export async function validateEServiceTemplatesDisassociations(
  eserviceTemplateIds: EServiceTemplateId[],
  purposeTemplate: PurposeTemplate,
  readModelService: ReadModelServiceSQL
): Promise<
  PurposeTemplateValidationResult<
    Array<{
      eserviceTemplate: EServiceTemplate;
      eserviceTemplateVersionId: EServiceTemplateVersionId;
    }>
  >
> {
  const { validationIssues, validEServiceTemplates } =
    await validateEServiceTemplateExistenceForDisassociation(
      eserviceTemplateIds,
      readModelService
    );

  if (validationIssues.length > 0) {
    throw disassociationEServiceTemplatesFromPurposeTemplateFailed(
      validationIssues,
      eserviceTemplateIds,
      purposeTemplate.id
    );
  }

  const {
    validationIssues: disassociationValidationIssues,
    validEServiceTemplateVersionPurposeTemplates,
  } = await validateEServiceTemplateDisassociations(
    validEServiceTemplates,
    purposeTemplate.id,
    readModelService
  );

  if (disassociationValidationIssues.length > 0) {
    throw associationBetweenEServiceTemplateAndPurposeTemplateDoesNotExist(
      disassociationValidationIssues,
      eserviceTemplateIds,
      purposeTemplate.id
    );
  }

  const {
    validationIssues: versionValidationIssues,
    validEServiceTemplateVersionPairs,
  } = validateEServiceTemplateVersionsToDisassociate(
    validEServiceTemplates,
    validEServiceTemplateVersionPurposeTemplates
  );

  if (versionValidationIssues.length > 0) {
    return invalidPurposeTemplateResult(versionValidationIssues);
  }

  return validPurposeTemplateResult(validEServiceTemplateVersionPairs);
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
