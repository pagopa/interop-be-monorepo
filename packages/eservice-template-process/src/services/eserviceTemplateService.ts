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
  riskAnalysisFormToRiskAnalysisFormToValidate,
  RiskAnalysisValidationIssue,
} from "pagopa-interop-commons";
import {
  AttributeId,
  EserviceAttributes,
  EServiceTemplate,
  eserviceTemplateEventToBinaryDataV2,
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  EServiceTemplateVersionState,
  eserviceTemplateVersionState,
  ListResult,
  unsafeBrandId,
  WithMetadata,
  EServiceAttribute,
  RiskAnalysis,
  RiskAnalysisId,
  Tenant,
  TenantId,
  TenantKind,
  eserviceMode,
  generateId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  attributeNotFound,
  eServiceTemplateDuplicate,
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  eserviceTemplateWithoutPublishedVersion,
  inconsistentDailyCalls,
  missingRiskAnalysis,
  notValidEServiceTemplateVersionState,
  versionAttributeGroupSupersetMissingInAttributesSeed,
  inconsistentAttributesSeedGroupsCount,
  unchangedAttributes,
  riskAnalysisValidationFailed,
  tenantNotFound,
  originNotCompliant,
  eserviceTemaplateRiskAnalysisNameDuplicate,
  missingTemplateVersionInterface,
} from "../model/domain/errors.js";
import {
  toCreateEventEServiceTemplateVersionActivated,
  toCreateEventEServiceTemplateVersionSuspended,
  toCreateEventEServiceTemplateNameUpdated,
  toCreateEventEServiceTemplateDraftVersionUpdated,
  toCreateEventEServiceTemplateAudienceDescriptionUpdated,
  toCreateEventEServiceTemplateEServiceDescriptionUpdated,
  toCreateEventEServiceTemplateVersionQuotasUpdated,
  toCreateEventEServiceTemplateVersionAttributesUpdated,
  toCreateEventEServiceTemplateRiskAnalysisAdded,
  toCreateEventEServiceTemplateRiskAnalysisDeleted,
  toCreateEventEServiceTemplateRiskAnalysisUpdated,
  toCreateEventEServiceTemplateDeleted,
  toCreateEventEServiceTemplateDraftVersionDeleted,
  toCreateEventEServiceTemplateAdded,
  toCreateEventEServiceTemplateDraftUpdated,
  toCreateEventEServiceTemplateVersionPublished,
} from "../model/domain/toEvent.js";
import { config } from "../config/config.js";
import {
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
} from "../model/domain/apiConverter.js";
import {
  ApiGetEServiceTemplateIstancesFilters,
  EServiceTemplateInstance,
} from "../model/domain/models.js";
import {
  GetEServiceTemplatesFilters,
  ReadModelService,
} from "./readModelService.js";
import {
  assertIsDraftTemplate,
  assertIsReceiveTemplate,
  assertTenantKindExists,
  assertRequesterEServiceTemplateCreator,
  assertIsDraftEserviceTemplate,
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

async function parseAndCheckAttributes(
  attributesSeed: eserviceTemplateApi.AttributesSeed,
  readModelService: ReadModelService
): Promise<EserviceAttributes> {
  const certifiedAttributes = attributesSeed.certified;
  const declaredAttributes = attributesSeed.declared;
  const verifiedAttributes = attributesSeed.verified;

  const attributesSeeds = [
    ...certifiedAttributes.flat(),
    ...declaredAttributes.flat(),
    ...verifiedAttributes.flat(),
  ];

  if (attributesSeeds.length > 0) {
    const attributesSeedsIds: AttributeId[] = attributesSeeds.map((attr) =>
      unsafeBrandId(attr.id)
    );
    const attributes = await readModelService.getAttributesByIds(
      attributesSeedsIds
    );
    const attributesIds = attributes.map((attr) => attr.id);
    for (const attributeSeedId of attributesSeedsIds) {
      if (!attributesIds.includes(unsafeBrandId(attributeSeedId))) {
        throw attributeNotFound(attributeSeedId);
      }
    }
  }

  return {
    certified: certifiedAttributes.map((a) =>
      a.map((a) => ({
        ...a,
        id: unsafeBrandId(a.id),
      }))
    ),
    // eslint-disable-next-line sonarjs/no-identical-functions
    declared: declaredAttributes.map((a) =>
      a.map((a) => ({
        ...a,
        id: unsafeBrandId(a.id),
      }))
    ),
    // eslint-disable-next-line sonarjs/no-identical-functions
    verified: verifiedAttributes.map((a) =>
      a.map((a) => ({
        ...a,
        id: unsafeBrandId(a.id),
      }))
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  fileManager: FileManager
) {
  const repository = eventRepository(
    dbInstance,
    eserviceTemplateEventToBinaryDataV2
  );
  return {
    async updateDraftTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      seed: eserviceTemplateApi.UpdateEServiceTemplateVersionSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(
        `Update draft e-service template version ${eserviceTemplateVersionId} for EService template ${eserviceTemplateId}`
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
        eserviceTemplateVersion.state !== eserviceTemplateVersionState.draft
      ) {
        throw notValidEServiceTemplateVersionState(
          eserviceTemplateVersionId,
          eserviceTemplateVersion.state
        );
      }

      if (
        seed.dailyCallsPerConsumer !== undefined &&
        seed.dailyCallsTotal !== undefined &&
        seed.dailyCallsPerConsumer > seed.dailyCallsTotal
      ) {
        throw inconsistentDailyCalls();
      }

      const parsedAttributes = await parseAndCheckAttributes(
        seed.attributes,
        readModelService
      );

      const updatedVersion: EServiceTemplateVersion = {
        ...eserviceTemplateVersion,
        agreementApprovalPolicy:
          apiAgreementApprovalPolicyToAgreementApprovalPolicy(
            seed.agreementApprovalPolicy
          ),
        dailyCallsPerConsumer: seed.dailyCallsPerConsumer,
        dailyCallsTotal: seed.dailyCallsTotal,
        description: seed.description,
        voucherLifespan: seed.voucherLifespan,
        attributes: parsedAttributes,
      };

      const updatedEServiceTemplate = replaceEServiceTemplateVersion(
        eserviceTemplate.data,
        updatedVersion
      );

      const event = toCreateEventEServiceTemplateDraftVersionUpdated(
        eserviceTemplateId,
        eserviceTemplate.metadata.version,
        eserviceTemplateVersionId,
        updatedEServiceTemplate,
        correlationId
      );
      await repository.createEvent(event);

      return updatedEServiceTemplate;
    },
    async suspendEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Suspending e-service template version ${eserviceTemplateVersionId} for EService template ${eserviceTemplateId}`
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

    async publishEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Publishing e-service template version ${eserviceTemplateVersionId} for EService ${eserviceTemplateId}`
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
        eserviceTemplateVersion.state !== eserviceTemplateVersionState.draft
      ) {
        throw notValidEServiceTemplateVersionState(
          eserviceTemplateVersionId,
          eserviceTemplateVersion.state
        );
      }

      if (eserviceTemplateVersion.interface === undefined) {
        throw missingTemplateVersionInterface(
          eserviceTemplateId,
          eserviceTemplateVersionId
        );
      }

      const tenant = await retrieveTenant(
        eserviceTemplate.data.creatorId,
        readModelService
      );
      assertTenantKindExists(tenant);

      if (eserviceTemplate.data.mode === eserviceMode.receive) {
        if (eserviceTemplate.data.riskAnalysis.length > 0) {
          const riskAnalysisError = eserviceTemplate.data.riskAnalysis.reduce<
            RiskAnalysisValidationIssue[]
          >((acc, ra) => {
            const result = validateRiskAnalysis(
              riskAnalysisFormToRiskAnalysisFormToValidate(ra.riskAnalysisForm),
              true,
              tenant.kind
            );

            if (result.type === "invalid") {
              return [...acc, ...result.issues];
            }

            return acc;
          }, []);

          if (riskAnalysisError.length > 0) {
            throw riskAnalysisValidationFailed(riskAnalysisError);
          }
        } else {
          throw missingRiskAnalysis(eserviceTemplateId);
        }
      }

      const publishedTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        versions: eserviceTemplate.data.versions.map((v) =>
          v.id === eserviceTemplateVersionId
            ? {
                ...v,
                state: eserviceTemplateVersionState.published,
                publishedAt: new Date(),
              }
            : eserviceTemplateVersion.version > v.version
            ? {
                ...v,
                state: eserviceTemplateVersionState.deprecated,
                deprecatedAt: new Date(),
              }
            : v
        ),
      };

      await repository.createEvent(
        toCreateEventEServiceTemplateVersionPublished(
          eserviceTemplateId,
          eserviceTemplate.metadata.version,
          eserviceTemplateVersionId,
          publishedTemplate,
          correlationId
        )
      );
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
    async deleteEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
      logger.info(
        `Deleting EService template ${eserviceTemplateId} version ${eserviceTemplateVersionId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );

      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );
      const version = retrieveEServiceTemplateVersion(
        eserviceTemplateVersionId,
        eserviceTemplate.data
      );
      if (version.state !== eserviceTemplateVersionState.draft) {
        throw notValidEServiceTemplateVersionState(
          eserviceTemplateVersionId,
          version.state
        );
      }

      const isLastVersion = eserviceTemplate.data.versions.length === 1;

      if (version.interface) {
        await fileManager.delete(
          config.s3Bucket,
          version.interface.path,
          logger
        );
      }

      for (const document of version.docs) {
        await fileManager.delete(config.s3Bucket, document.path, logger);
      }

      if (isLastVersion) {
        await repository.createEvent(
          toCreateEventEServiceTemplateDeleted(
            eserviceTemplate.data.id,
            eserviceTemplate.metadata.version,
            eserviceTemplate.data,
            correlationId
          )
        );
      } else {
        const updatedEserviceTemplate: EServiceTemplate = {
          ...eserviceTemplate.data,
          versions: eserviceTemplate.data.versions.filter(
            (v) => v.id !== eserviceTemplateVersionId
          ),
        };

        await repository.createEvent(
          toCreateEventEServiceTemplateDraftVersionDeleted(
            eserviceTemplate.data.id,
            eserviceTemplate.metadata.version,
            eserviceTemplateVersionId,
            updatedEserviceTemplate,
            correlationId
          )
        );
      }
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

    async updateEServiceTemplateVersionAttributes(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      seed: eserviceTemplateApi.AttributesSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(
        `Updating attributes of eservice template version ${eserviceTemplateVersionId} for EService template ${eserviceTemplateId}`
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

      /**
       * In order for the e-service template version attributes to be updatable,
       * each attribute group contained in the seed must be a superset
       * of the corresponding attribute group in the e-service template version,
       * meaning that each attribute group in the seed must contain all the attributes
       * of his corresponding group in the e-service template version, plus, optionally, some ones.
       */
      function validateAndRetrieveNewAttributes(
        attributesVersion: EServiceAttribute[][],
        attributesSeed: eserviceTemplateApi.Attribute[][]
      ): string[] {
        // If the seed has a different number of attribute groups than the e-service template version, it's invalid
        if (attributesVersion.length !== attributesSeed.length) {
          throw inconsistentAttributesSeedGroupsCount(
            eserviceTemplateId,
            eserviceTemplateVersionId
          );
        }

        return attributesVersion.flatMap((attributeGroup) => {
          // Get the seed group that is a superset of the e-service template version group
          const supersetSeed = attributesSeed.find((seedGroup) =>
            attributeGroup.every((versionAttribute) =>
              seedGroup.some(
                (seedAttribute) => versionAttribute.id === seedAttribute.id
              )
            )
          );

          if (!supersetSeed) {
            throw versionAttributeGroupSupersetMissingInAttributesSeed(
              eserviceTemplateId,
              eserviceTemplateVersionId
            );
          }

          // Return only the new attributes
          return supersetSeed
            .filter(
              (seedAttribute) =>
                !attributeGroup.some((att) => att.id === seedAttribute.id)
            )
            .flatMap((seedAttribute) => seedAttribute.id);
        });
      }

      const certifiedAttributes = validateAndRetrieveNewAttributes(
        eserviceTemplateVersion.attributes.certified,
        seed.certified
      );

      const verifiedAttributes = validateAndRetrieveNewAttributes(
        eserviceTemplateVersion.attributes.verified,
        seed.verified
      );

      const declaredAttributes = validateAndRetrieveNewAttributes(
        eserviceTemplateVersion.attributes.declared,
        seed.declared
      );

      const newAttributes = [
        ...certifiedAttributes,
        ...verifiedAttributes,
        ...declaredAttributes,
      ].map(unsafeBrandId<AttributeId>);

      if (newAttributes.length === 0) {
        throw unchangedAttributes(
          eserviceTemplateId,
          eserviceTemplateVersionId
        );
      }

      const updatedEServiceTemplateVersion: EServiceTemplateVersion = {
        ...eserviceTemplateVersion,
        attributes: await parseAndCheckAttributes(seed, readModelService),
      };

      const updatedEServiceTemplate = replaceEServiceTemplateVersion(
        eserviceTemplate.data,
        updatedEServiceTemplateVersion
      );

      await repository.createEvent(
        toCreateEventEServiceTemplateVersionAttributesUpdated(
          eserviceTemplateId,
          eserviceTemplate.metadata.version,
          eserviceTemplateVersionId,
          newAttributes,
          updatedEServiceTemplate,
          correlationId
        )
      );

      return updatedEServiceTemplate;
    },

    async createEServiceTemplate(
      seed: eserviceTemplateApi.EServiceTemplateSeed,
      { logger, authData, correlationId }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(`Creating EService template with name ${seed.name}`);

      if (!config.producerAllowedOrigins.includes(authData.externalId.origin)) {
        throw originNotCompliant(authData.externalId.origin);
      }

      const eserviceTemplateWithSameName =
        await readModelService.getEServiceTemplateByNameAndCreatorId({
          name: seed.name,
          creatorId: authData.organizationId,
        });
      if (eserviceTemplateWithSameName) {
        throw eServiceTemplateDuplicate(seed.name);
      }

      const { dailyCallsPerConsumer, dailyCallsTotal } = seed.version;

      if (
        dailyCallsPerConsumer !== undefined &&
        dailyCallsTotal !== undefined &&
        dailyCallsPerConsumer > dailyCallsTotal
      ) {
        throw inconsistentDailyCalls();
      }

      const creationDate = new Date();
      const draftVersion: EServiceTemplateVersion = {
        id: generateId(),
        description: seed.version.description,
        version: 1,
        interface: undefined,
        docs: [],
        state: eserviceTemplateVersionState.draft,
        voucherLifespan: seed.version.voucherLifespan,
        dailyCallsPerConsumer: seed.version.dailyCallsPerConsumer,
        dailyCallsTotal: seed.version.dailyCallsTotal,
        agreementApprovalPolicy:
          apiAgreementApprovalPolicyToAgreementApprovalPolicy(
            seed.version.agreementApprovalPolicy
          ),
        publishedAt: undefined,
        suspendedAt: undefined,
        deprecatedAt: undefined,
        createdAt: creationDate,
        attributes: { certified: [], declared: [], verified: [] },
      };

      const newEServiceTemplate: EServiceTemplate = {
        id: generateId(),
        creatorId: authData.organizationId,
        name: seed.name,
        audienceDescription: seed.audienceDescription,
        eserviceDescription: seed.eserviceDescription,
        technology: apiTechnologyToTechnology(seed.technology),
        versions: [draftVersion],
        mode: apiEServiceModeToEServiceMode(seed.mode),
        createdAt: creationDate,
        riskAnalysis: [],
        isSignalHubEnabled: seed.isSignalHubEnabled,
      };

      const eserviceTemplateCreationEvent = toCreateEventEServiceTemplateAdded(
        newEServiceTemplate,
        correlationId
      );

      await repository.createEvent(eserviceTemplateCreationEvent);

      return newEServiceTemplate;
    },

    async updateEServiceTemplate(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateSeed: eserviceTemplateApi.UpdateEServiceTemplateSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
      logger.info(`Updating EService template ${eserviceTemplateId}`);

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );

      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      assertIsDraftEserviceTemplate(eserviceTemplate.data);

      if (eserviceTemplateSeed.name !== eserviceTemplate.data.name) {
        const eserviceTemplateWithSameName =
          await readModelService.getEServiceTemplateByNameAndCreatorId({
            name: eserviceTemplateSeed.name,
            creatorId: eserviceTemplate.data.creatorId,
          });
        if (eserviceTemplateWithSameName !== undefined) {
          throw eServiceTemplateDuplicate(eserviceTemplateSeed.name);
        }
      }

      const updatedTechnology = apiTechnologyToTechnology(
        eserviceTemplateSeed.technology
      );
      const interfaceHasToBeDeleted =
        updatedTechnology !== eserviceTemplate.data.technology;

      if (interfaceHasToBeDeleted) {
        await Promise.all(
          eserviceTemplate.data.versions.map(async (d) => {
            if (d.interface !== undefined) {
              return await fileManager.delete(
                config.s3Bucket,
                d.interface.path,
                logger
              );
            }
          })
        );
      }

      const updatedMode = apiEServiceModeToEServiceMode(
        eserviceTemplateSeed.mode
      );

      const checkedRiskAnalysis =
        updatedMode === eserviceMode.receive
          ? eserviceTemplate.data.riskAnalysis
          : [];

      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        name: eserviceTemplateSeed.name,
        audienceDescription: eserviceTemplateSeed.audienceDescription,
        eserviceDescription: eserviceTemplateSeed.eserviceDescription,
        technology: updatedTechnology,
        mode: updatedMode,
        riskAnalysis: checkedRiskAnalysis,
        versions: interfaceHasToBeDeleted
          ? eserviceTemplate.data.versions.map((d) => ({
              ...d,
              interface: undefined,
            }))
          : eserviceTemplate.data.versions,
        isSignalHubEnabled: eserviceTemplateSeed.isSignalHubEnabled,
      };

      const event = toCreateEventEServiceTemplateDraftUpdated(
        eserviceTemplateId,
        eserviceTemplate.metadata.version,
        updatedEServiceTemplate,
        correlationId
      );
      await repository.createEvent(event);

      return updatedEServiceTemplate;
    },
    async getEServiceTemplates(
      filters: GetEServiceTemplatesFilters,
      offset: number,
      limit: number,
      { authData, logger }: WithLogger<AppContext>
    ): Promise<ListResult<EServiceTemplate>> {
      logger.info(
        `Getting EServices templates with name = ${filters.name}, ids = ${filters.eserviceTemplatesIds}, creators = ${filters.creatorsIds}, states = ${filters.states}, limit = ${limit}, offset = ${offset}`
      );

      const { results, totalCount } =
        await readModelService.getEServiceTemplates(
          filters,
          offset,
          limit,
          authData
        );

      return {
        results: results.map((eserviceTemplate) =>
          applyVisibilityToEServiceTemplate(eserviceTemplate, authData)
        ),
        totalCount,
      };
    },
    async getEServiceTemplateIstances(
      eserviceTemplateId: EServiceTemplateId,
      filters: ApiGetEServiceTemplateIstancesFilters,
      offset: number,
      limit: number,
      { authData, logger }: WithLogger<AppContext>
    ): Promise<ListResult<EServiceTemplateInstance>> {
      logger.info(
        `Getting EServices template ${eserviceTemplateId} instances with producer name = ${filters.producerName}, states = ${filters.states}, limit = ${limit}, offset = ${offset}`
      );

      const { data: eserviceTemplate } = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );
      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.creatorId,
        authData
      );

      return await readModelService.getEServiceTemplateInstances({
        eserviceTemplate,
        filters,
        offset,
        limit,
      });
    },
  };
}

export type EServiceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;

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
