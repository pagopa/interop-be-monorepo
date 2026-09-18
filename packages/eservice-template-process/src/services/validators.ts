import {
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
  hasAtLeastOneSystemRole,
  hasAtLeastOneUserRole,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  systemRole,
  userRole,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  EServiceTemplate,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  operationForbidden,
  TenantId,
  eserviceMode,
  EServiceMode,
  RiskAnalysisId,
  type EserviceAttributes,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

import {
  draftEServiceTemplateVersionAlreadyExists,
  templateNotInReceiveMode,
  eserviceTemplateNotFound,
  eserviceTemplateNotInDraftState,
  inconsistentDailyCalls,
  eserviceTemplateWithoutPublishedVersion,
  eserviceTemplateDuplicate,
  missingRiskAnalysis,
  riskAnalysisValidationFailed,
  riskAnalysisNotFound,
  eServiceTemplateUpdateSameNameConflict,
  eServiceTemplateUpdateSameDescriptionConflict,
  asyncExchangeReceiveTemplateNotAllowed,
  attributeDiscreteConfigNotAllowed,
} from "../model/domain/errors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export function assertRequesterEServiceTemplateCreator(
  creatorId: TenantId,
  authData: UIAuthData | M2MAdminAuthData
): void {
  if (authData.organizationId !== creatorId) {
    throw operationForbidden;
  }
}

/**
 * Asserts that the requester can see the e-service template.
 * Non-creators have no visibility on templates that have only draft
 * versions, so those must appear as not-found (404) instead of leaking
 * their existence with a forbidden (403).
 */
export function assertEServiceTemplateVisibleToRequester(
  eserviceTemplate: EServiceTemplate,
  authData: UIAuthData | M2MAdminAuthData
): void {
  const hasPublishedVersions = eserviceTemplate.versions.some(
    (v) => v.state !== eserviceTemplateVersionState.draft
  );
  if (
    authData.organizationId !== eserviceTemplate.creatorId &&
    !hasPublishedVersions
  ) {
    throw eserviceTemplateNotFound(eserviceTemplate.id);
  }
}

export function assertIsReceiveTemplate(template: EServiceTemplate): void {
  if (template.mode !== eserviceMode.receive) {
    throw templateNotInReceiveMode(template.id);
  }
}

export function assertIsDraftEServiceTemplate(
  eserviceTemplate: EServiceTemplate
): void {
  if (
    eserviceTemplate.versions.length > 0 &&
    eserviceTemplate.versions.some(
      (v) => v.state !== eserviceTemplateVersionState.draft
    )
  ) {
    throw eserviceTemplateNotInDraftState(eserviceTemplate.id);
  }
}

export function assertNoDraftEServiceTemplateVersions(
  eserviceTemplate: EServiceTemplate
): void {
  if (
    eserviceTemplate.versions.some(
      (v) => v.state === eserviceTemplateVersionState.draft
    )
  ) {
    throw draftEServiceTemplateVersionAlreadyExists(eserviceTemplate.id);
  }
}

export function versionStatesNotAllowingDocumentOperations(
  version: EServiceTemplateVersion
): boolean {
  return match(version.state)
    .with(
      eserviceTemplateVersionState.draft,
      eserviceTemplateVersionState.published,
      eserviceTemplateVersionState.suspended,
      () => false
    )
    .with(eserviceTemplateVersionState.deprecated, () => true)
    .exhaustive();
}

export function versionStatesNotAllowingInterfaceOperations(
  version: EServiceTemplateVersion
): boolean {
  return match(version.state)
    .with(eserviceTemplateVersionState.draft, () => false)
    .otherwise(() => true);
}

export function assertConsistentDailyCalls({
  dailyCallsPerConsumer,
  dailyCallsTotal,
}: {
  dailyCallsPerConsumer?: number;
  dailyCallsTotal?: number;
}): void {
  if (
    dailyCallsPerConsumer !== undefined &&
    dailyCallsTotal !== undefined &&
    dailyCallsPerConsumer > dailyCallsTotal
  ) {
    throw inconsistentDailyCalls();
  }
}

export function assertAsyncExchangeReceiveTemplateNotAllowed({
  mode,
  asyncExchange,
}: {
  mode: EServiceMode;
  asyncExchange: boolean | undefined;
}): void {
  if (mode === eserviceMode.receive && asyncExchange === true) {
    throw asyncExchangeReceiveTemplateNotAllowed();
  }
}

export function assertPublishedEServiceTemplate(
  eserviceTemplate: EServiceTemplate
): void {
  if (
    !eserviceTemplate.versions.some(
      (v) =>
        v.state === eserviceTemplateVersionState.published ||
        v.state === eserviceTemplateVersionState.suspended
    )
  ) {
    throw eserviceTemplateWithoutPublishedVersion(eserviceTemplate.id);
  }
}

/**
 * Checks if the user has the roles required to access draft
 * template versions.
 * NOT sufficient to access them; the request must also originate
 * from the template creator tenant.
 */
export function hasRoleToAccessDraftTemplateVersions(
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
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

export async function assertEServiceTemplateNameAvailable(
  name: string,
  readModelService: ReadModelServiceSQL
): Promise<void> {
  const isEServiceTemplateNameAvailable =
    await readModelService.isEServiceTemplateNameAvailable({
      name,
    });

  if (!isEServiceTemplateNameAvailable) {
    throw eserviceTemplateDuplicate(name);
  }
}

export function assertRiskAnalysisIsValidForPublication(
  eserviceTemplate: EServiceTemplate
): void {
  if (eserviceTemplate.riskAnalysis.length === 0) {
    throw missingRiskAnalysis(eserviceTemplate.id);
  }

  eserviceTemplate.riskAnalysis.forEach((riskAnalysis) => {
    const result = validateRiskAnalysis(
      riskAnalysisFormToRiskAnalysisFormToValidate(
        riskAnalysis.riskAnalysisForm
      ),
      false,
      undefined,
      new Date(),
      eserviceTemplate.personalData
    );

    if (result.type === "invalid") {
      throw riskAnalysisValidationFailed(result.issues);
    }
  });
}

export function assertRiskAnalysisExists(
  eserviceTemplate: EServiceTemplate,
  riskAnalysisId: RiskAnalysisId
): void {
  if (!eserviceTemplate.riskAnalysis.some((ra) => ra.id === riskAnalysisId)) {
    throw riskAnalysisNotFound(eserviceTemplate.id, riskAnalysisId);
  }
}

export function assertUpdatedNameDiffersFromCurrent(
  newName: string,
  eserviceTemplate: EServiceTemplate
): void {
  if (newName === eserviceTemplate.name) {
    throw eServiceTemplateUpdateSameNameConflict(eserviceTemplate.id);
  }
}

export function assertUpdatedDescriptionDiffersFromCurrent(
  newDescription: string,
  eserviceTemplate: EServiceTemplate
): void {
  if (newDescription === eserviceTemplate.description) {
    throw eServiceTemplateUpdateSameDescriptionConflict(eserviceTemplate.id);
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
