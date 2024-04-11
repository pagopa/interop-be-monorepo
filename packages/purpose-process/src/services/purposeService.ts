import {
  AuthData,
  DB,
  logger,
  riskAnalysisFormToRiskAnalysisFormToValidate,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  EService,
  EServiceId,
  TenantId,
  WithMetadata,
  Tenant,
  Purpose,
  PurposeId,
  TenantKind,
  purposeVersionState,
  RiskAnalysisForm,
} from "pagopa-interop-models";
import {
  eserviceNotFound,
  purposeNotFound,
  tenantKindNotFound,
  tenantNotFound,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

const retrievePurpose = async (
  purposeId: PurposeId,
  readModelService: ReadModelService
): Promise<WithMetadata<Purpose>> => {
  const purpose = await readModelService.getPurposeById(purposeId);
  if (purpose === undefined) {
    throw purposeNotFound(purposeId);
  }
  return purpose;
};

const retrieveEService = async (
  eserviceId: EServiceId,
  readModelService: ReadModelService
): Promise<EService> => {
  const eservice = await readModelService.getEServiceById(eserviceId);
  if (eservice === undefined) {
    throw eserviceNotFound(eserviceId);
  }
  return eservice;
};

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(
  _dbInstance: DB,
  readModelService: ReadModelService
) {
  // const repository = eventRepository(dbInstance, purposeEventToBinaryData);

  return {
    async getPurposeById(
      purposeId: PurposeId,
      authData: AuthData
    ): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(`Retrieving Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );
      const tenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      if (tenant.kind === undefined) {
        throw tenantKindNotFound(tenant.id);
      }

      return authorizeRiskAnalysisForm({
        purpose: purpose.data,
        producerId: eservice.producerId,
        organizationId: authData.organizationId,
        tenantKind: tenant.kind,
      });
    },
  };
}

export type PurposeService = ReturnType<typeof purposeServiceBuilder>;

const authorizeRiskAnalysisForm = ({
  purpose,
  producerId,
  organizationId,
  tenantKind,
}: {
  purpose: Purpose;
  producerId: TenantId;
  organizationId: TenantId;
  tenantKind: TenantKind;
}): { purpose: Purpose; isRiskAnalysisValid: boolean } => {
  if (organizationId === purpose.consumerId || organizationId === producerId) {
    if (purposeIsDraft(purpose)) {
      const isRiskAnalysisValid = isRiskAnalysisFormValid(
        purpose.riskAnalysisForm,
        false,
        tenantKind
      );
      return { purpose, isRiskAnalysisValid };
    } else {
      return { purpose, isRiskAnalysisValid: true };
    }
  } else {
    return {
      purpose: { ...purpose, riskAnalysisForm: undefined },
      isRiskAnalysisValid: false,
    };
  }
};

const isRiskAnalysisFormValid = (
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

const purposeIsDraft = (purpose: Purpose): boolean =>
  !purpose.versions.some((v) => v.state !== purposeVersionState.draft);
