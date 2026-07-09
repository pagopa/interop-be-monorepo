import {
  InternalAuthData,
  M2MAdminAuthData,
  M2MAuthData,
  RiskAnalysisFormToValidate,
  RiskAnalysisValidatedForm,
  UIAuthData,
  hasAtLeastOneSystemRole,
  hasAtLeastOneUserRole,
  isFeatureFlagEnabled,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  systemRole,
  userRole,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  archivingScope,
  AsyncExchangeProperties,
  AttributeId,
  Delegation,
  delegationKind,
  delegationState,
  Descriptor,
  DescriptorId,
  descriptorState,
  DescriptorState,
  EService,
  EServiceId,
  eserviceMode,
  EServiceTemplateId,
  getEServiceAttributeDiscreteConfig,
  operationForbidden,
  RiskAnalysisId,
  technology,
  Technology,
  Tenant,
  TenantId,
  tenantKind,
  TenantKind,
  type EserviceAttributes,
  type EServiceCertifiedAttribute,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { config } from "../config/config.js";
import {
  draftDescriptorAlreadyExists,
  eServiceNameDuplicateForProducer,
  eServiceRiskAnalysisIsRequired,
  invalidDelegationFlags,
  eserviceNotInDraftState,
  eserviceNotInReceiveMode,
  eserviceWithActiveOrPendingDelegation,
  eserviceDescriptorWithActiveOrPendingDelegation,
  eserviceArchivingWithActiveOrPendingDelegation,
  notValidDescriptorState,
  riskAnalysisNotValid,
  riskAnalysisValidationFailed,
  tenantKindNotFound,
  templateInstanceNotAllowed,
  eServiceNotAnInstance,
  inconsistentDailyCalls,
  eserviceWithoutValidDescriptors,
  eserviceTemplateNameConflict,
  eServiceUpdateSameDescriptionConflict,
  eServiceUpdateSameNameConflict,
  missingAsyncExchangeProperties,
  missingAsyncExchangeCallbackInterface,
  asyncExchangeBulkNotAllowedForSoap,
  riskAnalysisTenantKindMismatch,
  attributeDailyCallsNotAllowed,
  attributeDiscreteConfigNotAllowed,
  certifiedDiscreteAttributeConfigCannotBeChanged,
  eserviceInArchivingOrArchivedState,
  descriptorArchivingNotCancelableByScope,
  notValidEServiceState,
  descriptorAlreadyArchived,
  eserviceInDraftState,
  eserviceNotInArchiving,
  eServiceAlreadyArchived,
} from "../model/domain/errors.js";
import type { ReadModelServiceSQL } from "./readModelServiceTypes.js";
import {
  getLatestActiveDescriptor,
  getLatestDescriptor,
} from "../utilities/versionGenerator.js";
import { catalogApi } from "pagopa-interop-api-clients";

export function descriptorStatesNotAllowingDocumentOperations(
  descriptor: Descriptor
): boolean {
  return match(descriptor.state)
    .with(
      descriptorState.draft,
      descriptorState.deprecated,
      descriptorState.published,
      descriptorState.suspended,
      descriptorState.archiving,
      descriptorState.archivingSuspended,
      () => false
    )
    .with(
      descriptorState.archived,
      descriptorState.waitingForApproval,
      () => true
    )
    .exhaustive();
}

export function descriptorStatesNotAllowingInterfaceOperations(
  descriptor: Descriptor
): boolean {
  return match(descriptor.state)
    .with(descriptorState.draft, () => false)
    .otherwise(() => true);
}

function isNotActiveDescriptor(descriptor: Descriptor): boolean {
  return match(descriptor.state)
    .with(descriptorState.draft, descriptorState.waitingForApproval, () => true)
    .with(
      descriptorState.archived,
      descriptorState.deprecated,
      descriptorState.published,
      descriptorState.suspended,
      descriptorState.archiving,
      descriptorState.archivingSuspended,

      () => false
    )
    .exhaustive();
}

export function isActiveDescriptor(descriptor: Descriptor): boolean {
  return !isNotActiveDescriptor(descriptor);
}

function isDescriptorUpdatableAfterPublish(descriptor: Descriptor): boolean {
  return match(descriptor.state)
    .with(
      descriptorState.deprecated,
      descriptorState.published,
      descriptorState.suspended,
      descriptorState.archiving,
      descriptorState.archivingSuspended,
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

function isEserviceArchivable(eservice: EService): boolean {
  const latestActiveDescriptor = getLatestActiveDescriptor(eservice);
  return match(latestActiveDescriptor.state)
    .with(descriptorState.published, descriptorState.suspended, () => true)
    .with(
      descriptorState.deprecated,
      descriptorState.waitingForApproval,
      descriptorState.archived,
      descriptorState.archiving,
      descriptorState.archivingSuspended,
      descriptorState.draft,
      () => false
    )
    .exhaustive();
}

function isDescriptorArchivable(
  descriptor: Descriptor,
  eservice: EService
): boolean {
  const latestDescriptor = getLatestDescriptor(eservice);
  const isLatest = latestDescriptor.id === descriptor.id;

  return match(descriptor.state)
    .with(descriptorState.deprecated, () => true)
    .with(descriptorState.suspended, () => !isLatest)
    .with(
      descriptorState.draft,
      descriptorState.published,
      descriptorState.waitingForApproval,
      descriptorState.archived,
      descriptorState.archiving,
      descriptorState.archivingSuspended,
      () => false
    )
    .exhaustive();
}

export async function assertRequesterIsDelegateProducerOrProducer(
  producerId: TenantId,
  eserviceId: EServiceId,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData,
  readModelService: ReadModelServiceSQL
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
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): void {
  if (producerId !== authData.organizationId) {
    throw operationForbidden;
  }
}

async function getActiveOrPendingProducerDelegation(
  eserviceId: EServiceId,
  readModelService: ReadModelServiceSQL
): Promise<Delegation | undefined> {
  return readModelService.getLatestDelegation({
    eserviceId,
    kind: delegationKind.delegatedProducer,
    states: [delegationState.active, delegationState.waitingForApproval],
  });
}

export async function assertNoExistingProducerDelegationInActiveOrPendingState(
  eserviceId: EServiceId,
  readModelService: ReadModelServiceSQL
): Promise<void> {
  const producerDelegation = await getActiveOrPendingProducerDelegation(
    eserviceId,
    readModelService
  );

  if (producerDelegation) {
    throw eserviceWithActiveOrPendingDelegation(
      eserviceId,
      producerDelegation.id
    );
  }
}

export async function assertNoExistingProducerDelegationForDescriptorArchiving(
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  readModelService: ReadModelServiceSQL
): Promise<void> {
  const producerDelegation = await getActiveOrPendingProducerDelegation(
    eserviceId,
    readModelService
  );

  if (producerDelegation) {
    throw eserviceDescriptorWithActiveOrPendingDelegation(
      eserviceId,
      descriptorId,
      producerDelegation.id
    );
  }
}

export async function assertNoExistingProducerDelegationForEServiceArchiving(
  eserviceId: EServiceId,
  readModelService: ReadModelServiceSQL
): Promise<void> {
  const producerDelegation = await getActiveOrPendingProducerDelegation(
    eserviceId,
    readModelService
  );

  if (producerDelegation) {
    throw eserviceArchivingWithActiveOrPendingDelegation(
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

export function assertIsNotDraftEservice(eservice: EService): void {
  if (eservice.descriptors.every((d) => d.state === descriptorState.draft)) {
    throw eserviceInDraftState(eservice.id);
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

export function assertValidDelegationFlags(
  isConsumerDelegable: boolean | undefined,
  isClientAccessDelegable: boolean | undefined
): void {
  if (isConsumerDelegable === false && isClientAccessDelegable === true) {
    throw invalidDelegationFlags(isConsumerDelegable, isClientAccessDelegable);
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
  riskAnalysisForm: RiskAnalysisFormToValidate,
  fallbackTenantKind: TenantKind,
  dateForExpirationValidation: Date,
  personalDataInEService: boolean | undefined
): RiskAnalysisValidatedForm {
  const result = validateRiskAnalysis(
    riskAnalysisForm,
    true,
    fallbackTenantKind,
    dateForExpirationValidation,
    personalDataInEService
  );
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

  const firstPublishedAt = eservice.descriptors.find(
    (d) => d.publishedAt !== undefined
  )?.publishedAt;

  const dateForRiskAnalysisValidation = firstPublishedAt ?? new Date();

  eservice.riskAnalysis.forEach((riskAnalysis) => {
    if (isFeatureFlagEnabled(config, "featureFlagTenantKindInRiskAnalysis")) {
      assertRiskAnalysisTenantKindMatch({
        actualKind: riskAnalysis.riskAnalysisForm.tenantKind,
        currentTenantKind: tenantKind,
        eserviceId: eservice.id,
        riskAnalysisId: riskAnalysis.id,
      });
    }
    const result = validateRiskAnalysis(
      riskAnalysisFormToRiskAnalysisFormToValidate(
        riskAnalysis.riskAnalysisForm
      ),
      false,
      tenantKind,
      dateForRiskAnalysisValidation,
      eservice.personalData
    );

    if (result.type === "invalid") {
      throw riskAnalysisNotValid();
    }
  });
}

function assertRiskAnalysisTenantKindMatch({
  actualKind,
  currentTenantKind,
  eserviceId,
  riskAnalysisId,
}: {
  actualKind: TenantKind | undefined;
  currentTenantKind: TenantKind;
  eserviceId: EServiceId;
  riskAnalysisId: RiskAnalysisId;
}): void {
  const mapKindToKindForRA = (kind: TenantKind): TenantKind =>
    match(kind)
      .with(tenantKind.PA, () => tenantKind.PA)
      .otherwise(() => tenantKind.PRIVATE);

  if (
    actualKind &&
    mapKindToKindForRA(actualKind) !== mapKindToKindForRA(currentTenantKind)
  ) {
    throw riskAnalysisTenantKindMismatch(
      actualKind,
      currentTenantKind,
      eserviceId,
      riskAnalysisId
    );
  }
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
      descriptorState.archiving,
      descriptorState.archivingSuspended,
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
      descriptorState.archiving,
      descriptorState.archivingSuspended,
      () => void 0
    )
    .with(descriptorState.archived, () => {
      throw notValidDescriptorState(descriptor.id, descriptor.state);
    })
    .exhaustive();
}

export async function assertEServiceNameAvailableForProducer(
  name: string,
  producerId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<void> {
  const isEServiceNameAvailable =
    await readModelService.isEServiceNameAvailableForProducer({
      name,
      producerId,
    });
  if (!isEServiceNameAvailable) {
    throw eServiceNameDuplicateForProducer(name, producerId);
  }
}

export async function assertEServiceNameNotConflictingWithTemplate(
  name: string,
  readModelService: ReadModelServiceSQL
): Promise<void> {
  const eserviceTemplateWithSameNameExists =
    await readModelService.isEServiceNameConflictingWithTemplate({
      name,
    });
  if (eserviceTemplateWithSameNameExists) {
    throw eserviceTemplateNameConflict(name);
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
  descriptors: (Descriptor & {
    templateVersionRef: NonNullable<Descriptor["templateVersionRef"]>;
  })[];
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

export function assertDescriptorUpdatableAfterPublish(
  descriptor: Descriptor
): void {
  if (!isDescriptorUpdatableAfterPublish(descriptor)) {
    throw notValidDescriptorState(descriptor.id, descriptor.state);
  }
}

export function assertEServiceUpdatableAfterPublish(eservice: EService): void {
  const hasValidDescriptor = eservice.descriptors.some(
    isDescriptorUpdatableAfterPublish
  );
  if (!hasValidDescriptor) {
    throw eserviceWithoutValidDescriptors(eservice.id);
  }
}

export function assertUpdatedNameDiffersFromCurrent(
  newName: string,
  eservice: EService
): void {
  if (newName === eservice.name) {
    throw eServiceUpdateSameNameConflict(eservice.id);
  }
}
export function assertUpdatedDescriptionDiffersFromCurrent(
  newDescription: string,
  eservice: EService
): void {
  if (newDescription === eservice.description) {
    throw eServiceUpdateSameDescriptionConflict(eservice.id);
  }
}

/**
 * Checks if the user has the roles required to access inactive
 * descriptors (i.e., DRAFT or WAITING_FOR_APPROVAL).
 * NOT sufficient to access them; the request must also originate
 * from the producer tenant or the delegate producer tenant.
 */
export function hasRoleToAccessInactiveDescriptors(
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData | InternalAuthData
): boolean {
  return (
    hasAtLeastOneUserRole(authData, [
      userRole.ADMIN_ROLE,
      userRole.API_ROLE,
      userRole.SUPPORT_ROLE,
      userRole.VIEWER_ROLE,
    ]) ||
    hasAtLeastOneSystemRole(authData, [
      systemRole.M2M_ADMIN_ROLE,
      systemRole.M2M_ROLE,
    ])
  );
}

export function assertAsyncExchangeReadyForPublication(
  descriptor: Descriptor,
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): void {
  if (descriptor.asyncExchangeProperties === undefined) {
    throw missingAsyncExchangeProperties(eserviceId, descriptorId);
  }

  if (descriptor.asyncExchangeCallbackInterface === undefined) {
    throw missingAsyncExchangeCallbackInterface(eserviceId, descriptorId);
  }
}

export function assertAsyncExchangeBulkAllowedForDescriptor(
  eserviceTechnology: Technology,
  asyncExchangeProperties: AsyncExchangeProperties | undefined,
  eserviceId: EServiceId,
  descriptorId: DescriptorId
): void {
  if (
    asyncExchangeProperties !== undefined &&
    eserviceTechnology === technology.soap &&
    asyncExchangeProperties.bulk === true
  ) {
    throw asyncExchangeBulkNotAllowedForSoap(eserviceId, descriptorId);
  }
}

export function assertDailyCallsForCertifiedAttributesOnly(
  attributes: EserviceAttributes
): void {
  const attributesToCheck = [attributes.declared, attributes.verified].flat(2);
  for (const attribute of attributesToCheck) {
    if (
      "dailyCallsPerConsumer" in attribute &&
      attribute.dailyCallsPerConsumer !== undefined
    ) {
      throw attributeDailyCallsNotAllowed(attribute.id);
    }
  }
}

export function assertDiscreteConfigForCertifiedAttributesOnly(
  attributes: EserviceAttributes
): void {
  const invalidAttribute = [attributes.declared, attributes.verified]
    .flat(2)
    .find(
      (attribute) =>
        "discreteConfig" in attribute && attribute.discreteConfig !== undefined
    );

  if (invalidAttribute) {
    throw attributeDiscreteConfigNotAllowed(invalidAttribute.id);
  }
}

export function assertCertifiedDiscreteConfigUnchanged(
  descriptor: Descriptor,
  newAttributes: EserviceAttributes
): void {
  if (descriptor.state === descriptorState.draft) {
    return;
  }

  const publishedConfigsById = collectDiscreteConfigKeysById(
    descriptor.attributes.certified.flat()
  );

  if (publishedConfigsById.size === 0) {
    return;
  }

  const newConfigsById = collectDiscreteConfigKeysById(
    newAttributes.certified.flat()
  );

  for (const [attributeId, publishedConfigs] of publishedConfigsById) {
    const newConfigs = newConfigsById.get(attributeId);

    if (newConfigs === undefined) {
      continue;
    }

    const configsUnchanged =
      newConfigs.size === publishedConfigs.size &&
      [...publishedConfigs].every((config) => newConfigs.has(config));

    if (!configsUnchanged) {
      throw certifiedDiscreteAttributeConfigCannotBeChanged(attributeId);
    }
  }
}

function collectDiscreteConfigKeysById(
  attributes: EServiceCertifiedAttribute[]
): Map<AttributeId, Set<string>> {
  const configsById = new Map<AttributeId, Set<string>>();
  for (const attribute of attributes) {
    const config = getEServiceAttributeDiscreteConfig(attribute);
    if (config === undefined) {
      continue;
    }
    const configs = configsById.get(attribute.id) ?? new Set<string>();
    configs.add(`${config.comparator}:${config.threshold}`);
    configsById.set(attribute.id, configs);
  }
  return configsById;
}

export function assertTemplateInstanceAttributeStructureUnchanged(
  eserviceId: EServiceId,
  templateId: EServiceTemplateId | undefined,
  descriptorAttributes: EserviceAttributes,
  seedAttributes: catalogApi.AttributesSeed
): void {
  if (templateId === undefined) {
    return;
  }

  assertAttributeGroupsUnchanged(
    eserviceId,
    templateId,
    descriptorAttributes.certified,
    seedAttributes.certified
  );
  assertAttributeGroupsUnchanged(
    eserviceId,
    templateId,
    descriptorAttributes.declared,
    seedAttributes.declared
  );
  assertAttributeGroupsUnchanged(
    eserviceId,
    templateId,
    descriptorAttributes.verified,
    seedAttributes.verified
  );
}

function assertAttributeGroupsUnchanged(
  eserviceId: EServiceId,
  templateId: EServiceTemplateId,
  descriptorGroups: EServiceCertifiedAttribute[][],
  seedGroups: catalogApi.AttributeSeed[][]
): void {
  if (descriptorGroups.length !== seedGroups.length) {
    throw templateInstanceNotAllowed(eserviceId, templateId);
  }

  for (const descriptorGroup of descriptorGroups) {
    const matchingSeedGroup = seedGroups.find(
      (seedGroup) =>
        seedGroup.length === descriptorGroup.length &&
        descriptorGroup.every((descriptorAttr) =>
          seedGroup.some((seedAttr) => seedAttr.id === descriptorAttr.id)
        )
    );

    if (!matchingSeedGroup) {
      throw templateInstanceNotAllowed(eserviceId, templateId);
    }

    for (const descriptorAttr of descriptorGroup) {
      const seedAttr = matchingSeedGroup.find(
        (attr) => attr.id === descriptorAttr.id
      );

      const descriptorDiscreteConfig =
        getEServiceAttributeDiscreteConfig(descriptorAttr);

      if (
        !seedAttr ||
        seedAttr.explicitAttributeVerification !==
          descriptorAttr.explicitAttributeVerification ||
        seedAttr.discreteConfig?.threshold !==
          descriptorDiscreteConfig?.threshold ||
        seedAttr.discreteConfig?.comparator !==
          descriptorDiscreteConfig?.comparator ||
        Boolean(seedAttr.discreteConfig) !==
          (descriptorDiscreteConfig !== undefined)
      ) {
        throw templateInstanceNotAllowed(eserviceId, templateId);
      }
    }
  }
}

export function assertAttributeDailyCallsConsistentWithTotal(
  attributes: EserviceAttributes,
  dailyCallsTotal: number
): void {
  for (const attributeGroup of attributes.certified) {
    for (const attribute of attributeGroup) {
      if (
        attribute.dailyCallsPerConsumer !== undefined &&
        attribute.dailyCallsPerConsumer > dailyCallsTotal
      ) {
        throw inconsistentDailyCalls();
      }
    }
  }
}

export function assertDescriptorArchivable(
  descriptor: Descriptor,
  eservice: EService
): void {
  if (!isDescriptorArchivable(descriptor, eservice)) {
    throw notValidDescriptorState(descriptor.id, descriptor.state);
  }
}

export function assertEServiceArchivable(eservice: EService): void {
  if (!isEserviceArchivable(eservice)) {
    throw notValidEServiceState(eservice.id);
  }
}

export function assertDescriptorInRequiredStates(
  descriptor: Descriptor,
  states: DescriptorState[]
): void {
  if (!states.includes(descriptor.state)) {
    throw notValidDescriptorState(descriptor.id, descriptor.state);
  }
}

export function assertEserviceIsNotInArchivingOrArchivedState(
  eservice: EService
): void {
  const latestActiveDescriptor = [...eservice.descriptors]
    .sort(
      (a, b) => Number.parseInt(a.version, 10) - Number.parseInt(b.version, 10)
    )
    .filter(isActiveDescriptor)
    .at(-1);
  if (
    latestActiveDescriptor &&
    match(latestActiveDescriptor.state)
      .with(
        descriptorState.archived,
        descriptorState.archiving,
        descriptorState.archivingSuspended,
        () => true
      )
      .with(
        descriptorState.draft,
        descriptorState.deprecated,
        descriptorState.published,
        descriptorState.suspended,
        descriptorState.waitingForApproval,
        () => false
      )
      .exhaustive()
  ) {
    throw eserviceInArchivingOrArchivedState(eservice.id);
  }
}

function isDescriptorCancelArchivable(
  descriptor: Descriptor,
  latestDescriptor: Descriptor
): boolean {
  const isLatest = latestDescriptor.id === descriptor.id;

  return match(descriptor.state)
    .with(
      descriptorState.archiving,
      descriptorState.archivingSuspended,
      () => !isLatest
    )
    .with(
      descriptorState.draft,
      descriptorState.published,
      descriptorState.waitingForApproval,
      descriptorState.archived,
      descriptorState.deprecated,
      descriptorState.suspended,
      () => false
    )
    .exhaustive();
}

export function assertDescriptorCancelArchivable(
  descriptor: Descriptor,
  latestDescriptor: Descriptor
): void {
  if (!isDescriptorCancelArchivable(descriptor, latestDescriptor)) {
    throw notValidDescriptorState(descriptor.id, descriptor.state);
  }
}

export function assertDescriptorArchivingIsNotEserviceScoped(
  descriptor: Descriptor
): void {
  if (descriptor.archivingSchedule?.scope === archivingScope.eservice) {
    throw descriptorArchivingNotCancelableByScope(descriptor.id);
  }
}

export function assertDescriptorIsNotAlreadyArchived(
  descriptor: Descriptor
): void {
  if (descriptor.state === descriptorState.archived) {
    throw descriptorAlreadyArchived(descriptor.id);
  }
}

export function assertEServiceIsInArchiving(eservice: EService): void {
  const hasEServiceScopeArchiving =
    getLatestDescriptor(eservice).archivingSchedule?.scope ===
    archivingScope.eservice;

  const hasDescriptorInWrongState = eservice.descriptors.some(
    (d) =>
      d.state !== descriptorState.archiving &&
      d.state !== descriptorState.archivingSuspended &&
      d.state !== descriptorState.archived
  );

  if (!hasEServiceScopeArchiving || hasDescriptorInWrongState) {
    throw eserviceNotInArchiving(eservice.id);
  }
}

export function assertEServiceIsNotAlreadyArchived(eservice: EService): void {
  const latestDescriptor = getLatestDescriptor(eservice);
  if (latestDescriptor.state === descriptorState.archived) {
    throw eServiceAlreadyArchived(eservice.id);
  }
}
