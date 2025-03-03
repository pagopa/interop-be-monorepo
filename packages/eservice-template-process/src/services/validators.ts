import { AuthData } from "pagopa-interop-commons";
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
  templateNotInDraftState,
  templateNotInReceiveMode,
  tenantKindNotFound,
  eserviceTemplateNotInDraftState,
  inconsistentDailyCalls,
} from "../model/domain/errors.js";

export function assertRequesterEServiceTemplateCreator(
  creatorId: TenantId,
  authData: AuthData
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

export function assertIsDraftTemplate(template: EServiceTemplate): void {
  if (
    template.versions.some(
      (d) => d.state !== eserviceTemplateVersionState.draft
    )
  ) {
    throw templateNotInDraftState(template.id);
  }
}

export function assertIsReceiveTemplate(template: EServiceTemplate): void {
  if (template.mode !== eserviceMode.receive) {
    throw templateNotInReceiveMode(template.id);
  }
}

export function assertIsDraftEserviceTemplate(
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
