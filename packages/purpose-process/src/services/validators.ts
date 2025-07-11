import {
  EService,
  EServiceMode,
  Purpose,
  PurposeVersion,
  PurposeRiskAnalysisForm,
  RiskAnalysisForm,
  TenantId,
  TenantKind,
  purposeVersionState,
  EServiceId,
  delegationKind,
  Delegation,
  delegationState,
  DelegationId,
} from "pagopa-interop-models";
import {
  validateRiskAnalysis,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  riskAnalysisValidatedFormToNewRiskAnalysisForm,
  UIAuthData,
  M2MAdminAuthData,
} from "pagopa-interop-commons";
import { purposeApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import {
  descriptorNotFound,
  duplicatedPurposeTitle,
  eServiceModeNotAllowed,
  missingFreeOfChargeReason,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegatedConsumer,
  tenantIsNotTheDelegatedProducer,
  tenantIsNotTheProducer,
  tenantNotAllowed,
  purposeNotInDraftState,
  riskAnalysisValidationFailed,
} from "../model/domain/errors.js";
import { Ownership, ownership } from "../model/domain/models.js";
import { ReadModelService } from "./readModelService.js";
import {
  retrieveActiveAgreement,
  retrievePurposeDelegation,
} from "./purposeService.js";

export const isRiskAnalysisFormValid = (
  riskAnalysisForm: RiskAnalysisForm | undefined,
  schemaOnlyValidation: boolean,
  tenantKind: TenantKind
): boolean => {
  if (riskAnalysisForm === undefined) {
    return false;
  } else {
    return (
      validateRiskAnalysis(
        riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm),
        schemaOnlyValidation,
        tenantKind
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
}: {
  riskAnalysisForm: purposeApi.RiskAnalysisFormSeed;
  schemaOnlyValidation: boolean;
  tenantKind: TenantKind;
}): RiskAnalysisValidatedForm {
  const result = validateRiskAnalysis(
    riskAnalysisForm,
    schemaOnlyValidation,
    tenantKind
  );
  if (result.type === "invalid") {
    throw riskAnalysisValidationFailed(result.issues);
  } else {
    return result.value;
  }
}

export function validateAndTransformRiskAnalysis(
  riskAnalysisForm: purposeApi.RiskAnalysisFormSeed | undefined,
  schemaOnlyValidation: boolean,
  tenantKind: TenantKind
): PurposeRiskAnalysisForm | undefined {
  if (!riskAnalysisForm) {
    return undefined;
  }
  const validatedForm = validateRiskAnalysisOrThrow({
    riskAnalysisForm,
    schemaOnlyValidation,
    tenantKind,
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
  readModelService: ReadModelService;
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
  readModelService: ReadModelService
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
  readModelService: ReadModelService
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
  readModelService: ReadModelService
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

export const getOrganizationRole = ({
  purpose,
  producerId,
  delegation,
  authData,
}: {
  purpose: Purpose;
  producerId: TenantId;
  delegation: Delegation | undefined;
  authData: UIAuthData | M2MAdminAuthData;
}): Ownership => {
  if (
    producerId === purpose.consumerId &&
    authData.organizationId === producerId
  ) {
    return ownership.SELF_CONSUMER;
  }

  if (delegation) {
    return match(delegation.kind)
      .with(delegationKind.delegatedProducer, () => {
        assertRequesterIsDelegateProducer(
          { id: purpose.eserviceId, producerId },
          authData,
          delegation
        );
        return ownership.PRODUCER;
      })
      .with(delegationKind.delegatedConsumer, () => {
        assertRequesterIsDelegateConsumer(purpose, authData, delegation);
        return ownership.CONSUMER;
      })
      .exhaustive();
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
