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
  EServiceId,
} from "pagopa-interop-models";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  eserviceNotInDraftState,
  eserviceNotInReceiveMode,
  tenantKindNotFound,
  riskAnalysisValidationFailed,
  draftDescriptorAlreadyExists,
  eServiceRiskAnalysisIsRequired,
  riskAnalysisNotValid,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

export async function assertRequesterAllowed(
  producerId: TenantId,
  eserviceId: EServiceId,
  authData: AuthData,
  readModelService: ReadModelService
): Promise<void> {
  if (authData.userRoles.includes("internal")) {
    return;
  }

  const delegation = await readModelService.getDelegationByEServiceId(
    eserviceId
  );

  // If the e-service is delegated, only the delegated can operate
  if (delegation) {
    if (authData.organizationId !== delegation.delegateId) {
      throw operationForbidden;
    }
    return;
  }

  if (producerId !== authData.organizationId) {
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
