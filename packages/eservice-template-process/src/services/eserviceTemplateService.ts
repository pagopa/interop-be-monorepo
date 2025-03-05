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
  Logger,
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
  RiskAnalysis,
  RiskAnalysisId,
  Tenant,
  TenantId,
  TenantKind,
  eserviceMode,
  generateId,
  ListResult,
  Document,
  EServiceDocumentId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  attributeNotFound,
  checksumDuplicate,
  eServiceTemplateDuplicate,
  eServiceTemplateNotFound,
  eServiceTemplateVersionNotFound,
  eserviceTemplateDocumentNotFound,
  missingRiskAnalysis,
  instanceNameConflict,
  notValidEServiceTemplateVersionState,
} from "../model/domain/errors.js";
import {
  versionAttributeGroupSupersetMissingInAttributesSeed,
  inconsistentAttributesSeedGroupsCount,
  unchangedAttributes,
  riskAnalysisValidationFailed,
  tenantNotFound,
  originNotCompliant,
  eserviceTemaplateRiskAnalysisNameDuplicate,
  missingTemplateVersionInterface,
  interfaceAlreadyExists,
  prettyNameDuplicate,
} from "../model/domain/errors.js";
import {
  toCreateEventEServiceTemplateVersionActivated,
  toCreateEventEServiceTemplateVersionSuspended,
  toCreateEventEServiceTemplateNameUpdated,
  toCreateEventEServiceTemplateDraftVersionUpdated,
  toCreateEventEServiceTemplateTemplateDescriptionUpdated,
  toCreateEventEServiceTemplateEServiceDescriptionUpdated,
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
} from "../model/domain/toEvent.js";
import { config } from "../config/config.js";
import {
  apiAgreementApprovalPolicyToAgreementApprovalPolicy,
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
} from "../model/domain/apiConverter.js";
import {
  GetEServiceTemplatesFilters,
  ReadModelService,
} from "./readModelService.js";
import {
  assertIsReceiveTemplate,
  assertTenantKindExists,
  assertIsDraftEServiceTemplate,
  assertRequesterEServiceTemplateCreator,
  assertNoDraftEServiceTemplateVersions,
  versionStatesNotAllowingDocumentOperations,
  assertConsistentDailyCalls,
  assertPublishedEServiceTemplate,
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

      assertConsistentDailyCalls(seed);

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

      assertPublishedEServiceTemplate(eserviceTemplate.data);

      if (name !== eserviceTemplate.data.name) {
        const eserviceTemplateWithSameName =
          await readModelService.getEServiceTemplateByNameAndCreatorId({
            name,
            creatorId: eserviceTemplate.data.creatorId,
          });
        if (eserviceTemplateWithSameName !== undefined) {
          throw eServiceTemplateDuplicate(name);
        }

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
    async updateEServiceTemplateTemplateDescription(
      eserviceTemplateId: EServiceTemplateId,
      templateDescription: string,
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

      assertPublishedEServiceTemplate(eserviceTemplate.data);

      const updatedEserviceTemplate: EServiceTemplate = {
        ...eserviceTemplate.data,
        templateDescription,
      };
      await repository.createEvent(
        toCreateEventEServiceTemplateTemplateDescriptionUpdated(
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

      assertPublishedEServiceTemplate(eserviceTemplate.data);

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
      assertIsDraftEServiceTemplate(template.data);
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
      assertIsDraftEServiceTemplate(template.data);
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
      assertIsDraftEServiceTemplate(template.data);
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
        templateDescription: seed.templateDescription,
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

      assertIsDraftEServiceTemplate(eserviceTemplate.data);

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
        templateDescription: eserviceTemplateSeed.templateDescription,
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
    async createEServiceTemplateVersion(
      eserviceTemplateId: EServiceTemplateId,
      { authData, correlationId, logger }: WithLogger<AppContext>
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
    async getEServiceTemplateCreators(
      creatorName: string | undefined,
      limit: number,
      offset: number,
      { logger }: WithLogger<AppContext>
    ): Promise<ListResult<eserviceTemplateApi.CompactOrganization>> {
      logger.info(
        `Retrieving producers from agreements with producer name ${creatorName}, limit ${limit}, offset ${offset}`
      );
      return await readModelService.getCreators(creatorName, limit, offset);
    },
    async createEServiceTemplateDocument(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      document: eserviceTemplateApi.CreateEServiceTemplateVersionDocumentSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<EServiceTemplate> {
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
        throw prettyNameDuplicate(document.prettyName, version.id);
      }

      if (
        document.kind === "DOCUMENT" &&
        version.docs.some((d) => d.checksum === document.checksum)
      ) {
        throw checksumDuplicate(
          document.fileName,
          eserviceTemplate.data.id,
          version.id
        );
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

      await repository.createEvent(event);

      return updatedEServiceTemplate;
    },

    async getEServiceTemplateDocument(
      {
        eServiceTemplateId,
        eServiceTemplateVersionId,
        eServiceDocumentId,
      }: {
        eServiceTemplateId: EServiceTemplateId;
        eServiceTemplateVersionId: EServiceTemplateVersionId;
        eServiceDocumentId: EServiceDocumentId;
      },
      { authData, logger }: WithLogger<AppContext>
    ): Promise<Document> {
      logger.info(
        `Getting EService Document ${eServiceDocumentId.toString()} for EService Template ${eServiceTemplateId} and Version ${eServiceTemplateVersionId}`
      );

      const eServiceTemplate = await retrieveEServiceTemplate(
        eServiceTemplateId,
        readModelService
      );

      const version = retrieveEServiceTemplateVersion(
        eServiceTemplateVersionId,
        eServiceTemplate.data
      );

      if (version.state === eserviceTemplateVersionState.draft) {
        assertRequesterEServiceTemplateCreator(
          eServiceTemplate.data.creatorId,
          authData
        );
      }

      return retrieveDocument(eServiceTemplateId, version, eServiceDocumentId);
    },
    async updateDocument(
      eserviceTemplateId: EServiceTemplateId,
      eserviceTemplateVersionId: EServiceTemplateVersionId,
      documentId: EServiceDocumentId,
      apiEServiceDescriptorDocumentUpdateSeed: eserviceTemplateApi.UpdateEServiceTemplateVersionDocumentSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
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
        throw prettyNameDuplicate(
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
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<void> {
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

      await repository.createEvent(event);
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
