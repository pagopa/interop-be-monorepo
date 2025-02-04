/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  AppContext,
  DB,
  eventRepository,
  RiskAnalysisValidatedForm,
  riskAnalysisValidatedFormToNewRiskAnalysis,
  validateRiskAnalysis,
  WithLogger,
} from "pagopa-interop-commons";
import {
  EServiceTemplate,
  eserviceTemplateEventToBinaryDataV2,
  EServiceTemplateId,
  generateId,
  RiskAnalysis,
  RiskAnalysisId,
  Tenant,
  TenantId,
  TenantKind,
} from "pagopa-interop-models";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  eserviceTemaplateRiskAnalysisNameDuplicate,
  eserviceTemplateRequesterIsNotCreator,
  riskAnalysisValidationFailed,
  tenantNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventEServiceTemplateRiskAnalysisAdded,
  toCreateEventEServiceTemplateRiskAnalysisDeleted,
  toCreateEventEServiceTemplateRiskAnalysisUpdated,
} from "../model/domain/toEvent.js";
import { ReadModelService } from "./readModelService.js";
import { retrieveEServiceTemplate } from "./eserviceTemplateService.js";
import {
  assertIsDraftTemplate,
  assertIsReceiveTemplate,
  assertTenantKindExists,
} from "./validators.js";

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

export function validateRiskAnalysisSchemaOrThrow(
  riskAnalysisForm: eserviceTemplateApi.EServiceRiskAnalysisSeed["riskAnalysisForm"],
  tenantKind: TenantKind
): RiskAnalysisValidatedForm {
  const result = validateRiskAnalysis(riskAnalysisForm, true, tenantKind);
  if (result.type === "invalid") {
    throw riskAnalysisValidationFailed(result.issues);
  } else {
    return result.value;
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function riskAnalysisTemplateServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const repository = eventRepository(
    dbInstance,
    eserviceTemplateEventToBinaryDataV2
  );
  return {
    async createRiskAnalysis(
      id: EServiceTemplateId,
      createRiskAnalysis: eserviceTemplateApi.EServiceRiskAnalysisSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Creating risk analysis for eServiceTemplateId: ${id}`);

      const template = await retrieveEServiceTemplate(id, readModelService);
      if (template.data.creatorId !== authData.organizationId) {
        throw eserviceTemplateRequesterIsNotCreator(id);
      }
      assertIsDraftTemplate(template.data);
      assertIsReceiveTemplate(template.data);

      const tenant = await retrieveTenant(
        template.data.creatorId,
        readModelService
      );
      assertTenantKindExists(tenant);

      const raSameName = template.data.riskAnalysis.find(
        (ra) => ra.name === createRiskAnalysis.name
      );
      if (raSameName) {
        throw eserviceTemaplateRiskAnalysisNameDuplicate(
          createRiskAnalysis.name
        );
      }

      const validatedRiskAnalysisForm = validateRiskAnalysisSchemaOrThrow(
        createRiskAnalysis.riskAnalysisForm,
        tenant.kind
      );

      const newRiskAnalysis: RiskAnalysis =
        riskAnalysisValidatedFormToNewRiskAnalysis(
          validatedRiskAnalysisForm,
          createRiskAnalysis.name
        );

      const newTemplate: EServiceTemplate = {
        ...template.data,
        riskAnalysis: [...template.data.riskAnalysis, newRiskAnalysis],
      };

      const event = toCreateEventEServiceTemplateRiskAnalysisAdded(
        template.data.id,
        template.metadata.version,
        generateId<RiskAnalysisId>(),
        newTemplate,
        correlationId
      );

      await repository.createEvent(event);
    },
    async deleteRiskAnalysis(
      templateId: EServiceTemplateId,
      riskAnalysisId: RiskAnalysisId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Deleting risk analysis with id: ${riskAnalysisId} from eServiceTemplate with id: ${templateId}`
      );

      const template = await retrieveEServiceTemplate(
        templateId,
        readModelService
      );
      if (template.data.creatorId !== authData.organizationId) {
        throw eserviceTemplateRequesterIsNotCreator(templateId);
      }
      assertIsDraftTemplate(template.data);
      assertIsReceiveTemplate(template.data);

      const newTemplate: EServiceTemplate = {
        ...template.data,
        riskAnalysis: template.data.riskAnalysis.filter(
          (ra) => ra.id !== riskAnalysisId
        ),
      };

      const event = toCreateEventEServiceTemplateRiskAnalysisDeleted(
        template.data.id,
        template.metadata.version,
        riskAnalysisId,
        newTemplate,
        correlationId
      );

      await repository.createEvent(event);
    },
    async updateRiskAnalysis(
      templateId: EServiceTemplateId,
      riskAnalysisId: RiskAnalysisId,
      updateRiskAnalysis: eserviceTemplateApi.EServiceRiskAnalysisSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Updating risk analysis with id: ${riskAnalysisId} from eServiceTemplate with id: ${templateId}`
      );

      const template = await retrieveEServiceTemplate(
        templateId,
        readModelService
      );
      if (template.data.creatorId !== authData.organizationId) {
        throw eserviceTemplateRequesterIsNotCreator(templateId);
      }
      assertIsDraftTemplate(template.data);
      assertIsReceiveTemplate(template.data);

      const tenant = await retrieveTenant(
        template.data.creatorId,
        readModelService
      );
      assertTenantKindExists(tenant);

      const validatedRiskAnalysisForm = validateRiskAnalysisSchemaOrThrow(
        updateRiskAnalysis.riskAnalysisForm,
        tenant.kind
      );

      const updatedRiskAnalysis: RiskAnalysis =
        riskAnalysisValidatedFormToNewRiskAnalysis(
          validatedRiskAnalysisForm,
          updateRiskAnalysis.name
        );

      const newTemplate: EServiceTemplate = {
        ...template.data,
        riskAnalysis: [
          ...template.data.riskAnalysis.filter(
            (ra) => ra.id !== riskAnalysisId
          ),
          updatedRiskAnalysis,
        ],
      };

      const event = toCreateEventEServiceTemplateRiskAnalysisUpdated(
        template.data.id,
        template.metadata.version,
        riskAnalysisId,
        newTemplate,
        correlationId
      );

      await repository.createEvent(event);
    },
  };
}

export type RiskAnalysisTemplateService = ReturnType<
  typeof riskAnalysisTemplateServiceBuilder
>;
