import { purposeApi } from "pagopa-interop-api-clients";
import {
  M2MAdminAuthData,
  Ownership,
  ownership,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  riskAnalysisValidatedFormToNewRiskAnalysisForm,
  UIAuthData,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  Delegation,
  DelegationId,
  delegationKind,
  delegationState,
  EService,
  EServiceId,
  EServiceMode,
  Purpose,
  PurposeRiskAnalysisForm,
  PurposeTemplate,
  PurposeTemplateId,
  PurposeVersion,
  purposeVersionState,
  RiskAnalysisForm,
  RiskAnalysisFormTemplate,
  RiskAnalysisTemplateAnswer,
  TenantId,
  tenantKind,
  TenantKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  descriptorNotFound,
  duplicatedPurposeTitle,
  eServiceModeNotAllowed,
  invalidPurposeTenantKind,
  missingFreeOfChargeReason,
  purposeNotInDraftState,
  riskAnalysisAnswerNotInSuggestValues,
  riskAnalysisContainsNotEditableAnswers,
  riskAnalysisMissingExpectedFieldError,
  riskAnalysisValidationFailed,
  riskAnalysisVersionMismatch,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegate,
  tenantIsNotTheDelegatedConsumer,
  tenantIsNotTheDelegatedProducer,
  tenantIsNotTheProducer,
  tenantNotAllowed,
} from "../model/domain/errors.js";
import {
  retrieveActiveAgreement,
  retrievePurposeDelegation,
} from "./purposeService.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const isRiskAnalysisFormValid = (
  riskAnalysisForm: RiskAnalysisForm | undefined,
  schemaOnlyValidation: boolean,
  tenantKind: TenantKind,
  dateForExpirationValidation: Date,
  personalDataInEService: boolean | undefined
): boolean => {
  if (riskAnalysisForm === undefined) {
    return false;
  } else {
    return (
      validateRiskAnalysis(
        riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm),
        schemaOnlyValidation,
        tenantKind,
        dateForExpirationValidation,
        personalDataInEService
      ).type === "valid"
    );
  }
};

export const purposeIsDraft = (purpose: Purpose): boolean =>
  !purpose.versions.some((v) => v.state !== purposeVersionState.draft);

export const purposeIsArchived = (purpose: Purpose): boolean =>
  !purpose.versions.some((v) => v.state !== purposeVersionState.archived);

export const isDeletableVersion = (
  purposeVersion: PurposeVersion,
  purpose: Purpose
): boolean =>
  purposeVersion.state === purposeVersionState.waitingForApproval &&
  purpose.versions.length !== 1;

export const isRejectable = (purposeVersion: PurposeVersion): boolean =>
  purposeVersion.state === purposeVersionState.waitingForApproval;

export const isClonable = (purpose: Purpose): boolean =>
  !purposeIsDraft(purpose) && !purposeIsArchived(purpose);

export const assertEserviceMode = (
  eservice: EService,
  expectedMode: EServiceMode
): void => {
  if (eservice.mode !== expectedMode) {
    throw eServiceModeNotAllowed(eservice.id, expectedMode);
  }
};

export const assertConsistentFreeOfCharge = (
  isFreeOfCharge: boolean,
  freeOfChargeReason: string | undefined
): void => {
  if (isFreeOfCharge && !freeOfChargeReason) {
    throw missingFreeOfChargeReason();
  }
};

const assertRequesterIsConsumer = (
  purpose: Pick<Purpose, "consumerId">,
  authData: Pick<UIAuthData, "organizationId">
): void => {
  if (authData.organizationId !== purpose.consumerId) {
    throw tenantIsNotTheConsumer(authData.organizationId);
  }
};

export function validateRiskAnalysisOrThrow({
  riskAnalysisForm,
  schemaOnlyValidation,
  tenantKind,
  dateForExpirationValidation,
  personalDataInEService,
}: {
  riskAnalysisForm: purposeApi.RiskAnalysisFormSeed;
  schemaOnlyValidation: boolean;
  tenantKind: TenantKind;
  dateForExpirationValidation: Date;
  personalDataInEService: boolean | undefined;
}): RiskAnalysisValidatedForm {
  const result = validateRiskAnalysis(
    riskAnalysisForm,
    schemaOnlyValidation,
    tenantKind,
    dateForExpirationValidation,
    personalDataInEService
  );
  return match(result)
    .with({ type: "invalid" }, ({ issues }) => {
      throw riskAnalysisValidationFailed(issues);
    })
    .with({ type: "valid" }, ({ value }) => value)
    .exhaustive();
}

export function validateAndTransformRiskAnalysis(
  riskAnalysisForm: purposeApi.RiskAnalysisFormSeed | undefined,
  schemaOnlyValidation: boolean,
  tenantKind: TenantKind,
  dateForExpirationValidation: Date,
  personalDataInEService: boolean | undefined
): PurposeRiskAnalysisForm | undefined {
  if (!riskAnalysisForm) {
    return undefined;
  }
  const validatedForm = validateRiskAnalysisOrThrow({
    riskAnalysisForm,
    schemaOnlyValidation,
    tenantKind,
    dateForExpirationValidation,
    personalDataInEService,
  });

  return {
    ...riskAnalysisValidatedFormToNewRiskAnalysisForm(validatedForm),
    riskAnalysisId: undefined,
  };
}

export function assertPurposeIsDraft(purpose: Purpose): void {
  if (!purposeIsDraft(purpose)) {
    throw purposeNotInDraftState(purpose.id);
  }
}

export const isDeletable = (purpose: Purpose): boolean =>
  purpose.versions.every(
    (v) =>
      v.state === purposeVersionState.draft ||
      v.state === purposeVersionState.waitingForApproval
  );

export const isArchivable = (purposeVersion: PurposeVersion): boolean =>
  purposeVersion.state === purposeVersionState.active ||
  purposeVersion.state === purposeVersionState.suspended;

export const isSuspendable = (purposeVersion: PurposeVersion): boolean =>
  purposeVersion.state === purposeVersionState.active ||
  purposeVersion.state === purposeVersionState.suspended;

export const assertPurposeTitleIsNotDuplicated = async ({
  readModelService,
  eserviceId,
  consumerId,
  title,
}: {
  readModelService: ReadModelServiceSQL;
  eserviceId: EServiceId;
  consumerId: TenantId;
  title: string;
}): Promise<void> => {
  const purposeWithSameName = await readModelService.getPurpose(
    eserviceId,
    consumerId,
    title
  );

  if (purposeWithSameName) {
    throw duplicatedPurposeTitle(title);
  }
};

export async function isOverQuota(
  eservice: EService,
  purpose: Purpose,
  dailyCalls: number,
  readModelService: ReadModelServiceSQL
): Promise<boolean> {
  const allPurposes = await readModelService.getAllPurposes({
    eservicesIds: [eservice.id],
    states: [purposeVersionState.active],
    excludeDraft: true,
  });

  const consumerPurposes = allPurposes.filter(
    (p) => p.consumerId === purpose.consumerId
  );

  const agreement = await retrieveActiveAgreement(
    eservice.id,
    purpose.consumerId,
    readModelService
  );

  const getActiveVersions = (purposes: Purpose[]): PurposeVersion[] =>
    purposes
      .flatMap((p) => p.versions)
      .filter((v) => v.state === purposeVersionState.active);

  const consumerActiveVersions = getActiveVersions(consumerPurposes);
  const allPurposesActiveVersions = getActiveVersions(allPurposes);

  const aggregateDailyCalls = (versions: PurposeVersion[]): number =>
    versions.reduce((acc, v) => acc + v.dailyCalls, 0);

  const consumerLoadRequestsSum = aggregateDailyCalls(consumerActiveVersions);
  const allPurposesRequestsSum = aggregateDailyCalls(allPurposesActiveVersions);

  const currentDescriptor = eservice.descriptors.find(
    (d) => d.id === agreement.descriptorId
  );

  if (!currentDescriptor) {
    throw descriptorNotFound(eservice.id, agreement.descriptorId);
  }

  const maxDailyCallsPerConsumer = currentDescriptor.dailyCallsPerConsumer;
  const maxDailyCallsTotal = currentDescriptor.dailyCallsTotal;

  return !(
    consumerLoadRequestsSum + dailyCalls <= maxDailyCallsPerConsumer &&
    allPurposesRequestsSum + dailyCalls <= maxDailyCallsTotal
  );
}

export const assertRequesterCanRetrievePurpose = async (
  purpose: Purpose,
  eservice: EService,
  authData: Pick<UIAuthData, "organizationId">,
  readModelService: ReadModelServiceSQL
): Promise<void> => {
  // This validator is for retrieval operations that can be performed by all the tenants involved:
  // the consumer, the producer, the consumer delegate, and the producer delegate.
  // Consumers and producers can retrieve purposes even if delegations exist.
  try {
    assertRequesterIsConsumer(purpose, authData);
  } catch {
    try {
      assertRequesterIsProducer(eservice, authData);
    } catch {
      try {
        assertRequesterIsDelegateProducer(
          eservice,
          authData,
          await readModelService.getActiveProducerDelegationByEserviceId(
            purpose.eserviceId
          )
        );
      } catch {
        try {
          assertRequesterIsDelegateConsumer(
            purpose,
            authData,
            await retrievePurposeDelegation(purpose, readModelService)
          );
        } catch {
          throw tenantNotAllowed(authData.organizationId);
        }
      }
    }
  }
};

const assertRequesterIsProducer = (
  eservice: Pick<EService, "producerId">,
  authData: Pick<UIAuthData, "organizationId">
): void => {
  if (authData.organizationId !== eservice.producerId) {
    throw tenantIsNotTheProducer(authData.organizationId);
  }
};

const assertRequesterIsDelegateProducer = (
  eservice: Pick<EService, "producerId" | "id">,
  authData: Pick<UIAuthData, "organizationId">,
  activeProducerDelegation: Delegation | undefined
): void => {
  if (
    activeProducerDelegation?.delegateId !== authData.organizationId ||
    activeProducerDelegation?.delegatorId !== eservice.producerId ||
    activeProducerDelegation?.kind !== delegationKind.delegatedProducer ||
    activeProducerDelegation?.state !== delegationState.active ||
    activeProducerDelegation?.eserviceId !== eservice.id
  ) {
    throw tenantIsNotTheDelegatedProducer(
      authData.organizationId,
      activeProducerDelegation?.id
    );
  }
};

export const assertRequesterCanActAsProducer = (
  eservice: Pick<EService, "producerId" | "id">,
  authData: UIAuthData | M2MAdminAuthData,
  activeProducerDelegation: Delegation | undefined
): void => {
  if (!activeProducerDelegation) {
    // No active producer delegation, the requester is authorized only if they are the producer
    assertRequesterIsProducer(eservice, authData);
  } else {
    // Active producer delegation, the requester is authorized only if they are the delegate
    assertRequesterIsDelegateProducer(
      eservice,
      authData,
      activeProducerDelegation
    );
  }
};

export const assertRequesterCanActAsConsumer = (
  purpose: Pick<Purpose, "consumerId" | "eserviceId">,
  authData: UIAuthData | M2MAdminAuthData,
  activeConsumerDelegation: Delegation | undefined
): void => {
  if (!activeConsumerDelegation) {
    // No active consumer delegation, the requester is authorized only if they are the consumer
    assertRequesterIsConsumer(purpose, authData);
  } else {
    // Active consumer delegation, the requester is authorized only if they are the delegate
    assertRequesterIsDelegateConsumer(
      purpose,
      authData,
      activeConsumerDelegation
    );
  }
};

const assertRequesterIsDelegateConsumer = (
  purpose: Pick<Purpose, "consumerId" | "eserviceId" | "delegationId">,
  authData: Pick<UIAuthData, "organizationId">,
  activeConsumerDelegation: Delegation | undefined
): void => {
  if (
    activeConsumerDelegation?.delegateId !== authData.organizationId ||
    activeConsumerDelegation?.delegatorId !== purpose.consumerId ||
    activeConsumerDelegation?.eserviceId !== purpose.eserviceId ||
    activeConsumerDelegation?.kind !== delegationKind.delegatedConsumer ||
    activeConsumerDelegation?.state !== delegationState.active ||
    purpose.delegationId !== activeConsumerDelegation?.id
  ) {
    throw tenantIsNotTheDelegatedConsumer(
      authData.organizationId,
      activeConsumerDelegation?.id
    );
  }
};

export const verifyRequesterIsConsumerOrDelegateConsumer = async (
  consumerId: TenantId,
  eserviceId: EServiceId,
  authData: UIAuthData | M2MAdminAuthData,
  readModelService: ReadModelServiceSQL
): Promise<DelegationId | undefined> => {
  try {
    assertRequesterIsConsumer(
      {
        consumerId,
      },
      authData
    );
    return undefined;
  } catch {
    const consumerDelegation =
      await readModelService.getActiveConsumerDelegationByEserviceAndConsumerIds(
        {
          eserviceId,
          consumerId,
        }
      );

    if (!consumerDelegation) {
      throw tenantIsNotTheConsumer(authData.organizationId);
    }

    assertRequesterIsDelegateConsumer(
      {
        consumerId,
        eserviceId,
        delegationId: consumerDelegation.id,
      },
      authData,
      consumerDelegation
    );

    return consumerDelegation?.id;
  }
};

export const getOrganizationRole = async ({
  purpose,
  producerId,
  delegationId,
  readModelService,
  authData,
}: {
  purpose: Purpose;
  producerId: TenantId;
  delegationId: DelegationId | undefined;
  readModelService: ReadModelServiceSQL;
  authData: UIAuthData | M2MAdminAuthData;
}): Promise<Ownership> => {
  if (
    producerId === purpose.consumerId &&
    authData.organizationId === producerId
  ) {
    return ownership.SELF_CONSUMER;
  }

  const [producerDelegation, consumerDelegation] = await Promise.all([
    readModelService.getActiveProducerDelegationByEserviceId(
      purpose.eserviceId
    ),
    retrievePurposeDelegation(purpose, readModelService),
  ]);

  if (delegationId) {
    if (delegationId === consumerDelegation?.id) {
      assertRequesterIsDelegateConsumer(purpose, authData, consumerDelegation);
      return ownership.CONSUMER;
    } else if (delegationId === producerDelegation?.id) {
      assertRequesterIsDelegateProducer(
        { id: purpose.eserviceId, producerId },
        authData,
        producerDelegation
      );
      return ownership.PRODUCER;
    } else {
      throw tenantIsNotTheDelegate(authData.organizationId);
    }
  }

  const hasDelegation =
    (authData.organizationId === purpose.consumerId && consumerDelegation) ||
    (authData.organizationId === producerId && producerDelegation);

  if (hasDelegation) {
    throw tenantIsNotTheDelegate(authData.organizationId);
  }

  try {
    assertRequesterIsProducer({ producerId }, authData);
    return ownership.PRODUCER;
  } catch {
    try {
      assertRequesterIsConsumer(purpose, authData);
      return ownership.CONSUMER;
    } catch {
      throw tenantNotAllowed(authData.organizationId);
    }
  }
};

export function assertValidPurposeTenantKind(
  purposeTenantKind: TenantKind,
  templateTargetTenantKind: TenantKind
): void {
  const privateTenantKinds: TenantKind[] = [
    tenantKind.GSP,
    tenantKind.SCP,
    tenantKind.PRIVATE,
  ];
  const valid = match(purposeTenantKind)
    .with(tenantKind.PA, () => templateTargetTenantKind === tenantKind.PA)
    .with(tenantKind.PRIVATE, tenantKind.GSP, tenantKind.SCP, () =>
      privateTenantKinds.includes(templateTargetTenantKind)
    )
    .exhaustive();

  if (!valid) {
    throw invalidPurposeTenantKind(purposeTenantKind, templateTargetTenantKind);
  }
}

function buildSingleOrMultiAnswerValue(
  templateId: PurposeTemplateId,
  { answer: templateAnswer, type }: RiskAnalysisTemplateAnswer,
  riskAnalysisForm: purposeApi.RiskAnalysisFormSeed
): string[] {
  const answerSeed = riskAnalysisForm.answers[templateAnswer.key];
  const isSingleAnswer = type === "single";
  const isEditable = templateAnswer.editable;
  const hasSuggestions =
    isSingleAnswer && templateAnswer.suggestedValues.length > 0;

  if (!answerSeed) {
    // Editable Answer or Single Answer with Suggestions must provide answer
    if (isEditable || hasSuggestions) {
      throw riskAnalysisMissingExpectedFieldError(templateAnswer.key);
    }

    // Answer is taken from template
    return isSingleAnswer
      ? templateAnswer.value
        ? [templateAnswer.value]
        : []
      : templateAnswer.values;
  }

  if (!isEditable) {
    if (
      // Not Editable Multi Answer must not provide answer value
      !isSingleAnswer ||
      // Not Editable Single Answer without suggestion must not provide answer value
      !hasSuggestions
    ) {
      throw riskAnalysisContainsNotEditableAnswers(
        templateId,
        templateAnswer.key
      );
    }

    // Not Editable Single Answer with suggestion must provide one of them
    if (
      hasSuggestions &&
      answerSeed.some(
        (v: string) => !templateAnswer.suggestedValues.includes(v)
      )
    ) {
      throw riskAnalysisAnswerNotInSuggestValues(
        templateId,
        templateAnswer.key
      );
    }
  }

  // Editable Answer or Single Answer with Suggestion is taken from body
  return answerSeed;
}

function buildAnswersSeed(
  id: PurposeTemplateId,
  riskAnalysisFormTemplate: RiskAnalysisFormTemplate,
  riskAnalysisFormSeed: purposeApi.RiskAnalysisFormSeed
): Record<string, string[]> {
  const singleAnswers = riskAnalysisFormTemplate.singleAnswers.reduce(
    (acc, templateAnswer) => ({
      ...acc,
      [templateAnswer.key]: buildSingleOrMultiAnswerValue(
        id,
        {
          type: "single",
          answer: templateAnswer,
        },
        riskAnalysisFormSeed
      ),
    }),
    {}
  );

  const multiAnswers = riskAnalysisFormTemplate.multiAnswers.reduce(
    (acc, templateAnswer) => ({
      ...acc,
      [templateAnswer.key]: buildSingleOrMultiAnswerValue(
        id,
        {
          type: "multi",
          answer: templateAnswer,
        },
        riskAnalysisFormSeed
      ),
    }),
    {}
  );

  return {
    ...singleAnswers,
    ...multiAnswers,
  };
}

export function validateRiskAnalysisAgainstTemplateOrThrow(
  purposeTemplate: PurposeTemplate,
  riskAnalysisForm: purposeApi.RiskAnalysisFormSeed | undefined,
  tenantKind: TenantKind,
  createdAt: Date,
  eservicePersonalData: boolean | undefined
): PurposeRiskAnalysisForm | undefined {
  if (!purposeTemplate.purposeRiskAnalysisForm || !riskAnalysisForm) {
    return undefined;
  }

  if (
    purposeTemplate.purposeRiskAnalysisForm.version !== riskAnalysisForm.version
  ) {
    throw riskAnalysisVersionMismatch(
      riskAnalysisForm.version,
      purposeTemplate.purposeRiskAnalysisForm.version
    );
  }

  const answersToSeed = buildAnswersSeed(
    purposeTemplate.id,
    purposeTemplate.purposeRiskAnalysisForm,
    riskAnalysisForm
  );

  const formToValidate: purposeApi.RiskAnalysisFormSeed = {
    version: purposeTemplate.purposeRiskAnalysisForm.version,
    answers: answersToSeed,
  };

  return validateAndTransformRiskAnalysis(
    formToValidate,
    false,
    tenantKind,
    createdAt,
    eservicePersonalData
  );
}
