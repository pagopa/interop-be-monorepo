import {
  AppContext,
  DB,
  FileManager,
  RiskAnalysisValidatedForm,
  WithLogger,
  eventRepository,
  validateRiskAnalysis,
  Logger,
  UIAuthData,
  M2MAuthData,
  M2MAdminAuthData,
  riskAnalysisValidatedFormToNewEServiceTemplateRiskAnalysis,
  retrieveOriginFromAuthData,
  isFeatureFlagEnabled,
} from "pagopa-interop-commons";
import {
  AttributeId,
  EServiceAttribute,
  EserviceAttributes,
  EServiceTemplate,
  eserviceTemplateEventToBinaryDataV2,
  EServiceTemplateId,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  EServiceTemplateVersionState,
  eserviceTemplateVersionState,
  unsafeBrandId,
  WithMetadata,
  RiskAnalysisId,
  TenantKind,
  eserviceMode,
  generateId,
  ListResult,
  Document,
  EServiceDocumentId,
  EServiceTemplateRiskAnalysis,
  RiskAnalysisForm,
  badRequestError,
  AttributeKind,
  attributeKind,
  TenantId,
  Tenant,
  EServiceTemplateEvent,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  attributeNotFound,
  checksumDuplicate,
  eserviceTemplateNotFound,
  eserviceTemplateVersionNotFound,
  eserviceTemplateDocumentNotFound,
  instanceNameConflict,
  notValidEServiceTemplateVersionState,
  attributeDuplicatedInGroup,
  tenantNotFound,
  missingPersonalDataFlag,
  eserviceTemplatePersonalDataFlagCanOnlyBeSetOnce,
} from "../model/domain/errors.js";
import {
  versionAttributeGroupSupersetMissingInAttributesSeed,
  inconsistentAttributesSeedGroupsCount,
  unchangedAttributes,
  riskAnalysisValidationFailed,
  originNotCompliant,
  eserviceTemplateRiskAnalysisNameDuplicate,
  missingTemplateVersionInterface,
  interfaceAlreadyExists,
  documentPrettyNameDuplicate,
  riskAnalysisNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventEServiceTemplateVersionActivated,
  toCreateEventEServiceTemplateVersionSuspended,
  toCreateEventEServiceTemplateNameUpdated,
  toCreateEventEServiceTemplateDraftVersionUpdated,
  toCreateEventEServiceTemplateIntendedTargetUpdated,
  toCreateEventEServiceTemplateDescriptionUpdated,
  toCreateEventEServiceTemplateVersionQuotasUpdated,
  toCreateEventEServiceTemplateVersionAttributesUpdated,
  toCreateEventEServiceTemplateRiskAnalysisAdded,
  toCreateEventEServiceTemplateRiskAnalysisDeleted,
  toCreateEventEServiceTemplateRiskAnalysisUpdated,
  toCreateEventEServiceTemplateDeleted,
  toCreateEventEServiceTemplateDraftVersionDeleted,
  toCreateEventEServiceTemplateVersionAdded,
  toCreateEventEServiceTemplateAdded,
  toCreateEventEServiceTemplateDraftUpdated,
  toCreateEventEServiceTemplateVersionPublished,
  toCreateEventEServiceTemplateVersionInterfaceAdded,
  toCreateEventEServiceTemplateVersionDocumentAdded,
  toCreateEventEServiceTemplateVersionInterfaceUpdated,
  toCreateEventEServiceTemplateVersionDocumentUpdated,
  toCreateEventEServiceTemplateVersionDocumentDeleted,
  toCreateEventEServiceTemplateVersionInterfaceDeleted,
  toCreateEventEServiceTemplatePersonalDataFlagUpdatedAfterPublication,
} from "../model/domain/toEvent.js";
import { config } from "../config/config.js";
import {
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
} from "../model/domain/apiConverter.js";
import { GetEServiceTemplatesFilters } from "./readModelService.js";
import {
  assertIsReceiveTemplate,
  assertIsDraftEServiceTemplate,
  assertRequesterEServiceTemplateCreator,
  assertNoDraftEServiceTemplateVersions,
  versionStatesNotAllowingDocumentOperations,
  assertConsistentDailyCalls,
  assertPublishedEServiceTemplate,
  hasRoleToAccessDraftTemplateVersions,
  assertEServiceTemplateNameAvailable,
  assertRiskAnalysisIsValidForPublication,
} from "./validators.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const retrieveEServiceTemplate = async (
  eserviceTemplateId: EServiceTemplateId,
  readModelService: ReadModelServiceSQL
): Promise<WithMetadata<EServiceTemplate>> => {
  const eserviceTemplate = await readModelService.getEServiceTemplateById(
    eserviceTemplateId
  );
  if (eserviceTemplate === undefined) {
    throw eserviceTemplateNotFound(eserviceTemplateId);
  }
  return eserviceTemplate;
};

export const retrieveEServiceTemplateRiskAnalysis = (
  eserviceTemplate: EServiceTemplate,
  riskAnalysisId: RiskAnalysisId
): EServiceTemplateRiskAnalysis => {
  const riskAnalysis = eserviceTemplate.riskAnalysis.find(
    (ra) => ra.id === riskAnalysisId
  );
  if (riskAnalysis === undefined) {
    throw riskAnalysisNotFound(eserviceTemplate.id, riskAnalysisId);
  }
  return riskAnalysis;
};

const retrieveEServiceTemplateVersion = (
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplate: EServiceTemplate
): EServiceTemplateVersion => {
  const eserviceTemplateVersion = eserviceTemplate.versions.find(
    (v) => v.id === eserviceTemplateVersionId
  );

  if (eserviceTemplateVersion === undefined) {
    throw eserviceTemplateVersionNotFound(
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

export function validateRiskAnalysisSchemaOrThrow(
  riskAnalysisForm: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed["riskAnalysisForm"],
  tenantKind: TenantKind,
  dateForExpirationValidation: Date
): RiskAnalysisValidatedForm {
  const result = validateRiskAnalysis(
    riskAnalysisForm,
    true,
    tenantKind,
    dateForExpirationValidation
  );
  if (result.type === "invalid") {
    throw riskAnalysisValidationFailed(result.issues);
  } else {
    return result.value;
  }
}

async function parseAndCheckAttributesOfKind(
  attributesSeedForKind: eserviceTemplateApi.AttributeSeed[][],
  kind: AttributeKind,
  readModelService: ReadModelServiceSQL
): Promise<EServiceAttribute[][]> {
  const parsedAttributesSeed = attributesSeedForKind.map((group) => {
    const groupAttributesIdsFound: Set<AttributeId> = new Set();
    return group.map((att) => {
      const id = unsafeBrandId<AttributeId>(att.id);
      if (groupAttributesIdsFound.has(id)) {
        throw attributeDuplicatedInGroup(id);
      }

      groupAttributesIdsFound.add(id);
      return {
        ...att,
        id,
      };
    });
  });

  const attributesSeedIds: AttributeId[] = parsedAttributesSeed
    .flat()
    .map(({ id }) => id);

  const attributes = await readModelService.getAttributesByIds(
    attributesSeedIds,
    kind
  );

  const attributesIds = attributes.map((attr) => attr.id);
  attributesSeedIds.forEach((attributeId) => {
    if (!attributesIds.includes(attributeId)) {
      throw attributeNotFound(attributeId);
    }
  });

  return parsedAttributesSeed;
}

export async function parseAndCheckAttributes(
  attributesSeed: eserviceTemplateApi.AttributesSeed,
  readModelService: ReadModelServiceSQL
): Promise<EserviceAttributes> {
  const [certifiedAttributes, declaredAttributes, verifiedAttributes] =
    await Promise.all([
      parseAndCheckAttributesOfKind(
        attributesSeed.certified,
        attributeKind.certified,
        readModelService
      ),
      parseAndCheckAttributesOfKind(
        attributesSeed.declared,
        attributeKind.declared,
        readModelService
      ),
      parseAndCheckAttributesOfKind(
        attributesSeed.verified,
        attributeKind.verified,
        readModelService
      ),
    ]);

  return {
    certified: certifiedAttributes,
    declared: declaredAttributes,
    verified: verifiedAttributes,
  };
}

const retrieveDocument = (
  eserviceTemplateId: EServiceTemplateId,
  eserviceTemplateVersion: EServiceTemplateVersion,
  documentId: EServiceDocumentId
): Document => {
  const document = [
    ...eserviceTemplateVersion.docs,
    eserviceTemplateVersion.interface,
  ].find((doc) => doc != null && doc.id === documentId);
  if (document === undefined) {
    throw eserviceTemplateDocumentNotFound(
      eserviceTemplateId,
      eserviceTemplateVersion.id,
      documentId
    );
  }
  return document;
};

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: Pick<ReadModelServiceSQL, "getTenantById">
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceTemplateServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelServiceSQL,
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
      ctx: WithLogger<AppContext<UIAuthData>>
    ): Promise<EServiceTemplate> {
      const result = await updateDraftEServiceTemplateVersion(
        eserviceTemplateId,
        eserviceTemplateVersionId,
        { type: "post", seed },
        readModelService,
        repository,
        ctx
      );

      return result.data;
    },
    async patchUpdateDraftTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      seed: eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed,
      ctx: WithLogger<AppContext<M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
      return await updateDraftEServiceTemplateVersion(
        eserviceTemplateId,
        eserviceTemplateVersionId,
        { type: "patch", seed },
        readModelService,
        repository,
        ctx
      );
    },
    async suspendEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
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

      const eventCreation = toCreateEventEServiceTemplateVersionSuspended(
        eserviceTemplateId,
        eserviceTemplate.metadata.version,
        eserviceTemplateVersionId,
        updatedEServiceTemplate,
        correlationId
      );

      const event = await repository.createEvent(eventCreation);
      return {
        data: updatedEServiceTemplate,
        metadata: { version: event.newVersion },
      };
    },

    async publishEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
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

      if (eserviceTemplate.data.mode === eserviceMode.receive) {
        assertRiskAnalysisIsValidForPublication(eserviceTemplate.data);
      }
      if (
        isFeatureFlagEnabled(config, "featureFlagEservicePersonalData") &&
        eserviceTemplate.data.personalData === undefined
      ) {
        throw missingPersonalDataFlag(
          eserviceTemplateId,
          eserviceTemplateVersionId
        );
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

      const event = await repository.createEvent(
        toCreateEventEServiceTemplateVersionPublished(
          eserviceTemplateId,
          eserviceTemplate.metadata.version,
          eserviceTemplateVersionId,
          publishedTemplate,
          correlationId
        )
      );
      return {
        data: publishedTemplate,
        metadata: { version: event.newVersion },
      };
    },

    async activateEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
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

      const eventCreation = toCreateEventEServiceTemplateVersionActivated(
        eserviceTemplateId,
        eserviceTemplate.metadata.version,
        eserviceTemplateVersionId,
        updatedEServiceTemplate,
        correlationId
      );

      const event = await repository.createEvent(eventCreation);
      return {
        data: updatedEServiceTemplate,
        metadata: { version: event.newVersion },
      };
    },

    async updateEServiceTemplateName(
      eserviceTemplateId: EServiceTemplateId,
      name: string,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
      logger.info(`Updating name of EService template ${eserviceTemplateId}`);

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );
      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      assertPublishedEServiceTemplate(eserviceTemplate.data);

      if (name !== eserviceTemplate.data.name) {
        await assertEServiceTemplateNameAvailable(name, readModelService);

        const hasConflictingInstances =
          await readModelService.checkNameConflictInstances(
            eserviceTemplate.data,
            name
          );

        if (hasConflictingInstances) {
          throw instanceNameConflict(eserviceTemplateId);
        }
      }

      const updatedEserviceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        name,
      };

      const event = await repository.createEvent(
        toCreateEventEServiceTemplateNameUpdated(
          eserviceTemplate.data.id,
          eserviceTemplate.metadata.version,
          updatedEserviceTemplate,
          eserviceTemplate.data.name,
          correlationId
        )
      );
      return {
        data: updatedEserviceTemplate,
        metadata: { version: event.newVersion },
      };
    },
    async updateEServiceTemplateIntendedTarget(
      eserviceTemplateId: EServiceTemplateId,
      intendedTarget: string,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
      logger.info(
        `Updating intended target description of EService template ${eserviceTemplateId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );
      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      assertPublishedEServiceTemplate(eserviceTemplate.data);

      const updatedEserviceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        intendedTarget,
      };
      const event = await repository.createEvent(
        toCreateEventEServiceTemplateIntendedTargetUpdated(
          eserviceTemplate.data.id,
          eserviceTemplate.metadata.version,
          updatedEserviceTemplate,
          correlationId
        )
      );
      return {
        data: updatedEserviceTemplate,
        metadata: { version: event.newVersion },
      };
    },

    async updateEServiceTemplateDescription(
      eserviceTemplateId: EServiceTemplateId,
      description: string,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
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

      assertPublishedEServiceTemplate(eserviceTemplate.data);

      const updatedEserviceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        description,
      };
      const event = await repository.createEvent(
        toCreateEventEServiceTemplateDescriptionUpdated(
          eserviceTemplate.data.id,
          eserviceTemplate.metadata.version,
          updatedEserviceTemplate,
          correlationId
        )
      );
      return {
        data: updatedEserviceTemplate,
        metadata: { version: event.newVersion },
      };
    },

    async updateEServiceTemplateVersionQuotas(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      seed: eserviceTemplateApi.UpdateEServiceTemplateVersionQuotasSeed,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
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

      assertConsistentDailyCalls({ dailyCallsPerConsumer, dailyCallsTotal });

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

      const event = await repository.createEvent(
        toCreateEventEServiceTemplateVersionQuotasUpdated(
          eserviceTemplate.data.id,
          eserviceTemplate.metadata.version,
          eserviceTemplateVersionId,
          updatedEserviceTemplate,
          correlationId
        )
      );

      return {
        data: updatedEserviceTemplate,
        metadata: { version: event.newVersion },
      };
    },
    async getEServiceTemplateById(
      eserviceTemplateId: EServiceTemplateId,
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
      logger.info(`Retrieving EService template ${eserviceTemplateId}`);

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );
      return {
        data: applyVisibilityToEServiceTemplate(
          eserviceTemplate.data,
          authData
        ),
        metadata: eserviceTemplate.metadata,
      };
    },
    async deleteEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate> | undefined> {
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
        return undefined;
      } else {
        const updatedEserviceTemplate: EServiceTemplate = {
          ...eserviceTemplate.data,
          versions: eserviceTemplate.data.versions.filter(
            (v) => v.id !== eserviceTemplateVersionId
          ),
        };

        const event = await repository.createEvent(
          toCreateEventEServiceTemplateDraftVersionDeleted(
            eserviceTemplate.data.id,
            eserviceTemplate.metadata.version,
            eserviceTemplateVersionId,
            updatedEserviceTemplate,
            correlationId
          )
        );
        return {
          data: updatedEserviceTemplate,
          metadata: { version: event.newVersion },
        };
      }
    },
    async createRiskAnalysis(
      id: EServiceTemplateId,
      createRiskAnalysis: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<
      WithMetadata<{
        eserviceTemplate: EServiceTemplate;
        createdRiskAnalysisId: RiskAnalysisId;
      }>
    > {
      logger.info(`Creating risk analysis for eServiceTemplateId: ${id}`);

      const template = await retrieveEServiceTemplate(id, readModelService);
      assertRequesterEServiceTemplateCreator(template.data.creatorId, authData);
      assertIsDraftEServiceTemplate(template.data);
      assertIsReceiveTemplate(template.data);

      const raSameName = template.data.riskAnalysis.find(
        (ra) => ra.name === createRiskAnalysis.name
      );
      if (raSameName) {
        throw eserviceTemplateRiskAnalysisNameDuplicate(
          createRiskAnalysis.name
        );
      }

      const validatedRiskAnalysisForm = validateRiskAnalysisSchemaOrThrow(
        createRiskAnalysis.riskAnalysisForm,
        createRiskAnalysis.tenantKind,
        new Date()
      );

      const newRiskAnalysis: EServiceTemplateRiskAnalysis =
        riskAnalysisValidatedFormToNewEServiceTemplateRiskAnalysis(
          validatedRiskAnalysisForm,
          createRiskAnalysis.name,
          createRiskAnalysis.tenantKind
        );

      const newTemplate: EServiceTemplate = {
        ...template.data,
        riskAnalysis: [...template.data.riskAnalysis, newRiskAnalysis],
      };

      const event = await repository.createEvent(
        toCreateEventEServiceTemplateRiskAnalysisAdded(
          template.data.id,
          template.metadata.version,
          newRiskAnalysis.id,
          newTemplate,
          correlationId
        )
      );

      return {
        data: {
          eserviceTemplate: newTemplate,
          createdRiskAnalysisId: newRiskAnalysis.id,
        },
        metadata: { version: event.newVersion },
      };
    },
    async deleteRiskAnalysis(
      templateId: EServiceTemplateId,
      riskAnalysisId: RiskAnalysisId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
      logger.info(
        `Deleting risk analysis with id: ${riskAnalysisId} from eServiceTemplate with id: ${templateId}`
      );

      const template = await retrieveEServiceTemplate(
        templateId,
        readModelService
      );
      assertRequesterEServiceTemplateCreator(template.data.creatorId, authData);
      assertIsDraftEServiceTemplate(template.data);
      assertIsReceiveTemplate(template.data);

      const newTemplate: EServiceTemplate = {
        ...template.data,
        riskAnalysis: template.data.riskAnalysis.filter(
          (ra) => ra.id !== riskAnalysisId
        ),
      };

      const event = await repository.createEvent(
        toCreateEventEServiceTemplateRiskAnalysisDeleted(
          template.data.id,
          template.metadata.version,
          riskAnalysisId,
          newTemplate,
          correlationId
        )
      );

      return {
        data: newTemplate,
        metadata: { version: event.newVersion },
      };
    },
    async updateRiskAnalysis(
      templateId: EServiceTemplateId,
      riskAnalysisId: RiskAnalysisId,
      updateRiskAnalysisSeed: eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(
        `Updating risk analysis with id: ${riskAnalysisId} from eServiceTemplate with id: ${templateId}`
      );

      const template = await retrieveEServiceTemplate(
        templateId,
        readModelService
      );

      assertRequesterEServiceTemplateCreator(template.data.creatorId, authData);
      assertIsDraftEServiceTemplate(template.data);
      assertIsReceiveTemplate(template.data);

      const riskAnalysisToUpdate = retrieveEServiceTemplateRiskAnalysis(
        template.data,
        riskAnalysisId
      );

      const validatedForm = validateRiskAnalysisSchemaOrThrow(
        updateRiskAnalysisSeed.riskAnalysisForm,
        updateRiskAnalysisSeed.tenantKind,
        new Date()
      );

      const updatedRiskAnalysisForm: RiskAnalysisForm = {
        id: riskAnalysisToUpdate.riskAnalysisForm.id,
        version: validatedForm.version,
        singleAnswers: validatedForm.singleAnswers.map((a) => ({
          ...a,
          id: generateId(),
        })),
        multiAnswers: validatedForm.multiAnswers.map((a) => ({
          ...a,
          id: generateId(),
        })),
      };

      const updatedRiskAnalysis: EServiceTemplateRiskAnalysis = {
        id: riskAnalysisToUpdate.id,
        createdAt: riskAnalysisToUpdate.createdAt,
        name: updateRiskAnalysisSeed.name,
        tenantKind: updateRiskAnalysisSeed.tenantKind,
        riskAnalysisForm: updatedRiskAnalysisForm,
      };

      const updatedTemplate: EServiceTemplate = {
        ...template.data,
        riskAnalysis: template.data.riskAnalysis.map((ra) =>
          ra.id === riskAnalysisToUpdate.id ? updatedRiskAnalysis : ra
        ),
      };

      const event = toCreateEventEServiceTemplateRiskAnalysisUpdated(
        template.data.id,
        template.metadata.version,
        riskAnalysisId,
        updatedTemplate,
        correlationId
      );

      await repository.createEvent(event);
    },
    async updateEServiceTemplateVersionAttributes(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      seed: eserviceTemplateApi.AttributesSeed,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
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
      {
        logger,
        authData,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
      logger.info(`Creating EService template with name ${seed.name}`);

      if (seed.mode === eserviceTemplateApi.EServiceMode.Values.RECEIVE) {
        throw badRequestError(
          "EService template in RECEIVE mode is not supported"
        );
      }

      const origin = await retrieveOriginFromAuthData(
        authData,
        readModelService,
        retrieveTenant
      );

      if (!config.producerAllowedOrigins.includes(origin)) {
        throw originNotCompliant(origin);
      }

      await assertEServiceTemplateNameAvailable(seed.name, readModelService);

      assertConsistentDailyCalls(seed.version);

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
        agreementApprovalPolicy: seed.version.agreementApprovalPolicy
          ? apiAgreementApprovalPolicyToAgreementApprovalPolicy(
              seed.version.agreementApprovalPolicy
            )
          : undefined,
        publishedAt: undefined,
        suspendedAt: undefined,
        deprecatedAt: undefined,
        createdAt: creationDate,
        attributes: { certified: [], declared: [], verified: [] },
      };

      const eserviceTemplate: EServiceTemplate = {
        id: generateId(),
        creatorId: authData.organizationId,
        name: seed.name,
        intendedTarget: seed.intendedTarget,
        description: seed.description,
        technology: apiTechnologyToTechnology(seed.technology),
        versions: [draftVersion],
        mode: apiEServiceModeToEServiceMode(seed.mode),
        createdAt: creationDate,
        riskAnalysis: [],
        isSignalHubEnabled: seed.isSignalHubEnabled,
        ...(isFeatureFlagEnabled(config, "featureFlagEservicePersonalData")
          ? { personalData: seed.personalData }
          : {}),
      };

      const eserviceTemplateCreationEvent = toCreateEventEServiceTemplateAdded(
        eserviceTemplate,
        correlationId
      );

      const event = await repository.createEvent(eserviceTemplateCreationEvent);

      return {
        data: eserviceTemplate,
        metadata: { version: event.newVersion },
      };
    },
    async updateEServiceTemplate(
      templateId: EServiceTemplateId,
      eserviceTemplateSeed: eserviceTemplateApi.UpdateEServiceTemplateSeed,
      ctx: WithLogger<AppContext<UIAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
      ctx.logger.info(`Updating EService Template ${templateId}`);
      return updateDraftEServiceTemplate(
        templateId,
        { type: "post", seed: eserviceTemplateSeed },
        readModelService,
        fileManager,
        repository,
        ctx
      );
    },

    async patchUpdateEServiceTemplate(
      templateId: EServiceTemplateId,
      eserviceTemplateSeed: eserviceTemplateApi.PatchUpdateEServiceTemplateSeed,
      ctx: WithLogger<AppContext<M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
      ctx.logger.info(`Partially updating EService Template ${templateId}`);
      return updateDraftEServiceTemplate(
        templateId,
        { type: "patch", seed: eserviceTemplateSeed },
        readModelService,
        fileManager,
        repository,
        ctx
      );
    },
    async createEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<EServiceTemplateVersion> {
      logger.info(
        `Creating new eservice template version for EService template ${eserviceTemplateId}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );

      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );
      assertPublishedEServiceTemplate(eserviceTemplate.data);
      assertNoDraftEServiceTemplateVersions(eserviceTemplate.data);

      const previousVersion = eserviceTemplate.data.versions.reduce(
        (latestVersions, curr) =>
          curr.version > latestVersions.version ? curr : latestVersions,
        eserviceTemplate.data.versions[0]
      );

      const newVersion = previousVersion.version + 1;

      const newEServiceTemplateVersionId: EServiceTemplateVersionId =
        generateId();

      const newEServiceTemplateVersion: EServiceTemplateVersion = {
        id: newEServiceTemplateVersionId,
        description: previousVersion.description,
        version: newVersion,
        interface: undefined,
        docs: [],
        state: eserviceTemplateVersionState.draft,
        voucherLifespan: previousVersion.voucherLifespan,
        dailyCallsPerConsumer: previousVersion.dailyCallsPerConsumer,
        dailyCallsTotal: previousVersion.dailyCallsTotal,
        agreementApprovalPolicy: previousVersion.agreementApprovalPolicy,
        publishedAt: undefined,
        suspendedAt: undefined,
        deprecatedAt: undefined,
        createdAt: new Date(),
        attributes: previousVersion.attributes,
      };

      const newEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        versions: [
          ...eserviceTemplate.data.versions,
          newEServiceTemplateVersion,
        ],
      };

      const eserviceTemplateVersionCreationEvent =
        toCreateEventEServiceTemplateVersionAdded(
          eserviceTemplateId,
          eserviceTemplate.metadata.version,
          newEServiceTemplateVersionId,
          newEServiceTemplate,
          correlationId
        );

      const eserviceTemplateVersion = eserviceTemplate.metadata.version;

      const events = [eserviceTemplateVersionCreationEvent];
      // eslint-disable-next-line functional/no-let
      let eserviceTemplateVersionWithDocs: EServiceTemplateVersion =
        newEServiceTemplateVersion;

      for (const [index, doc] of previousVersion.docs.entries()) {
        const newDocument = await cloneEServiceTemplateDocument({
          doc,
          fileManager,
          logger,
        });

        eserviceTemplateVersionWithDocs = {
          ...eserviceTemplateVersionWithDocs,
          docs: [...eserviceTemplateVersionWithDocs.docs, newDocument],
        };

        const updatedEServiceTemplate = replaceEServiceTemplateVersion(
          newEServiceTemplate,
          eserviceTemplateVersionWithDocs
        );

        const version = eserviceTemplateVersion + index + 1;
        const documentEvent = toCreateEventEServiceTemplateVersionDocumentAdded(
          eserviceTemplateId,
          version,
          newEServiceTemplateVersionId,
          newDocument.id,
          updatedEServiceTemplate,
          correlationId
        );

        // eslint-disable-next-line functional/immutable-data
        events.push(documentEvent);
      }

      await repository.createEvents(events);

      return eserviceTemplateVersionWithDocs;
    },
    async getEServiceTemplates(
      filters: GetEServiceTemplatesFilters,
      offset: number,
      limit: number,
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<EServiceTemplate>> {
      logger.info(
        `Getting EServices templates with name = ${filters.name}, ids = ${filters.eserviceTemplatesIds}, creators = ${filters.creatorsIds}, states = ${filters.states}, personalData = ${filters.personalData}, limit = ${limit}, offset = ${offset}`
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
    async getEServiceTemplateCreators(
      creatorName: string | undefined,
      limit: number,
      offset: number,
      { logger }: WithLogger<AppContext>
    ): Promise<ListResult<eserviceTemplateApi.CompactOrganization>> {
      logger.info(
        `Retrieving eservice template creator with name ${creatorName}, limit ${limit}, offset ${offset}`
      );
      return await readModelService.getCreators(creatorName, limit, offset);
    },
    async createEServiceTemplateDocument(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      document: eserviceTemplateApi.CreateEServiceTemplateVersionDocumentSeed,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Document>> {
      logger.info(
        `Creating EService Document ${document.documentId.toString()} of kind ${
          document.kind
        }, name ${document.fileName}, path ${
          document.filePath
        } for EService Template ${eserviceTemplateId} and Version ${eserviceTemplateVersionId}`
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

      if (document.kind === "INTERFACE" && version.interface !== undefined) {
        throw interfaceAlreadyExists(version.id);
      }

      if (
        document.kind === "DOCUMENT" &&
        version.docs.some(
          (d) =>
            d.prettyName.toLowerCase() === document.prettyName.toLowerCase()
        )
      ) {
        throw documentPrettyNameDuplicate(document.prettyName, version.id);
      }

      if (
        document.kind === "DOCUMENT" &&
        version.docs.some((d) => d.checksum === document.checksum)
      ) {
        throw checksumDuplicate(eserviceTemplate.data.id, version.id);
      }

      const isInterface = document.kind === "INTERFACE";
      const newDocument: Document = {
        id: unsafeBrandId(document.documentId),
        name: document.fileName,
        contentType: document.contentType,
        prettyName: document.prettyName,
        path: document.filePath,
        checksum: document.checksum,
        uploadDate: new Date(),
      };

      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        versions: eserviceTemplate.data.versions.map(
          (v: EServiceTemplateVersion) =>
            v.id === eserviceTemplateVersionId
              ? {
                  ...v,
                  interface: isInterface ? newDocument : v.interface,
                  docs: isInterface ? v.docs : [...v.docs, newDocument],
                }
              : v
        ),
      };

      const event =
        document.kind === "INTERFACE"
          ? toCreateEventEServiceTemplateVersionInterfaceAdded(
              eserviceTemplateId,
              eserviceTemplate.metadata.version,
              eserviceTemplateVersionId,
              unsafeBrandId(document.documentId),
              updatedEServiceTemplate,
              correlationId
            )
          : toCreateEventEServiceTemplateVersionDocumentAdded(
              eserviceTemplateId,
              eserviceTemplate.metadata.version,
              eserviceTemplateVersionId,
              unsafeBrandId(document.documentId),
              updatedEServiceTemplate,
              correlationId
            );

      const createdEvent = await repository.createEvent(event);

      return {
        data: newDocument,
        metadata: {
          version: createdEvent.newVersion,
        },
      };
    },

    async getEServiceTemplateDocument(
      {
        eServiceTemplateId,
        eServiceTemplateVersionId,
        documentId,
      }: {
        eServiceTemplateId: EServiceTemplateId;
        eServiceTemplateVersionId: EServiceTemplateVersionId;
        documentId: EServiceDocumentId;
      },
      {
        authData,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData | M2MAuthData>>
    ): Promise<Document> {
      logger.info(
        `Getting EService Document ${documentId.toString()} for EService Template ${eServiceTemplateId} and Version ${eServiceTemplateVersionId}`
      );

      const eServiceTemplate = await retrieveEServiceTemplate(
        eServiceTemplateId,
        readModelService
      );

      const version = retrieveEServiceTemplateVersion(
        eServiceTemplateVersionId,
        eServiceTemplate.data
      );

      const checkedTemplate = applyVisibilityToEServiceTemplate(
        eServiceTemplate.data,
        authData
      );

      if (
        !checkedTemplate.versions.find(
          (v) => v.id === eServiceTemplateVersionId
        )
      ) {
        throw eserviceTemplateDocumentNotFound(
          eServiceTemplateId,
          eServiceTemplateVersionId,
          documentId
        );
      }

      return retrieveDocument(eServiceTemplateId, version, documentId);
    },
    async updateDocument(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      documentId: EServiceDocumentId,
      apiEServiceDescriptorDocumentUpdateSeed: eserviceTemplateApi.UpdateEServiceTemplateVersionDocumentSeed,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<Document> {
      logger.info(
        `Updating Document ${documentId} of Version ${eserviceTemplateVersionId} for EService template ${eserviceTemplateId}`
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

      if (versionStatesNotAllowingDocumentOperations(version)) {
        throw notValidEServiceTemplateVersionState(version.id, version.state);
      }

      const document = retrieveDocument(
        eserviceTemplateId,
        version,
        documentId
      );

      if (
        version.docs.some(
          (d) =>
            d.id !== documentId &&
            d.prettyName.toLowerCase() ===
              apiEServiceDescriptorDocumentUpdateSeed.prettyName.toLowerCase()
        )
      ) {
        throw documentPrettyNameDuplicate(
          apiEServiceDescriptorDocumentUpdateSeed.prettyName,
          version.id
        );
      }

      const updatedDocument: Document = {
        ...document,
        prettyName: apiEServiceDescriptorDocumentUpdateSeed.prettyName,
      };

      const isInterface = document.id === version?.interface?.id;
      const newEserviceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        versions: eserviceTemplate.data.versions.map(
          (v: EServiceTemplateVersion) =>
            v.id === eserviceTemplateVersionId
              ? {
                  ...v,
                  interface: isInterface ? updatedDocument : v.interface,
                  docs: v.docs.map((doc) =>
                    doc.id === documentId ? updatedDocument : doc
                  ),
                }
              : v
        ),
      };

      const event = isInterface
        ? toCreateEventEServiceTemplateVersionInterfaceUpdated(
            eserviceTemplateId,
            eserviceTemplate.metadata.version,
            eserviceTemplateVersionId,
            documentId,
            newEserviceTemplate,
            correlationId
          )
        : toCreateEventEServiceTemplateVersionDocumentUpdated(
            eserviceTemplateId,
            eserviceTemplate.metadata.version,
            eserviceTemplateVersionId,
            documentId,
            newEserviceTemplate,
            correlationId
          );

      await repository.createEvent(event);
      return updatedDocument;
    },
    async deleteDocument(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      documentId: EServiceDocumentId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<EServiceTemplate>> {
      logger.info(
        `Deleting Document ${documentId} of Version ${eserviceTemplateVersionId} for EService template ${eserviceTemplateId}`
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

      if (versionStatesNotAllowingDocumentOperations(version)) {
        throw notValidEServiceTemplateVersionState(version.id, version.state);
      }

      const document = retrieveDocument(
        eserviceTemplateId,
        version,
        documentId
      );

      const isInterface = document.id === version?.interface?.id;

      if (isInterface) {
        if (version.state !== eserviceTemplateVersionState.draft) {
          throw notValidEServiceTemplateVersionState(version.id, version.state);
        }
      } else {
        if (version.state === eserviceTemplateVersionState.deprecated) {
          throw notValidEServiceTemplateVersionState(version.id, version.state);
        }
      }

      await fileManager.delete(config.s3Bucket, document.path, logger);

      const updatedEServiceTemplate = replaceEServiceTemplateVersion(
        eserviceTemplate.data,
        {
          ...version,
          interface: isInterface ? undefined : version.interface,
          docs: version.docs.filter((doc) => doc.id !== documentId),
        }
      );

      const event = isInterface
        ? toCreateEventEServiceTemplateVersionInterfaceDeleted(
            eserviceTemplate.data.id,
            eserviceTemplate.metadata.version,
            eserviceTemplateVersionId,
            documentId,
            updatedEServiceTemplate,
            correlationId
          )
        : toCreateEventEServiceTemplateVersionDocumentDeleted(
            eserviceTemplate.data.id,
            eserviceTemplate.metadata.version,
            eserviceTemplateVersionId,
            documentId,
            updatedEServiceTemplate,
            correlationId
          );

      const createdEvent = await repository.createEvent(event);

      return {
        data: updatedEServiceTemplate,
        metadata: {
          version: createdEvent.newVersion,
        },
      };
    },
    async updateEServiceTemplatePersonalDataFlagAfterPublication(
      eserviceTemplateId: EServiceTemplateId,
      personalData: boolean,
      { authData, correlationId, logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<EServiceTemplate> {
      logger.info(
        `Setting personalData flag for EServiceTemplate ${eserviceTemplateId} to ${personalData}`
      );

      const eserviceTemplate = await retrieveEServiceTemplate(
        eserviceTemplateId,
        readModelService
      );

      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );

      assertPublishedEServiceTemplate(eserviceTemplate.data);

      if (eserviceTemplate.data.personalData !== undefined) {
        throw eserviceTemplatePersonalDataFlagCanOnlyBeSetOnce(
          eserviceTemplateId
        );
      }

      const updatedEServiceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        personalData,
      };

      const event =
        toCreateEventEServiceTemplatePersonalDataFlagUpdatedAfterPublication(
          eserviceTemplate.metadata.version,
          updatedEServiceTemplate,
          correlationId
        );

      await repository.createEvent(event);

      return updatedEServiceTemplate;
    },

    async deleteEServiceTemplate(
      templateId: EServiceTemplateId,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<void> {
      logger.info(`Deleting EService Template ${templateId}`);

      const eserviceTemplate = await retrieveEServiceTemplate(
        templateId,
        readModelService
      );
      assertRequesterEServiceTemplateCreator(
        eserviceTemplate.data.creatorId,
        authData
      );
      assertIsDraftEServiceTemplate(eserviceTemplate.data);

      if (eserviceTemplate.data.versions.length === 0) {
        const eserviceTemplateDeletionEvent =
          toCreateEventEServiceTemplateDeleted(
            eserviceTemplate.data.id,
            eserviceTemplate.metadata.version,
            eserviceTemplate.data,
            correlationId
          );
        await repository.createEvent(eserviceTemplateDeletionEvent);
      } else {
        await deleteVersionInterfaceAndDocs(
          eserviceTemplate.data.versions[0],
          fileManager,
          logger
        );

        const eserviceTemplateWithoutVersions: EServiceTemplate = {
          ...eserviceTemplate.data,
          versions: [],
        };
        const versionDeletionEvent =
          toCreateEventEServiceTemplateDraftVersionDeleted(
            eserviceTemplate.data.id,
            eserviceTemplate.metadata.version,
            eserviceTemplate.data.versions[0].id,
            eserviceTemplateWithoutVersions,
            correlationId
          );
        const eserviceTemplateDeletionEvent =
          toCreateEventEServiceTemplateDeleted(
            eserviceTemplate.data.id,
            eserviceTemplate.metadata.version + 1,
            eserviceTemplateWithoutVersions,
            correlationId
          );
        await repository.createEvents([
          versionDeletionEvent,
          eserviceTemplateDeletionEvent,
        ]);
      }
    },
  };
}

export type EServiceTemplateService = ReturnType<
  typeof eserviceTemplateServiceBuilder
>;

function applyVisibilityToEServiceTemplate(
  eserviceTemplate: EServiceTemplate,
  authData: UIAuthData | M2MAuthData | M2MAdminAuthData
): EServiceTemplate {
  if (
    hasRoleToAccessDraftTemplateVersions(authData) &&
    authData.organizationId === eserviceTemplate.creatorId
  ) {
    return eserviceTemplate;
  }

  const hasPublishedVersions = eserviceTemplate.versions.some(
    (v) => v.state !== eserviceTemplateVersionState.draft
  );

  if (hasPublishedVersions) {
    return {
      ...eserviceTemplate,
      versions: eserviceTemplate.versions.filter(
        (v) => v.state !== eserviceTemplateVersionState.draft
      ),
    };
  }

  throw eserviceTemplateNotFound(eserviceTemplate.id);
}

export async function cloneEServiceTemplateDocument({
  doc,
  fileManager,
  logger,
}: {
  doc: Document;
  fileManager: FileManager;
  logger: Logger;
}): Promise<Document> {
  const clonedDocumentId: EServiceDocumentId = generateId();

  const clonedPath = await fileManager.copy(
    config.s3Bucket,
    doc.path,
    config.eserviceTemplateDocumentsPath,
    clonedDocumentId,
    doc.name,
    logger
  );

  return {
    id: clonedDocumentId,
    contentType: doc.contentType,
    prettyName: doc.prettyName,
    name: doc.name,
    path: clonedPath,
    checksum: doc.checksum,
    uploadDate: new Date(),
  };
}

// eslint-disable-next-line max-params
async function updateDraftEServiceTemplate(
  eserviceTemplateId: EServiceTemplateId,
  typeAndSeed:
    | {
        type: "post";
        seed: eserviceTemplateApi.UpdateEServiceTemplateSeed;
      }
    | {
        type: "patch";
        seed: eserviceTemplateApi.PatchUpdateEServiceTemplateSeed;
      },
  readModelService: ReadModelServiceSQL,
  fileManager: FileManager,
  repository: ReturnType<typeof eventRepository<EServiceTemplateEvent>>,
  {
    authData,
    correlationId,
    logger,
  }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
): Promise<WithMetadata<EServiceTemplate>> {
  const eserviceTemplate = await retrieveEServiceTemplate(
    eserviceTemplateId,
    readModelService
  );

  assertRequesterEServiceTemplateCreator(
    eserviceTemplate.data.creatorId,
    authData
  );

  assertIsDraftEServiceTemplate(eserviceTemplate.data);

  const {
    name,
    description,
    technology,
    mode,
    isSignalHubEnabled,
    intendedTarget,
  } = typeAndSeed.seed;

  if (name && name !== eserviceTemplate.data.name) {
    await assertEServiceTemplateNameAvailable(name, readModelService);
  }

  const updatedTechnology = technology
    ? apiTechnologyToTechnology(technology)
    : eserviceTemplate.data.technology;

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

  const updatedMode = mode
    ? apiEServiceModeToEServiceMode(mode)
    : eserviceTemplate.data.mode;

  const checkedRiskAnalysis =
    updatedMode === eserviceMode.receive
      ? eserviceTemplate.data.riskAnalysis
      : [];

  const updatedIsSignalHubEnabled = match(typeAndSeed.type)
    .with("post", () => isSignalHubEnabled)
    .with(
      "patch",
      () => isSignalHubEnabled ?? eserviceTemplate.data.isSignalHubEnabled
    )
    .exhaustive();

  const updatedPersonalData = match(typeAndSeed)
    .with({ type: "post" }, ({ seed }) => seed.personalData)
    .with(
      { type: "patch" },
      ({ seed }) =>
        seed.personalData ??
        (seed.personalData === null
          ? undefined
          : eserviceTemplate.data.personalData)
    )
    .exhaustive();
  const updatedEServiceTemplate: EServiceTemplate = {
    ...eserviceTemplate.data,
    name: name ?? eserviceTemplate.data.name,
    intendedTarget: intendedTarget ?? eserviceTemplate.data.intendedTarget,
    description: description ?? eserviceTemplate.data.description,
    technology: updatedTechnology,
    mode: updatedMode,
    riskAnalysis: checkedRiskAnalysis,
    versions: interfaceHasToBeDeleted
      ? eserviceTemplate.data.versions.map((d) => ({
          ...d,
          interface: undefined,
        }))
      : eserviceTemplate.data.versions,
    isSignalHubEnabled: updatedIsSignalHubEnabled,
    ...(isFeatureFlagEnabled(config, "featureFlagEservicePersonalData")
      ? { personalData: updatedPersonalData }
      : {}),
  };

  const event = await repository.createEvent(
    toCreateEventEServiceTemplateDraftUpdated(
      eserviceTemplateId,
      eserviceTemplate.metadata.version,
      updatedEServiceTemplate,
      correlationId
    )
  );
  return {
    data: updatedEServiceTemplate,
    metadata: { version: event.newVersion },
  };
}

function resolvePatchValue<T>(
  value: T | null | undefined,
  oldValue: T | undefined
): T | undefined {
  return value === null ? undefined : value === undefined ? oldValue : value;
}

// eslint-disable-next-line max-params
async function updateDraftEServiceTemplateVersion(
  eserviceTemplateId: EServiceTemplateId,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  updateSeed:
    | {
        type: "post";
        seed: eserviceTemplateApi.UpdateEServiceTemplateVersionSeed;
      }
    | {
        type: "patch";
        seed: eserviceTemplateApi.PatchUpdateEServiceTemplateVersionSeed;
      },
  readModelService: ReadModelServiceSQL,
  repository: ReturnType<typeof eventRepository<EServiceTemplateEvent>>,
  {
    authData,
    correlationId,
    logger,
  }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
): Promise<WithMetadata<EServiceTemplate>> {
  const { seed, type } = updateSeed;
  logger.info(
    `${type.toUpperCase()} update draft e-service template version ${eserviceTemplateVersionId} for EService template ${eserviceTemplateId}`
  );

  const {
    description,
    voucherLifespan,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    dailyCallsPerConsumer,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    dailyCallsTotal,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    agreementApprovalPolicy,
    attributes,
    ...rest
  } = seed;
  void (rest satisfies Record<string, never>);
  // ^ To make sure we extract all the updated fields.
  // The eslint disables are needed because those fields are extracted
  // but then not used directly, since they are handled in a different way.

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

  if (eserviceTemplateVersion.state !== eserviceTemplateVersionState.draft) {
    throw notValidEServiceTemplateVersionState(
      eserviceTemplateVersionId,
      eserviceTemplateVersion.state
    );
  }

  const updatedDailyCallsPerConsumer = match(updateSeed)
    .with({ type: "post" }, ({ seed }) => seed.dailyCallsPerConsumer)
    .with({ type: "patch" }, ({ seed }) =>
      resolvePatchValue(
        seed.dailyCallsPerConsumer,
        eserviceTemplateVersion.dailyCallsPerConsumer
      )
    )
    .exhaustive();

  const updatedDailyCallsTotal = match(updateSeed)
    .with({ type: "post" }, ({ seed }) => seed.dailyCallsTotal)
    .with({ type: "patch" }, ({ seed }) =>
      resolvePatchValue(
        seed.dailyCallsTotal,
        eserviceTemplateVersion.dailyCallsTotal
      )
    )
    .exhaustive();

  const updatedAgreementApprovalPolicy = match(updateSeed)
    .with({ type: "post" }, ({ seed }) =>
      seed.agreementApprovalPolicy
        ? apiAgreementApprovalPolicyToAgreementApprovalPolicy(
            seed.agreementApprovalPolicy
          )
        : undefined
    )
    .with({ type: "patch" }, ({ seed }) =>
      seed.agreementApprovalPolicy === null
        ? undefined
        : seed.agreementApprovalPolicy === undefined
        ? eserviceTemplateVersion.agreementApprovalPolicy
        : apiAgreementApprovalPolicyToAgreementApprovalPolicy(
            seed.agreementApprovalPolicy
          )
    )
    .exhaustive();

  assertConsistentDailyCalls({
    dailyCallsPerConsumer: updatedDailyCallsPerConsumer,
    dailyCallsTotal: updatedDailyCallsTotal,
  });

  const parsedAttributes = attributes
    ? await parseAndCheckAttributes(
        {
          declared:
            attributes.declared ?? eserviceTemplateVersion.attributes.declared,
          certified:
            attributes.certified ??
            eserviceTemplateVersion.attributes.certified,
          verified:
            attributes.verified ?? eserviceTemplateVersion.attributes.verified,
        },
        readModelService
      )
    : eserviceTemplateVersion.attributes;

  const updatedVersion: EServiceTemplateVersion = {
    ...eserviceTemplateVersion,
    agreementApprovalPolicy: updatedAgreementApprovalPolicy,
    dailyCallsPerConsumer: updatedDailyCallsPerConsumer,
    dailyCallsTotal: updatedDailyCallsTotal,
    description: description ?? eserviceTemplateVersion.description,
    voucherLifespan: voucherLifespan ?? eserviceTemplateVersion.voucherLifespan,
    attributes: parsedAttributes,
  };

  const updatedEServiceTemplate = replaceEServiceTemplateVersion(
    eserviceTemplate.data,
    updatedVersion
  );

  const eventToCreate = toCreateEventEServiceTemplateDraftVersionUpdated(
    eserviceTemplateId,
    eserviceTemplate.metadata.version,
    eserviceTemplateVersionId,
    updatedEServiceTemplate,
    correlationId
  );
  const event = await repository.createEvent(eventToCreate);

  return {
    data: updatedEServiceTemplate,
    metadata: { version: event.newVersion },
  };
}

const deleteVersionInterfaceAndDocs = async (
  version: EServiceTemplateVersion,
  fileManager: FileManager,
  logger: Logger
): Promise<void> => {
  const versionInterface = version.interface;
  if (versionInterface !== undefined) {
    await fileManager.delete(config.s3Bucket, versionInterface.path, logger);
  }

  const deleteVersionDocs = version.docs.map((doc: Document) =>
    fileManager.delete(config.s3Bucket, doc.path, logger)
  );

  await Promise.all(deleteVersionDocs);
};
