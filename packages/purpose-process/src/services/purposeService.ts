import {
  DB,
  eventRepository,
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
  PurposeVersionId,
  PurposeVersionDocumentId,
  PurposeVersion,
  PurposeVersionDocument,
  ownership,
  Ownership,
  purposeEventToBinaryData,
} from "pagopa-interop-models";
import {
  eserviceNotFound,
  organizationIsNotTheConsumer,
  organizationNotAllowed,
  purposeNotFound,
  purposeVersionCannotBeDeleted,
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
  tenantKindNotFound,
  tenantNotFound,
} from "../model/domain/errors.js";
import { toCreateEventWaitingForApprovalPurposeVersionDeleted } from "../model/domain/toEvent.js";
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

const retrievePurposeVersion = (
  versionId: PurposeVersionId,
  purpose: WithMetadata<Purpose>
): PurposeVersion => {
  const version = purpose.data.versions.find(
    (v: PurposeVersion) => v.id === versionId
  );

  if (version === undefined) {
    throw purposeVersionNotFound(purpose.data.id, versionId);
  }

  return version;
};

const retrievePurposeVersionDocument = (
  purposeId: PurposeId,
  purposeVersion: PurposeVersion,
  documentId: PurposeVersionDocumentId
): PurposeVersionDocument => {
  const document = purposeVersion.riskAnalysis;

  if (document === undefined || document.id !== documentId) {
    throw purposeVersionDocumentNotFound(
      purposeId,
      purposeVersion.id,
      documentId
    );
  }

  return document;
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
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const repository = eventRepository(dbInstance, purposeEventToBinaryData);

  return {
    async getPurposeById(
      purposeId: PurposeId,
      organizationId: TenantId
    ): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(`Retrieving Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );
      const tenant = await retrieveTenant(organizationId, readModelService);

      if (tenant.kind === undefined) {
        throw tenantKindNotFound(tenant.id);
      }

      return authorizeRiskAnalysisForm({
        purpose: purpose.data,
        producerId: eservice.producerId,
        organizationId,
        tenantKind: tenant.kind,
      });
    },
    async getRiskAnalysisDocument({
      purposeId,
      versionId,
      documentId,
      organizationId,
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      documentId: PurposeVersionDocumentId;
      organizationId: TenantId;
    }): Promise<PurposeVersionDocument> {
      const purpose = await retrievePurpose(purposeId, readModelService);
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );
      getOrganizationRole({
        organizationId,
        producerId: eservice.producerId,
        consumerId: purpose.data.consumerId,
      });
      const version = retrievePurposeVersion(versionId, purpose);

      return retrievePurposeVersionDocument(purposeId, version, documentId);
    },
    async deletePurposeVersion({
      purposeId,
      versionId,
      organizationId,
      correlationId,
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<void> {
      logger.info(`Deleting Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      if (organizationId !== purpose.data.consumerId) {
        throw organizationIsNotTheConsumer(organizationId);
      }

      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (purposeVersion.state !== purposeVersionState.waitingForApproval) {
        throw purposeVersionCannotBeDeleted(purposeId, versionId);
      }

      const updatedPurpose: Purpose = {
        ...purpose.data,
        versions: purpose.data.versions.filter(
          (v) => v.id !== purposeVersion.id
        ),
      };

      const event = toCreateEventWaitingForApprovalPurposeVersionDeleted({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        versionId,
        correlationId,
      });
      await repository.createEvent(event);
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

const getOrganizationRole = ({
  organizationId,
  producerId,
  consumerId,
}: {
  organizationId: TenantId;
  producerId: TenantId;
  consumerId: TenantId;
}): Ownership => {
  if (producerId === consumerId && organizationId === producerId) {
    return ownership.SELF_CONSUMER;
  } else if (producerId !== consumerId && organizationId === consumerId) {
    return ownership.CONSUMER;
  } else if (producerId !== consumerId && organizationId === producerId) {
    return ownership.PRODUCER;
  } else {
    throw organizationNotAllowed(organizationId);
  }
};
