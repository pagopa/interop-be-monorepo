import { catalogApi } from "pagopa-interop-api-clients";
import {
  M2MAuthData,
  RiskAnalysisValidatedForm,
  UIAuthData,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  Descriptor,
  DescriptorState,
  EService,
  EServiceId,
  Tenant,
  TenantId,
  TenantKind,
  delegationKind,
  delegationState,
  descriptorState,
  eserviceMode,
  operationForbidden,
  EServiceTemplateId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  draftDescriptorAlreadyExists,
  eServiceNameDuplicate,
  eServiceRiskAnalysisIsRequired,
  eserviceNotInDraftState,
  eserviceNotInReceiveMode,
  eserviceWithActiveOrPendingDelegation,
  notValidDescriptorState,
  riskAnalysisNotValid,
  riskAnalysisValidationFailed,
  tenantKindNotFound,
  templateInstanceNotAllowed,
  eServiceNotAnInstance,
  inconsistentDailyCalls,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

export function descriptorStatesNotAllowingDocumentOperations(
  descriptor: Descriptor
): boolean {
  return match(descriptor.state)
    .with(
      descriptorState.draft,
      descriptorState.deprecated,
      descriptorState.published,
      descriptorState.suspended,
      () => false
    )
    .with(
      descriptorState.archived,
      descriptorState.waitingForApproval,
      () => true
    )
    .exhaustive();
}

export const notActiveDescriptorState: DescriptorState[] = [
  descriptorState.draft,
  descriptorState.waitingForApproval,
];

export const validDescriptorStates: DescriptorState[] = [
  descriptorState.published,
  descriptorState.suspended,
  descriptorState.deprecated,
  descriptorState.archived,
];

export function isNotActiveDescriptor(descriptor: Descriptor): boolean {
  return match(descriptor.state)
    .with(descriptorState.draft, descriptorState.waitingForApproval, () => true)
    .with(
      descriptorState.archived,
      descriptorState.deprecated,
      descriptorState.published,
      descriptorState.suspended,
      () => false
    )
    .exhaustive();
}

export function isActiveDescriptor(descriptor: Descriptor): boolean {
  return !isNotActiveDescriptor(descriptor);
}

export function isDescriptorUpdatable(descriptor: Descriptor): boolean {
  return match(descriptor.state)
    .with(
      descriptorState.deprecated,
      descriptorState.published,
      descriptorState.suspended,
      () => true
    )
    .with(
      descriptorState.draft,
      descriptorState.waitingForApproval,
      descriptorState.archived,
      () => false
    )
    .exhaustive();
}

export async function assertRequesterIsDelegateProducerOrProducer(
  producerId: TenantId,
  eserviceId: EServiceId,
  authData: UIAuthData | M2MAuthData,
  readModelService: ReadModelService
): Promise<void> {
  // Search for active producer delegation
  const producerDelegation = await readModelService.getLatestDelegation({
    eserviceId,
    kind: delegationKind.delegatedProducer,
    states: [delegationState.active],
  });

  // If an active producer delegation exists, check if the requester is the delegate
  if (producerDelegation) {
    const isRequesterDelegateProducer =
      authData.organizationId === producerDelegation.delegateId;

    if (!isRequesterDelegateProducer) {
      throw operationForbidden;
    }
  } else {
    // If no active producer delegation exists, ensure the requester is the producer
    assertRequesterIsProducer(producerId, authData);
  }
}

export function assertRequesterIsProducer(
  producerId: TenantId,
  authData: UIAuthData | M2MAuthData
): void {
  if (producerId !== authData.organizationId) {
    throw operationForbidden;
  }
}

export async function assertNoExistingProducerDelegationInActiveOrPendingState(
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<void> {
  const producerDelegation = await readModelService.getLatestDelegation({
    eserviceId,
    kind: delegationKind.delegatedProducer,
    states: [delegationState.active, delegationState.waitingForApproval],
  });

  if (producerDelegation) {
    throw eserviceWithActiveOrPendingDelegation(
      eserviceId,
      producerDelegation.id
    );
  }
}

export function assertIsDraftEservice(eservice: EService): void {
  if (eservice.descriptors.some((d) => d.state !== descriptorState.draft)) {
    throw eserviceNotInDraftState(eservice.id);
  }
}
export function assertIsDraftDescriptor(descriptor: Descriptor): void {
  if (descriptor.state !== descriptorState.draft) {
    throw notValidDescriptorState(descriptor.id, descriptor.state);
  }
}

export function assertIsReceiveEservice(eservice: EService): void {
  if (eservice.mode !== eserviceMode.receive) {
    throw eserviceNotInReceiveMode(eservice.id);
  }
}

export function assertTenantKindExists(
  tenant: Tenant
): asserts tenant is Tenant & { kind: NonNullable<Tenant["kind"]> } {
  if (tenant.kind === undefined) {
    throw tenantKindNotFound(tenant.id);
  }
}

export function assertHasNoDraftOrWaitingForApprovalDescriptor(
  eservice: EService
): void {
  const hasInvalidDescriptor = eservice.descriptors.some(isNotActiveDescriptor);
  if (hasInvalidDescriptor) {
    throw draftDescriptorAlreadyExists(eservice.id);
  }
}

export function validateRiskAnalysisSchemaOrThrow(
  riskAnalysisForm: catalogApi.EServiceRiskAnalysisSeed["riskAnalysisForm"],
  tenantKind: TenantKind
): RiskAnalysisValidatedForm {
  const result = validateRiskAnalysis(riskAnalysisForm, true, tenantKind);
  if (result.type === "invalid") {
    throw riskAnalysisValidationFailed(result.issues);
  } else {
    return result.value;
  }
}

export function assertRiskAnalysisIsValidForPublication(
  eservice: EService,
  tenantKind: TenantKind
): void {
  if (eservice.riskAnalysis.length === 0) {
    throw eServiceRiskAnalysisIsRequired(eservice.id);
  }

  eservice.riskAnalysis.forEach((riskAnalysis) => {
    const result = validateRiskAnalysis(
      riskAnalysisFormToRiskAnalysisFormToValidate(
        riskAnalysis.riskAnalysisForm
      ),
      false,
      tenantKind
    );

    if (result.type === "invalid") {
      throw riskAnalysisNotValid();
    }
  });
}

export function assertInterfaceDeletableDescriptorState(
  descriptor: Descriptor
): void {
  match(descriptor.state)
    .with(descriptorState.draft, () => void 0)
    .with(
      descriptorState.archived,
      descriptorState.deprecated,
      descriptorState.published,
      descriptorState.suspended,
      descriptorState.waitingForApproval,
      () => {
        throw notValidDescriptorState(descriptor.id, descriptor.state);
      }
    )
    .exhaustive();
}

export function assertDocumentDeletableDescriptorState(
  descriptor: Descriptor
): void {
  match(descriptor.state)
    .with(
      descriptorState.draft,
      descriptorState.deprecated,
      descriptorState.published,
      descriptorState.suspended,
      descriptorState.waitingForApproval,
      () => void 0
    )
    .with(descriptorState.archived, () => {
      throw notValidDescriptorState(descriptor.id, descriptor.state);
    })
    .exhaustive();
}

export async function assertNotDuplicatedEServiceName(
  name: string,
  eservice: EService,
  readModelService: ReadModelService
): Promise<void> {
  if (name !== eservice.name) {
    const eserviceWithSameName =
      await readModelService.getEServiceByNameAndProducerId({
        name,
        producerId: eservice.producerId,
      });
    if (eserviceWithSameName !== undefined) {
      throw eServiceNameDuplicate(name);
    }
  }
}

export function assertEServiceNotTemplateInstance(
  eserviceId: EServiceId,
  templateId: EServiceTemplateId | undefined
): void {
  if (templateId !== undefined) {
    throw templateInstanceNotAllowed(eserviceId, templateId);
  }
}

export function assertEServiceIsTemplateInstance(
  eservice: EService
): asserts eservice is EService & {
  templateId: EServiceTemplateId;
  descriptors: Array<
    Descriptor & {
      templateVersionRef: NonNullable<Descriptor["templateVersionRef"]>;
    }
  >;
} {
  if (eservice.templateId === undefined) {
    throw eServiceNotAnInstance(eservice.id);
  }
}

export function assertConsistentDailyCalls({
  dailyCallsPerConsumer,
  dailyCallsTotal,
}: {
  dailyCallsPerConsumer: number;
  dailyCallsTotal: number;
}): void {
  if (dailyCallsPerConsumer > dailyCallsTotal) {
    throw inconsistentDailyCalls();
  }
}

export function assertDescriptorUpdatable(descriptor: Descriptor): void {
  if (!isDescriptorUpdatable(descriptor)) {
    throw notValidDescriptorState(descriptor.id, descriptor.state.toString());
  }
}
