import { AuthData } from "pagopa-interop-commons";
import {
  eserviceMode,
  EServiceTemplate,
  eserviceTemplateVersionState,
  operationForbidden,
  Tenant,
  TenantId,
} from "pagopa-interop-models";
import {
  templateNotInDraftState,
  templateNotInReceiveMode,
  tenantKindNotFound,
} from "../model/domain/errors.js";
import { eserviceTemplateNotInDraftState } from "../model/domain/errors.js";

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
    eserviceTemplate.versions.every(
      (v) => v.state !== eserviceTemplateVersionState.draft
    )
  ) {
    throw eserviceTemplateNotInDraftState(eserviceTemplate.id);
  }
}
