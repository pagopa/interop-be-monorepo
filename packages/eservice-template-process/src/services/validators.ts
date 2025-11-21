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
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  draftEServiceTemplateVersionAlreadyExists,
  templateNotInReceiveMode,
  eserviceTemplateNotInDraftState,
  inconsistentDailyCalls,
  eserviceTemplateWithoutPublishedVersion,
  eserviceTemplateDuplicate,
  missingRiskAnalysis,
  riskAnalysisValidationFailed,
  eServiceTemplateUpdateSameNameConflict,
  eServiceTemplateUpdateSameDescriptionConflict,
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
      riskAnalysis.tenantKind,
      new Date(),
      eserviceTemplate.personalData
    );

    if (result.type === "invalid") {
      throw riskAnalysisValidationFailed(result.issues);
    }
  });
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
