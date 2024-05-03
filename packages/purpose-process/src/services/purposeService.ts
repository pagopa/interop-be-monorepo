import {
  CreateEvent,
  DB,
  FileManager,
  eventRepository,
  logger,
  riskAnalysisFormToRiskAnalysisFormToValidate,
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
  Ownership,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionDocumentId,
  PurposeVersionId,
  ownership,
  purposeEventToBinaryData,
  purposeVersionState,
  PurposeRiskAnalysisForm,
  PurposeEvent,
  EServiceMode,
  ListResult,
  generateId,
  eserviceMode,
  EServiceInfo,
  PurposeVersionState,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import {
  duplicatedPurposeTitle,
  eserviceNotFound,
  missingRejectionReason,
  missingRiskAnalysis,
  notValidVersionState,
  organizationIsNotTheConsumer,
  organizationIsNotTheProducer,
  organizationNotAllowed,
  purposeCannotBeDeleted,
  purposeNotFound,
  purposeVersionCannotBeDeleted,
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
  tenantNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventDraftPurposeDeleted,
  toCreateEventDraftPurposeUpdated,
  toCreateEventPurposeActivated,
  toCreateEventPurposeArchived,
  toCreateEventPurposeSuspendedByConsumer,
  toCreateEventPurposeSuspendedByProducer,
  toCreateEventPurposeVersionOverQuotaUnsuspended,
  toCreateEventPurposeVersionRejected,
  toCreateEventPurposeVersionUnsuspenedByConsumer,
  toCreateEventPurposeVersionUnsuspenedByProducer,
  toCreateEventPurposeWaitingForApproval,
  toCreateEventWaitingForApprovalPurposeDeleted,
  toCreateEventWaitingForApprovalPurposeVersionDeleted,
} from "../model/domain/toEvent.js";
import {
  ApiPurposeUpdateContent,
  ApiReversePurposeUpdateContent,
  ApiGetPurposesFilters,
  ApiPurposeVersionSeed,
} from "../model/domain/models.js";
import { ReadModelService } from "./readModelService.js";
import {
  assertOrganizationIsAConsumer,
  assertEserviceHasSpecificMode,
  assertConsistentFreeOfCharge,
  isRiskAnalysisFormValid,
  purposeIsDraft,
  assertTenantKindExists,
  reverseValidateAndTransformRiskAnalysis,
  validateAndTransformRiskAnalysis,
  assertPurposeIsDraft,
  assertDailyCallsIsDifferentThanBefore,
  isRejectable,
  isDeletable,
  isArchivable,
  isSuspendable,
  isLoadAllowed,
  validateRiskAnalysisSchemaOrThrow,
} from "./validators.js";
import { pdfGenerator } from "./pdfGenerator.js";

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
  readModelService: ReadModelService,
  fileManager: FileManager
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

      assertTenantKindExists(tenant);

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
      logger.info(
        `Retrieving Risk Analysis document ${documentId} in version ${versionId} of Purpose ${purposeId}`
      );

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

      if (
        purposeVersion.state !== purposeVersionState.waitingForApproval ||
        purpose.data.versions.length === 1
      ) {
        throw purposeVersionCannotBeDeleted(purposeId, versionId);
      }

      const updatedPurpose: Purpose = {
        ...purpose.data,
        versions: purpose.data.versions.filter(
          (v) => v.id !== purposeVersion.id
        ),
        updatedAt: new Date(),
      };

      const event = toCreateEventWaitingForApprovalPurposeVersionDeleted({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        versionId,
        correlationId,
      });
      await repository.createEvent(event);
    },
    async rejectPurposeVersion({
      purposeId,
      versionId,
      rejectionReason,
      organizationId,
      correlationId,
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      rejectionReason: string;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<void> {
      logger.info(`Rejecting Version ${versionId} in Purpose ${purposeId}`);

      if (!rejectionReason) {
        throw missingRejectionReason();
      }

      const purpose = await retrievePurpose(purposeId, readModelService);
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );
      if (organizationId !== eservice.producerId) {
        throw organizationIsNotTheProducer(organizationId);
      }

      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isRejectable(purposeVersion)) {
        throw notValidVersionState(purposeVersion.id, purposeVersion.state);
      }

      const updatedPurposeVersion: PurposeVersion = {
        ...purposeVersion,
        state: purposeVersionState.rejected,
        rejectionReason,
        updatedAt: new Date(),
      };

      const updatedPurpose = replacePurposeVersion(
        purpose.data,
        updatedPurposeVersion
      );

      const event = toCreateEventPurposeVersionRejected({
        purpose: updatedPurpose,
        version: purpose.metadata.version,
        versionId,
        correlationId,
      });
      await repository.createEvent(event);
    },
    async updatePurpose({
      purposeId,
      purposeUpdateContent,
      organizationId,
      correlationId,
    }: {
      purposeId: PurposeId;
      purposeUpdateContent: ApiPurposeUpdateContent;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(`Updating Purpose ${purposeId}`);
      return await updatePurposeInternal(
        purposeId,
        purposeUpdateContent,
        organizationId,
        eserviceMode.deliver,
        { readModelService, correlationId, repository }
      );
    },
    async updateReversePurpose({
      purposeId,
      reversePurposeUpdateContent,
      organizationId,
      correlationId,
    }: {
      purposeId: PurposeId;
      reversePurposeUpdateContent: ApiReversePurposeUpdateContent;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> {
      logger.info(`Updating Reverse Purpose ${purposeId}`);
      return await updatePurposeInternal(
        purposeId,
        reversePurposeUpdateContent,
        organizationId,
        "Receive",
        {
          readModelService,
          correlationId,
          repository,
        }
      );
    },
    async deletePurpose({
      purposeId,
      organizationId,
      correlationId,
    }: {
      purposeId: PurposeId;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<void> {
      logger.info(`Deleting Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertOrganizationIsAConsumer(organizationId, purpose.data.consumerId);

      if (!isDeletable(purpose.data)) {
        throw purposeCannotBeDeleted(purpose.data.id);
      }

      const event = purposeIsDraft(purpose.data)
        ? toCreateEventDraftPurposeDeleted({
            purpose: purpose.data,
            version: purpose.metadata.version,
            correlationId,
          })
        : toCreateEventWaitingForApprovalPurposeDeleted({
            purpose: purpose.data,
            version: purpose.metadata.version,
            correlationId,
          });

      await repository.createEvent(event);
    },
    async archivePurposeVersion({
      purposeId,
      versionId,
      organizationId,
      correlationId,
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<PurposeVersion> {
      logger.info(`Archiving Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      assertOrganizationIsAConsumer(organizationId, purpose.data.consumerId);
      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isArchivable(purposeVersion)) {
        throw notValidVersionState(versionId, purposeVersion.state);
      }

      const purposeWithoutWaitingForApproval: Purpose = {
        ...purpose.data,
        versions: purpose.data.versions.filter(
          (v) => v.state !== purposeVersionState.waitingForApproval
        ),
      };
      const archivedVersion: PurposeVersion = {
        ...purposeVersion,
        state: purposeVersionState.archived,
        updatedAt: new Date(),
      };
      const updatedPurpose = replacePurposeVersion(
        purposeWithoutWaitingForApproval,
        archivedVersion
      );

      const event = toCreateEventPurposeArchived({
        purpose: updatedPurpose,
        purposeVersionId: archivedVersion.id,
        version: purpose.metadata.version,
        correlationId,
      });

      await repository.createEvent(event);
      return archivedVersion;
    },

    async suspendPurposeVersion({
      purposeId,
      versionId,
      organizationId,
      correlationId,
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<PurposeVersion> {
      logger.info(`Suspending Version ${versionId} in Purpose ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, readModelService);

      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      const suspender = getOrganizationRole({
        organizationId,
        producerId: eservice.producerId,
        consumerId: purpose.data.consumerId,
      });

      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      if (!isSuspendable(purposeVersion)) {
        throw notValidVersionState(purposeVersion.id, purposeVersion.state);
      }

      const suspendedPurposeVersion: PurposeVersion = {
        ...purposeVersion,
        state: purposeVersionState.suspended,
        suspendedAt: new Date(),
        updatedAt: new Date(),
      };

      const event = match(suspender)
        .with(ownership.CONSUMER, () => {
          const updatedPurpose: Purpose = {
            ...replacePurposeVersion(purpose.data, suspendedPurposeVersion),
            suspendedByConsumer: true,
          };
          return toCreateEventPurposeSuspendedByConsumer({
            purpose: updatedPurpose,
            purposeVersionId: versionId,
            version: purpose.metadata.version,
            correlationId,
          });
        })
        .with(ownership.PRODUCER, ownership.SELF_CONSUMER, () => {
          const updatedPurpose: Purpose = {
            ...replacePurposeVersion(purpose.data, suspendedPurposeVersion),
            suspendedByProducer: true,
          };
          return toCreateEventPurposeSuspendedByProducer({
            purpose: updatedPurpose,
            purposeVersionId: versionId,
            version: purpose.metadata.version,
            correlationId,
          });
        })
        .exhaustive();

      await repository.createEvent(event);
      return suspendedPurposeVersion;
    },
    async getPurposes(
      organizationId: TenantId,
      filters: ApiGetPurposesFilters,
      { offset, limit }: { offset: number; limit: number }
    ): Promise<ListResult<Purpose>> {
      logger.info(
        `Getting Purposes with name = ${filters.name}, eservicesIds = ${filters.eservicesIds}, consumers = ${filters.consumersIds}, producers = ${filters.producersIds}, states = ${filters.states}, excludeDraft = ${filters.excludeDraft}, limit = ${limit}, offset = ${offset}`
      );

      const purposesList = await readModelService.getPurposes(
        filters,
        offset,
        limit
      );

      const mappingPurposeEservice = await Promise.all(
        purposesList.results.map(async (purpose) => {
          const eservice = await retrieveEService(
            purpose.eserviceId,
            readModelService
          );
          if (eservice === undefined) {
            throw eserviceNotFound(purpose.eserviceId);
          }
          return {
            purpose,
            eservice,
          };
        })
      );

      const purposesToReturn = mappingPurposeEservice.map(
        ({ purpose, eservice }) => {
          const isProducerOrConsumer =
            organizationId === purpose.consumerId ||
            organizationId === eservice.producerId;

          return {
            ...purpose,
            versions: filters.excludeDraft
              ? purpose.versions.filter(
                  (version) => version.state !== purposeVersionState.draft
                )
              : purpose.versions,
            riskAnalysisForm: isProducerOrConsumer
              ? purpose.riskAnalysisForm
              : undefined,
          };
        }
      );

      return {
        results: purposesToReturn,
        totalCount: purposesList.totalCount,
      };
    },
    async createPurposeVersion({
      purposeId,
      seed,
      organizationId,
      correlationId,
    }: {
      purposeId: PurposeId;
      seed: ApiPurposeVersionSeed;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<PurposeVersion> {
      const purpose = await retrievePurpose(purposeId, readModelService);
      assertOrganizationIsAConsumer(organizationId, purpose.data.consumerId);
      assertDailyCallsIsDifferentThanBefore(purpose.data, seed.dailyCalls);

      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );

      const ownership = getOrganizationRole({
        organizationId,
        producerId: eservice.producerId,
        consumerId: purpose.data.consumerId,
      });

      const newPurposeVersion: PurposeVersion = {
        ...seed,
        createdAt: new Date(),
        state: purposeVersionState.draft,
        id: generateId<PurposeVersionId>(),
      };

      const updatedPurpose: Purpose = {
        ...purpose.data,
        versions: [...purpose.data.versions, newPurposeVersion],
        updatedAt: new Date(),
      };

      return await activateOrWaitingForApproval({
        eservice,
        purpose: updatedPurpose,
        purposeVersion: newPurposeVersion,
        organizationId,
        ownership,
        version: purpose.metadata.version,
        correlationId,
        readModelService,
        storeFile: fileManager.storeBytes,
        repository,
      });
    },

    async activatePurposeVersion({
      purposeId,
      versionId,
      organizationId,
      correlationId,
    }: {
      purposeId: PurposeId;
      versionId: PurposeVersionId;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<PurposeVersion> {
      const purpose = await retrievePurpose(purposeId, readModelService);
      const eservice = await retrieveEService(
        purpose.data.eserviceId,
        readModelService
      );
      const tenant = await retrieveTenant(
        purpose.data.consumerId,
        readModelService
      );

      assertTenantKindExists(tenant);

      const tenantKind = tenant.kind;
      const purposeVersion = retrievePurposeVersion(versionId, purpose);

      const riskAnalysisForm = purpose.data.riskAnalysisForm;

      if (!riskAnalysisForm) {
        throw missingRiskAnalysis(purposeId);
      }

      if (purposeVersion.state === purposeVersionState.draft) {
        validateRiskAnalysisSchemaOrThrow(
          riskAnalysisFormToRiskAnalysisFormToValidate(riskAnalysisForm),
          false,
          tenantKind
        );
      }

      const ownership = getOrganizationRole({
        organizationId,
        producerId: eservice.producerId,
        consumerId: purpose.data.consumerId,
      });

      return await activateOrWaitingForApproval({
        eservice,
        purpose: purpose.data,
        purposeVersion,
        organizationId,
        ownership,
        version: purpose.metadata.version,
        correlationId,
        readModelService,
        storeFile: fileManager.storeBytes,
        repository,
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

const replacePurposeVersion = (
  purpose: Purpose,
  newVersion: PurposeVersion
): Purpose => {
  const updatedVersions = purpose.versions.map((v: PurposeVersion) =>
    v.id === newVersion.id ? newVersion : v
  );

  return {
    ...purpose,
    versions: updatedVersions,
    updatedAt: newVersion.updatedAt,
  };
};

const getInvolvedTenantByEServiceMode = async (
  eservice: EService,
  consumerId: TenantId,
  readModelService: ReadModelService
): Promise<Tenant> => {
  if (eservice.mode === eserviceMode.deliver) {
    return retrieveTenant(consumerId, readModelService);
  } else {
    return retrieveTenant(eservice.producerId, readModelService);
  }
};

const updatePurposeInternal = async (
  purposeId: PurposeId,
  updateContent: ApiPurposeUpdateContent | ApiReversePurposeUpdateContent,
  organizationId: TenantId,
  mode: EServiceMode,
  {
    readModelService,
    correlationId,
    repository,
  }: {
    readModelService: ReadModelService;
    correlationId: string;
    repository: {
      createEvent: (createEvent: CreateEvent<PurposeEvent>) => Promise<string>;
    };
  }
): Promise<{ purpose: Purpose; isRiskAnalysisValid: boolean }> => {
  const purpose = await retrievePurpose(purposeId, readModelService);
  assertOrganizationIsAConsumer(organizationId, purpose.data.consumerId);
  assertPurposeIsDraft(purpose.data);

  const purposeWithSameTitle = await readModelService.getSpecificPurpose(
    purpose.data.eserviceId,
    purpose.data.consumerId,
    updateContent.title
  );

  if (purposeWithSameTitle) {
    throw duplicatedPurposeTitle(updateContent.title);
  }

  const eservice = await retrieveEService(
    purpose.data.eserviceId,
    readModelService
  );
  assertEserviceHasSpecificMode(eservice, mode);
  assertConsistentFreeOfCharge(
    updateContent.isFreeOfCharge,
    updateContent.freeOfChargeReason
  );

  const tenant = await getInvolvedTenantByEServiceMode(
    eservice,
    purpose.data.consumerId,
    readModelService
  );

  assertTenantKindExists(tenant);

  const newRiskAnalysis: PurposeRiskAnalysisForm | undefined =
    mode === eserviceMode.deliver
      ? validateAndTransformRiskAnalysis(
          (updateContent as ApiPurposeUpdateContent).riskAnalysisForm,
          tenant.kind
        )
      : reverseValidateAndTransformRiskAnalysis(
          purpose.data.riskAnalysisForm,
          tenant.kind
        );

  const updatedPurpose: Purpose = {
    ...purpose.data,
    ...updateContent,
    versions: [
      {
        ...purpose.data.versions[0],
        dailyCalls: updateContent.dailyCalls,
        updatedAt: new Date(),
      },
    ],
    updatedAt: new Date(),
    riskAnalysisForm: newRiskAnalysis,
  };

  const event = toCreateEventDraftPurposeUpdated({
    purpose: updatedPurpose,
    version: purpose.metadata.version,
    correlationId,
  });
  await repository.createEvent(event);

  return {
    purpose: updatedPurpose,
    isRiskAnalysisValid: isRiskAnalysisFormValid(
      updatedPurpose.riskAnalysisForm,
      false,
      tenant.kind
    ),
  };
};

async function activateOrWaitingForApproval({
  eservice,
  purpose,
  purposeVersion,
  organizationId,
  ownership,
  readModelService,
  version,
  correlationId,
  storeFile,
  repository,
}: {
  eservice: EService;
  purpose: Purpose;
  purposeVersion: PurposeVersion;
  organizationId: TenantId;
  ownership: Ownership;
  readModelService: ReadModelService;
  version: number;
  correlationId: string;
  storeFile: FileManager["storeBytes"];
  repository: {
    createEvent: (createEvent: CreateEvent<PurposeEvent>) => Promise<string>;
  };
}): Promise<PurposeVersion> {
  function archiveOldVersion(
    purpose: Purpose,
    newPurposeVersionId: PurposeVersionId
  ): Purpose {
    const versions = purpose.versions.map((v) =>
      match(v.state)
        .with(
          P.union(purposeVersionState.active, purposeVersionState.suspended),
          () => ({
            ...v,
            state:
              v.id === newPurposeVersionId
                ? v.state
                : purposeVersionState.archived,
          })
        )
        .otherwise(() => v)
    );

    return { ...purpose, versions };
  }

  function changeToWaitForApproval(): {
    event: CreateEvent<PurposeEvent>;
    updatedPurposeVersion: PurposeVersion;
  } {
    const updatedPurposeVersion: PurposeVersion = {
      ...purposeVersion,
      state: purposeVersionState.waitingForApproval,
      updatedAt: new Date(),
    };

    const updatedPurpose: Purpose = replacePurposeVersion(
      purpose,
      updatedPurposeVersion
    );

    return {
      event: toCreateEventPurposeWaitingForApproval({
        purpose: updatedPurpose,
        version,
        correlationId,
      }),
      updatedPurposeVersion,
    };
  }

  function createWaitForApproval(): {
    event: CreateEvent<PurposeEvent>;
    updatedPurposeVersion: PurposeVersion;
  } {
    const newPurposeVersion: PurposeVersion = {
      ...purposeVersion,
      createdAt: new Date(),
      state: purposeVersionState.waitingForApproval,
      id: generateId<PurposeVersionId>(),
    };

    const updatedPurpose: Purpose = {
      ...purpose,
      versions: [...purpose.versions, newPurposeVersion],
      updatedAt: new Date(),
    };

    return {
      event: toCreateEventPurposeVersionOverQuotaUnsuspended({
        purpose: updatedPurpose,
        versionId: newPurposeVersion.id,
        version,
        correlationId,
      }),
      updatedPurposeVersion: newPurposeVersion,
    };
  }

  async function firstVersionActivation(): Promise<{
    event: CreateEvent<PurposeEvent>;
    updatedPurposeVersion: PurposeVersion;
  }> {
    const documentId = generateId<PurposeVersionDocumentId>();

    const [producer, consumer] = await Promise.all([
      retrieveTenant(eservice.producerId, readModelService),
      retrieveTenant(eservice.producerId, readModelService),
    ]);

    const eserviceInfo: EServiceInfo = {
      name: eservice.name,
      mode: eservice.mode,
      producerName: producer.name,
      producerOrigin: producer.externalId.origin,
      producerIPACode: producer.externalId.value,
      consumerName: consumer.name,
      consumerOrigin: consumer.externalId.origin,
      consumerIPACode: consumer.externalId.value,
    };

    function getTenantKind(tenant: Tenant): TenantKind {
      assertTenantKindExists(tenant);
      return tenant.kind;
    }

    const tenantKind = match(eservice.mode)
      .with(eserviceMode.deliver, () => getTenantKind(consumer))
      .with(eserviceMode.receive, () => getTenantKind(producer))
      .exhaustive();

    const riskAnalysisDocument = await pdfGenerator.createRiskAnalysisDocument(
      documentId,
      purpose,
      purposeVersion,
      eserviceInfo,
      tenantKind,
      storeFile
    );

    const updatedPurposeVersion: PurposeVersion = {
      ...purposeVersion,
      state: purposeVersionState.active,
      riskAnalysis: riskAnalysisDocument,
      updatedAt: new Date(),
      firstActivationAt: new Date(),
    };

    const updatedPurpose: Purpose = archiveOldVersion(
      replacePurposeVersion(purpose, updatedPurposeVersion),
      updatedPurposeVersion.id
    );

    return {
      event: toCreateEventPurposeActivated({
        purpose: updatedPurpose,
        version,
        correlationId,
      }),
      updatedPurposeVersion,
    };
  }

  function activateFromSuspended(): {
    event: CreateEvent<PurposeEvent>;
    updatedPurposeVersion: PurposeVersion;
  } {
    function calcNewVersionState(state: {
      suspendedByProducer?: boolean;
      suspendedByConsumer?: boolean;
    }): PurposeVersionState {
      return match(state)
        .with(
          {
            suspendedByConsumer: true,
          },
          () => purposeVersionState.suspended
        )
        .with(
          {
            suspendedByProducer: true,
          },
          () => purposeVersionState.suspended
        )
        .otherwise(() => purposeVersionState.active);
    }

    const updatedPurposeVersion: PurposeVersion = {
      ...purposeVersion,
      updatedAt: new Date(),
      suspendedAt: undefined,
    };

    if (ownership === "PRODUCER" || ownership === "SELF_CONSUMER") {
      const updatedPurpose: Purpose = replacePurposeVersion(purpose, {
        ...updatedPurposeVersion,
        state: calcNewVersionState({
          suspendedByProducer: false,
          suspendedByConsumer: purpose.suspendedByConsumer,
        }),
      });

      return {
        event: toCreateEventPurposeVersionUnsuspenedByProducer({
          purpose: { ...updatedPurpose, suspendedByProducer: false },
          versionId: purposeVersion.id,
          version,
          correlationId,
        }),
        updatedPurposeVersion,
      };
    } else {
      const updatedPurpose: Purpose = replacePurposeVersion(purpose, {
        ...updatedPurposeVersion,
        state: calcNewVersionState({
          suspendedByProducer: purpose.suspendedByProducer,
          suspendedByConsumer: false,
        }),
      });
      return {
        event: toCreateEventPurposeVersionUnsuspenedByConsumer({
          purpose: { ...updatedPurpose, suspendedByConsumer: false },
          versionId: purposeVersion.id,
          version,
          correlationId,
        }),
        updatedPurposeVersion,
      };
    }
  }

  const { event, updatedPurposeVersion } = await match({
    state: purposeVersion.state,
    ownership,
  })
    .with(
      {
        state: purposeVersionState.draft,
        ownership: P.union("CONSUMER", "SELF_CONSUMER"),
      },
      async () => {
        if (
          await isLoadAllowed(
            eservice,
            purpose,
            purposeVersion,
            readModelService
          )
        ) {
          return await firstVersionActivation();
        }
        return changeToWaitForApproval();
      }
    )
    .with({ state: purposeVersionState.draft, ownership: "PRODUCER" }, () => {
      throw organizationIsNotTheConsumer(organizationId);
    })
    .with(
      { state: purposeVersionState.waitingForApproval, ownership: "CONSUMER" },
      () => {
        throw organizationIsNotTheProducer(organizationId);
      }
    )
    .with(
      {
        state: purposeVersionState.waitingForApproval,
        ownership: P.union("PRODUCER", "SELF_CONSUMER"),
      },
      async () => await firstVersionActivation()
    )
    .with(
      { state: purposeVersionState.suspended, ownership: "CONSUMER" },
      () => purpose.suspendedByConsumer && purpose.suspendedByProducer,
      () => activateFromSuspended()
    )
    .with(
      {
        state: purposeVersionState.suspended,
        ownership: P.union("CONSUMER", "SELF_CONSUMER"),
      },
      () => purpose.suspendedByConsumer,
      async () => {
        if (
          await isLoadAllowed(
            eservice,
            purpose,
            purposeVersion,
            readModelService
          )
        ) {
          return activateFromSuspended();
        }
        return createWaitForApproval();
      }
    )
    .with({ state: purposeVersionState.suspended, ownership: "PRODUCER" }, () =>
      activateFromSuspended()
    )
    .otherwise(() => {
      throw organizationNotAllowed(organizationId);
    });

  await repository.createEvent(event);
  return updatedPurposeVersion;
}
