/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  AppContext,
  AuthData,
  DB,
  FileManager,
  RiskAnalysisValidatedForm,
  WithLogger,
  eventRepository,
  hasPermission,
  userRoles,
  riskAnalysisValidatedFormToNewRiskAnalysis,
  validateRiskAnalysis,
} from "pagopa-interop-commons";
import {
  EServiceTemplate,
  eserviceTemplateEventToBinaryDataV2,
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  EServiceTemplateVersionState,
  eserviceTemplateVersionState,
  generateId,
  RiskAnalysis,
  RiskAnalysisId,
  Tenant,
  TenantId,
  TenantKind,
  WithMetadata,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  eserviceTemaplateRiskAnalysisNameDuplicate,
  eServiceTemplateDuplicate,
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  eserviceTemplateWithoutPublishedVersion,
  inconsistentDailyCalls,
  notValidEServiceTemplateVersionState,
  riskAnalysisValidationFailed,
  tenantNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventEServiceTemplateAudienceDescriptionUpdated,
  toCreateEventEServiceTemplateEServiceDescriptionUpdated,
  toCreateEventEServiceTemplateVersionActivated,
  toCreateEventEServiceTemplateVersionSuspended,
  toCreateEventEServiceTemplateNameUpdated,
  toCreateEventEServiceTemplateVersionQuotasUpdated,
  toCreateEventEServiceTemplateRiskAnalysisAdded,
  toCreateEventEServiceTemplateRiskAnalysisDeleted,
  toCreateEventEServiceTemplateRiskAnalysisUpdated,
} from "../model/domain/toEvent.js";
import { ReadModelService } from "./readModelService.js";
import {
  assertIsDraftTemplate,
  assertIsReceiveTemplate,
  assertRequesterEServiceTemplateCreator,
  assertTenantKindExists,
} from "./validators.js";

export const retrieveEServiceTemplate = async (
  eserviceTemplateId: EServiceTemplateId,
  readModelService: ReadModelService
): Promise<WithMetadata<EServiceTemplate>> => {
  const eserviceTemplate = await readModelService.getEServiceTemplateById(
    eserviceTemplateId
  );
  if (eserviceTemplate === undefined) {
    throw eServiceTemplateNotFound(eserviceTemplateId);
  }
  return eserviceTemplate;
};

const retrieveEServiceTemplateVersion = (
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplate: EServiceTemplate
): EServiceTemplateVersion => {
  const eserviceTemplateVersion = eserviceTemplate.versions.find(
    (v) => v.id === eserviceTemplateVersionId
  );

  if (eserviceTemplateVersion === undefined) {
    throw eServiceTemplateVersionNotFound(
      eserviceTemplate.id,
      eserviceTemplateVersionId
    );
  }

  return eserviceTemplateVersion;
};

const updateEServiceTemplateVersionState = (
  eserviceTemplateVersion: EServiceTemplateVersion,
  newState: EServiceTemplateVersionState
): EServiceTemplateVersion => {
  const eserviceTemplateVersionStateChange = [
    eserviceTemplateVersion.state,
    newState,
  ];

  return match(eserviceTemplateVersionStateChange)
    .with(
      [
        eserviceTemplateVersionState.draft,
        eserviceTemplateVersionState.published,
      ],
      () => ({
        ...eserviceTemplateVersion,
        state: newState,
        publishedAt: new Date(),
      })
    )
    .with(
      [
        eserviceTemplateVersionState.published,
        eserviceTemplateVersionState.suspended,
      ],
      () => ({
        ...eserviceTemplateVersion,
        state: newState,
        suspendedAt: new Date(),
      })
    )
    .with(
      [
        eserviceTemplateVersionState.suspended,
        eserviceTemplateVersionState.published,
      ],
      () => ({
        ...eserviceTemplateVersion,
        state: newState,
        suspendedAt: undefined,
      })
    )
    .with(
      [
        eserviceTemplateVersionState.suspended,
        eserviceTemplateVersionState.deprecated,
      ],
      () => ({
        ...eserviceTemplateVersion,
        state: newState,
        suspendedAt: undefined,
        deprecatedAt: new Date(),
      })
    )
    .with(
      [
        eserviceTemplateVersionState.published,
        eserviceTemplateVersionState.deprecated,
      ],
      () => ({
        ...eserviceTemplateVersion,
        state: newState,
        deprecatedAt: new Date(),
      })
    )
    .otherwise(() => ({
      ...eserviceTemplateVersion,
      state: newState,
    }));
};

const replaceEServiceTemplateVersion = (
  eserviceTemplate: EServiceTemplate,
  newEServiceTemplateVersion: EServiceTemplateVersion
): EServiceTemplate => {
  const updatedEServiceTemplateVersions = eserviceTemplate.versions.map((v) =>
    v.id === newEServiceTemplateVersion.id ? newEServiceTemplateVersion : v
  );

  return {
    ...eserviceTemplate,
    versions: updatedEServiceTemplateVersions,
  };
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
export function eserviceTemplateServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  _fileManager: FileManager
) {
  const repository = eventRepository(
    dbInstance,
    eserviceTemplateEventToBinaryDataV2
  );
  return {
    async suspendEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Suspending e-service template version ${eserviceTemplateVersionId} for EService ${eserviceTemplateId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );

      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      const eserviceTemplateVersion = retrieveEServiceTemplateVersion(
        eserviceTemplateVersionId,
        eserviceTemplate.data
      );

      if (
        eserviceTemplateVersion.state !== eserviceTemplateVersionState.published
      ) {
        throw notValidEServiceTemplateVersionState(
          eserviceTemplateVersionId,
          eserviceTemplateVersion.state
        );
      }

      const updatedEServiceTemplateVersion = updateEServiceTemplateVersionState(
        eserviceTemplateVersion,
        eserviceTemplateVersionState.suspended
      );

      const updatedEServiceTemplate = replaceEServiceTemplateVersion(
        eserviceTemplate.data,
        updatedEServiceTemplateVersion
      );

      const event = toCreateEventEServiceTemplateVersionSuspended(
        eserviceTemplateId,
        eserviceTemplate.metadata.version,
        eserviceTemplateVersionId,
        updatedEServiceTemplate,
        correlationId
      );

      await repository.createEvent(event);
    },

    async activateEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Activating e-service template version ${eserviceTemplateVersionId} for EService ${eserviceTemplateId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );

      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      const eserviceTemplateVersion = retrieveEServiceTemplateVersion(
        eserviceTemplateVersionId,
        eserviceTemplate.data
      );

      if (
        eserviceTemplateVersion.state !== eserviceTemplateVersionState.suspended
      ) {
        throw notValidEServiceTemplateVersionState(
          eserviceTemplateVersionId,
          eserviceTemplateVersion.state
        );
      }

      const updatedEServiceTemplateVersion = updateEServiceTemplateVersionState(
        eserviceTemplateVersion,
        eserviceTemplateVersionState.published
      );

      const updatedEServiceTemplate = replaceEServiceTemplateVersion(
        eserviceTemplate.data,
        updatedEServiceTemplateVersion
      );

      const event = toCreateEventEServiceTemplateVersionActivated(
        eserviceTemplateId,
        eserviceTemplate.metadata.version,
        eserviceTemplateVersionId,
        updatedEServiceTemplate,
        correlationId
      );

      await repository.createEvent(event);
    },

    async updateEServiceTemplateName(
      eserviceTemplateId: EServiceTemplateId,
      name: string,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(`Updating name of EService template ${eserviceTemplateId}`);

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );
      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      if (
        eserviceTemplate.data.versions.every(
          (version) => version.state === eserviceTemplateVersionState.draft
        )
      ) {
        throw eserviceTemplateWithoutPublishedVersion(eserviceTemplateId);
      }

      if (name !== eserviceTemplate.data.name) {
        const eserviceTemplateWithSameName =
          await readModelService.getEServiceTemplateByNameAndCreatorId({
            name,
            creatorId: eserviceTemplate.data.creatorId,
          });
        if (eserviceTemplateWithSameName !== undefined) {
          throw eServiceTemplateDuplicate(name);
        }
      }
      const updatedEserviceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        name,
      };
      await repository.createEvent(
        toCreateEventEServiceTemplateNameUpdated(
          eserviceTemplate.data.id,
          eserviceTemplate.metadata.version,
          updatedEserviceTemplate,
          correlationId
        )
      );
      return updatedEserviceTemplate;
    },

    async updateEServiceTemplateAudienceDescription(
      eserviceTemplateId: EServiceTemplateId,
      audienceDescription: string,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(
        `Updating audience description of EService template ${eserviceTemplateId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );
      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      if (
        eserviceTemplate.data.versions.every(
          (version) => version.state === eserviceTemplateVersionState.draft
        )
      ) {
        throw eserviceTemplateWithoutPublishedVersion(eserviceTemplateId);
      }

      const updatedEserviceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        audienceDescription,
      };
      await repository.createEvent(
        toCreateEventEServiceTemplateAudienceDescriptionUpdated(
          eserviceTemplate.data.id,
          eserviceTemplate.metadata.version,
          updatedEserviceTemplate,
          correlationId
        )
      );
      return updatedEserviceTemplate;
    },

    async updateEServiceTemplateEServiceDescription(
      eserviceTemplateId: EServiceTemplateId,
      eserviceDescription: string,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(
        `Updating e-service description of EService template ${eserviceTemplateId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );
      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      if (
        eserviceTemplate.data.versions.every(
          (version) => version.state === eserviceTemplateVersionState.draft
        )
      ) {
        throw eserviceTemplateWithoutPublishedVersion(eserviceTemplateId);
      }

      const updatedEserviceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        eserviceDescription,
      };
      await repository.createEvent(
        toCreateEventEServiceTemplateEServiceDescriptionUpdated(
          eserviceTemplate.data.id,
          eserviceTemplate.metadata.version,
          updatedEserviceTemplate,
          correlationId
        )
      );
      return updatedEserviceTemplate;
    },

    async updateEServiceTemplateVersionQuotas(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      seed: eserviceTemplateApi.UpdateEServiceTemplateVersionQuotasSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(
        `Updating e-service template version quotas of EService template ${eserviceTemplateId} version ${eserviceTemplateVersionId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );

      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      const eserviceTemplateVersion = retrieveEServiceTemplateVersion(
        eserviceTemplateVersionId,
        eserviceTemplate.data
      );

      if (
        eserviceTemplateVersion.state !==
          eserviceTemplateVersionState.published &&
        eserviceTemplateVersion.state !== eserviceTemplateVersionState.suspended
      ) {
        throw notValidEServiceTemplateVersionState(
          eserviceTemplateVersionId,
          eserviceTemplateVersion.state
        );
      }

      const dailyCallsPerConsumer =
        seed.dailyCallsPerConsumer ??
        eserviceTemplateVersion.dailyCallsPerConsumer;

      const dailyCallsTotal =
        seed.dailyCallsTotal ?? eserviceTemplateVersion.dailyCallsTotal;

      if (
        dailyCallsPerConsumer !== undefined &&
        dailyCallsTotal !== undefined &&
        dailyCallsPerConsumer > dailyCallsTotal
      ) {
        throw inconsistentDailyCalls();
      }

      const updatedEserviceTemplateVersion: EServiceTemplateVersion = {
        ...eserviceTemplateVersion,
        dailyCallsPerConsumer,
        dailyCallsTotal,
        voucherLifespan: seed.voucherLifespan,
      };

      const updatedEserviceTemplate: EServiceTemplate =
        replaceEServiceTemplateVersion(
          eserviceTemplate.data,
          updatedEserviceTemplateVersion
        );

      await repository.createEvent(
        toCreateEventEServiceTemplateVersionQuotasUpdated(
          eserviceTemplate.data.id,
          eserviceTemplate.metadata.version,
          eserviceTemplateVersionId,
          updatedEserviceTemplate,
          correlationId
        )
      );

      return updatedEserviceTemplate;
    },

    async getEServiceTemplateById(
      eserviceTemplateId: EServiceTemplateId,
      { authData, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(`Retrieving EService template ${eserviceTemplateId}`);
      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );

      return applyVisibilityToEServiceTemplate(eserviceTemplate.data, authData);
    },

    async createRiskAnalysis(
      id: EServiceTemplateId,
      createRiskAnalysis: eserviceTemplateApi.EServiceRiskAnalysisSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(`Creating risk analysis for eServiceTemplateId: ${id}`);

      const template = await retrieveEServiceTemplate(id, readModelService);
      assertRequesterEServiceTemplateCreator(template.data.creatorId, authData);
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
      assertRequesterEServiceTemplateCreator(template.data.creatorId, authData);
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
      assertRequesterEServiceTemplateCreator(template.data.creatorId, authData);
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

function applyVisibilityToEServiceTemplate(
  eserviceTemplate: EServiceTemplate,
  authData: AuthData
): EServiceTemplate {
  if (
    hasPermission(
      [userRoles.ADMIN_ROLE, userRoles.API_ROLE, userRoles.SUPPORT_ROLE],
      authData
    ) &&
    authData.organizationId === eserviceTemplate.creatorId
  ) {
    return eserviceTemplate;
  }

  const hasNoPublishedVersions = eserviceTemplate.versions.every(
    (v) => v.state === eserviceTemplateVersionState.draft
  );

  if (hasNoPublishedVersions) {
    throw eServiceTemplateNotFound(eserviceTemplate.id);
  }

  return {
    ...eserviceTemplate,
    versions: eserviceTemplate.versions.filter(
      (v) => v.state !== eserviceTemplateVersionState.draft
    ),
  };
}

export type EServiceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;
