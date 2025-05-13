import {
  M2MAdminAuthData,
  M2MAuthData,
  UIAuthData,
  hasAtLeastOneSystemRole,
  hasAtLeastOneUserRole,
  systemRole,
  userRole,
} from "pagopa-interop-commons";
import {
  EServiceTemplate,
  EServiceTemplateVersion,
  eserviceTemplateVersionState,
  operationForbidden,
  Tenant,
  TenantId,
  eserviceMode,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  draftEServiceTemplateVersionAlreadyExists,
  templateNotInReceiveMode,
  tenantKindNotFound,
  eserviceTemplateNotInDraftState,
  inconsistentDailyCalls,
  eserviceTemplateWithoutPublishedVersion,
} from "../model/domain/errors.js";

export function assertRequesterEServiceTemplateCreator(
  creatorId: TenantId,
  authData: UIAuthData
): void {
  if (authData.organizationId !== creatorId) {
    throw operationForbidden;
  }
}

export function assertTenantKindExists(
  tenant: Tenant
): asserts tenant is Tenant & { kind: NonNullable<Tenant["kind"]> } {
  if (tenant.kind === undefined) {
    throw tenantKindNotFound(tenant.id);
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

export function hasAccessToDraftTemplateVersions(
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): boolean {
  // NOTE: this is not sufficient to access draft versions.
  // The request must also originate from the template creator tenant.
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
