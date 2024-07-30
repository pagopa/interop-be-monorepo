import { WithLogger, FileManager, toSetToArray } from "pagopa-interop-commons";
import {
  PurposeId,
  PurposeVersionDocumentId,
  PurposeVersionId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { bffApi, purposeApi, tenantApi } from "pagopa-interop-api-clients";
import {
  AgreementProcessClient,
  AuthorizationProcessClient,
  CatalogProcessClient,
  PagoPAInteropBeClients,
  PurposeProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import {
  agreementNotFound,
  eserviceDescriptorNotFound,
  eServiceNotFound,
  invalidRiskAnalysisContentType,
  purposeDraftVersionNotFound,
  purposeNotFound,
  tenantNotFound,
} from "../model/domain/errors.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import { toBffApiCompactClient } from "../model/domain/apiConverter.js";
import { isUpgradable } from "../model/modelMappingUtils.js";
import { config } from "../config/config.js";
import { getLatestAgreement } from "./agreementService.js";
import { getAllClients } from "./clientService.js";

export const getCurrentVersion = (
  purposeVersions: purposeApi.PurposeVersion[]
): purposeApi.PurposeVersion | undefined => {
  const statesToExclude: purposeApi.PurposeVersionState[] = [
    purposeApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL,
    purposeApi.PurposeVersionState.Values.REJECTED,
  ];
  return purposeVersions
    .filter((v) => !statesToExclude.includes(v.state))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .at(-1);
};

// eslint-disable-next-line max-params
async function getPurposes(
  {
    purposeProcessClient,
    catalogProcessClient,
    tenantProcessClient,
    agreementProcessClient,
    authorizationClient,
  }: Omit<PagoPAInteropBeClients, "attributeProcessClient">,
  requesterId: string,
  filters: {
    name?: string | undefined;
    eservicesIds?: string[];
    consumersIds?: string[];
    producersIds?: string[];
    states?: purposeApi.PurposeVersionState[];
    excludeDraft?: boolean | undefined;
  },
  offset: number,
  limit: number,
  headers: Headers
): Promise<bffApi.Purposes> {
  const distinctFilters = {
    ...filters,
    eseviceIds: filters.eservicesIds && toSetToArray(filters.eservicesIds),
    consumersIds: filters.consumersIds && toSetToArray(filters.consumersIds),
    producersIds: filters.producersIds && toSetToArray(filters.producersIds),
    states: filters.states && toSetToArray(filters.states),
  };

  const purposes = await purposeProcessClient.getPurposes({
    queries: {
      ...distinctFilters,
      limit,
      offset,
    },
    headers,
  });

  const eservices = await Promise.all(
    toSetToArray(purposes.results.map((p) => p.eserviceId)).map((eServiceId) =>
      catalogProcessClient.getEServiceById({
        params: {
          eServiceId,
        },
        headers,
      })
    )
  );

  const getTenant = async (id: string): Promise<tenantApi.Tenant> =>
    tenantProcessClient.tenant.getTenant({
      params: {
        id,
      },
      headers,
    });
  const consumers = await Promise.all(
    toSetToArray(purposes.results.map((p) => p.consumerId)).map(getTenant)
  );
  const producers = await Promise.all(
    toSetToArray(eservices.map((e) => e.producerId)).map(getTenant)
  );

  const enhancePurpose = async (
    purpose: purposeApi.Purpose
  ): Promise<bffApi.Purpose> => {
    const eservice = eservices.find((e) => e.id === purpose.eserviceId);
    if (!eservice) {
      throw eServiceNotFound(purpose.eserviceId);
    }

    const producer = producers.find((p) => p.id === eservice.producerId);
    if (!producer) {
      throw tenantNotFound(eservice.producerId);
    }

    const consumer = consumers.find((c) => c.id === purpose.consumerId);
    if (!consumer) {
      throw tenantNotFound(purpose.consumerId);
    }

    const latestAgreement = await getLatestAgreement(
      agreementProcessClient,
      purpose.consumerId,
      eservice,
      headers
    );
    if (!latestAgreement) {
      throw agreementNotFound(purpose.consumerId);
    }

    const currentDescriptor = eservice.descriptors.find(
      (d) => d.id === latestAgreement.descriptorId
    );
    if (!currentDescriptor) {
      throw eserviceDescriptorNotFound(
        eservice.id,
        latestAgreement.descriptorId
      );
    }

    const clients =
      requesterId === purpose.consumerId
        ? (
            await getAllClients(
              authorizationClient,
              purpose.consumerId,
              purpose.id,
              headers
            )
          ).map(toBffApiCompactClient)
        : [];

    const currentVersion = getCurrentVersion(purpose.versions);
    const waitingForApprovalVersion = purpose.versions.find(
      (v) =>
        v.state === purposeApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL
    );

    const latestVersion = [...purpose.versions]
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .at(-1);

    const rejectedVersion =
      latestVersion?.state === purposeApi.PurposeVersionState.Values.REJECTED
        ? latestVersion
        : undefined;

    return {
      id: purpose.id,
      title: purpose.title,
      description: purpose.description,
      consumer: { id: consumer.id, name: consumer.name },
      riskAnalysisForm: purpose.riskAnalysisForm,
      eservice: {
        id: eservice.id,
        name: eservice.name,
        producer: { id: producer.id, name: producer.name },
        descriptor: {
          id: currentDescriptor.id,
          state: currentDescriptor.state,
          version: currentDescriptor.version,
          audience: currentDescriptor.audience,
        },
        mode: eservice.mode,
      },
      agreement: {
        id: latestAgreement.id,
        state: latestAgreement.state,
        canBeUpgraded: isUpgradable(eservice, latestAgreement),
      },
      currentVersion,
      versions: purpose.versions,
      clients,
      waitingForApprovalVersion,
      suspendedByConsumer: purpose.suspendedByConsumer,
      suspendedByProducer: purpose.suspendedByProducer,
      isFreeOfCharge: purpose.isFreeOfCharge,
      dailyCallsPerConsumer: currentDescriptor.dailyCallsPerConsumer,
      dailyCallsTotal: currentDescriptor.dailyCallsTotal,
      rejectedVersion,
    };
  };

  const results = await Promise.all(purposes.results.map(enhancePurpose));

  return {
    pagination: {
      offset,
      limit,
      totalCount: purposes.totalCount,
    },
    results,
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, max-params
export function purposeServiceBuilder(
  purposeProcessClient: PurposeProcessClient,
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient,
  authorizationClient: AuthorizationProcessClient,
  fileManager: FileManager
) {
  return {
    async createPurpose(
      createSeed: bffApi.PurposeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<ReturnType<typeof purposeProcessClient.createPurpose>> {
      logger.info(
        `Creating purpose with eService ${createSeed.eserviceId} and consumer ${createSeed.consumerId}`
      );
      return await purposeProcessClient.createPurpose(createSeed, {
        headers,
      });
    },
    async createPurposeForReceiveEservice(
      createSeed: bffApi.PurposeEServiceSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<
      ReturnType<typeof purposeProcessClient.createPurposeFromEService>
    > {
      logger.info(
        `Creating purpose from ESErvice ${createSeed.eserviceId} and Risk Analysis ${createSeed.riskAnalysisId}`
      );
      const payload = {
        ...createSeed,
        eServiceId: createSeed.eserviceId,
      };
      return await purposeProcessClient.createPurposeFromEService(payload, {
        headers,
      });
    },
    async reversePurposeUpdate(
      id: PurposeId,
      updateSeed: bffApi.ReversePurposeUpdateContent,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<{ purposeId: PurposeId; versionId: PurposeVersionId }> {
      logger.info(`Updating reverse purpose ${id}`);
      const updatedPurpose = await purposeProcessClient.updateReversePurpose(
        updateSeed,
        {
          headers,
          params: {
            id,
          },
        }
      );

      const versionId = getCurrentVersion(updatedPurpose.versions)?.id;

      if (versionId === undefined) {
        throw purposeNotFound(id);
      }

      return { purposeId: id, versionId: unsafeBrandId(versionId) };
    },
    async getProducerPurposes(
      filters: {
        name?: string | undefined;
        eservicesIds?: string[] | undefined;
        consumersIds?: string[] | undefined;
        producersIds?: string[] | undefined;
        states?: purposeApi.PurposeVersionState[] | undefined;
      },
      offset: number,
      limit: number,
      { headers, authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.Purposes> {
      logger.info(
        `Retrieving Purposes for name ${filters.name}, EServices ${filters.eservicesIds}, Producers ${filters.producersIds}, offset ${offset}, limit ${limit}`
      );
      return await getPurposes(
        {
          purposeProcessClient,
          catalogProcessClient,
          tenantProcessClient,
          agreementProcessClient,
          authorizationClient,
        },
        authData.organizationId,
        { ...filters, excludeDraft: true },
        offset,
        limit,
        headers
      );
    },
    async getConsumerPurposes(
      filters: {
        name?: string | undefined;
        eservicesIds?: string[] | undefined;
        consumersIds?: string[] | undefined;
        producersIds?: string[] | undefined;
        states?: purposeApi.PurposeVersionState[] | undefined;
      },
      offset: number,
      limit: number,
      { headers, authData, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.Purposes> {
      logger.info(
        `Retrieving Purposes for name ${filters.name}, EServices ${filters.eservicesIds}, Consumers ${filters.consumersIds}, offset ${offset}, limit ${limit}`
      );
      return await getPurposes(
        {
          purposeProcessClient,
          catalogProcessClient,
          tenantProcessClient,
          agreementProcessClient,
          authorizationClient,
        },
        authData.organizationId,
        { ...filters, excludeDraft: false },
        offset,
        limit,
        headers
      );
    },
    async clonePurpose(
      purposeId: PurposeId,
      seed: purposeApi.PurposeCloneSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeVersionResource> {
      logger.info(`Cloning purpose ${purposeId}`);

      const cloned = await purposeProcessClient.clonePurpose(seed, {
        params: {
          purposeId,
        },
        headers,
      });

      const draft = cloned.versions.find(
        (v) => v.state === purposeApi.PurposeVersionState.Values.DRAFT
      );
      if (!draft) {
        throw purposeDraftVersionNotFound(purposeId);
      }

      return {
        purposeId: cloned.id,
        versionId: draft.id,
      };
    },
    async createPurposeVersion(
      purposeId: PurposeId,
      seed: purposeApi.PurposeVersionSeed,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeVersionResource> {
      logger.info(
        `Creating version for purpose ${purposeId} with dailyCalls ${seed.dailyCalls}`
      );

      const purposeVersion = await purposeProcessClient.createPurposeVersion(
        seed,
        {
          params: {
            purposeId,
          },
          headers,
        }
      );

      return {
        purposeId,
        versionId: purposeVersion.id,
      };
    },
    async getRiskAnalysisDocument(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      documentId: PurposeVersionDocumentId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<Uint8Array> {
      logger.info(
        `Downloading risk analysis document ${documentId} from purpose ${purposeId} with version ${versionId}`
      );

      const document = await purposeProcessClient.getRiskAnalysisDocument({
        params: {
          purposeId,
          versionId,
          documentId,
        },
        headers,
      });

      const contentTypes = [
        "NoContentType",
        "application/grpc+proto",
        "application/json",
        "application/octet-stream",
        "application/x-www-form-urlencoded",
        "text/csv(UTF-8)",
        "text/html(UTF-8)",
        "text/plain(UTF-8)",
        "text/xml(UTF-8)",
      ];

      if (!contentTypes.includes(document.contentType)) {
        throw invalidRiskAnalysisContentType(
          document.contentType,
          purposeId,
          versionId,
          documentId
        );
      }

      return await fileManager.get(
        config.riskAnalysisDocumentsPath,
        document.path,
        logger
      );
    },
    async rejectPurposeVersion(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      seed: bffApi.RejectPurposeVersionPayload,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Rejecting version $versionId of purpose ${purposeId}`);

      await purposeClient.rejectPurposeVersion(seed, {
        params: {
          purposeId,
          versionId,
        },
        headers,
      });
    },
    async archivePurposeVersion(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      { headers, logger }: WithLogger<BffAppContext>
    ): Promise<bffApi.PurposeVersionResource> {
      logger.info(`Archiving purpose $purposeId with version ${versionId}`);

      await purposeClient.archivePurposeVersion(undefined, {
        params: {
          purposeId,
          versionId,
        },
        headers,
      });

      return {
        purposeId,
        versionId,
      };
    },
  };
}
