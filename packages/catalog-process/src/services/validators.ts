import {
  AuthData,
  RiskAnalysisValidatedForm,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  TenantId,
  operationForbidden,
  EService,
  descriptorState,
  eserviceMode,
  Tenant,
  TenantKind,
  Descriptor,
} from "pagopa-interop-models";
import {
  eserviceNotInDraftState,
  eserviceNotInReceiveMode,
  tenantKindNotFound,
  riskAnalysisValidationFailed,
  draftDescriptorAlreadyExists,
  eServiceRiskAnalysisIsRequired,
  riskAnalysisNotValid,
  eserviceNotActive,
} from "../model/domain/errors.js";
import { EServiceRiskAnalysisSeed } from "../model/domain/models.js";

export function assertRequesterAllowed(
  producerId: TenantId,
  authData: AuthData
): void {
  if (
    !authData.userRoles.includes("internal") &&
    producerId !== authData.organizationId
  ) {
    throw operationForbidden;
  }
}

export function assertIsDraftEservice(eservice: EService): void {
  if (eservice.descriptors.some((d) => d.state !== descriptorState.draft)) {
    throw eserviceNotInDraftState(eservice.id);
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

export function assertHasNoDraftDescriptor(eservice: EService): void {
  const hasDraftDescriptor = eservice.descriptors.some(
    (d: Descriptor) => d.state === descriptorState.draft
  );
  if (hasDraftDescriptor) {
    throw draftDescriptorAlreadyExists(eservice.id);
  }
}

export function validateRiskAnalysisSchemaOrThrow(
  riskAnalysisForm: EServiceRiskAnalysisSeed["riskAnalysisForm"],
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

export function assertEserviceIsActive(eservice: EService): void {
  const isEserviceActive = eservice.descriptors.some(
    (d: Descriptor) =>
      d.state !== descriptorState.draft && d.state !== descriptorState.archived
  );
  if (!isEserviceActive) {
    throw eserviceNotActive(eservice.id);
  }
}
