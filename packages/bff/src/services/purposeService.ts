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
  PurposeProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import {
  agreementNotFound,
  eServiceDescriptorNotFound,
  eServiceNotFound,
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
    purposeClient,
    eserviceClient,
    tenantClient,
    agreementClient,
    authorizationClient,
  }: {
    purposeClient: PurposeProcessClient;
    eserviceClient: CatalogProcessClient;
    tenantClient: TenantProcessClient;
    agreementClient: AgreementProcessClient;
    authorizationClient: AuthorizationProcessClient;
  },
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
  const purposes = await purposeClient.getPurposes({
    queries: {
      ...filters,
      limit,
      offset,
    },
    headers,
  });

  const eservices = await Promise.all(
    toSetToArray(purposes.results.map((p) => p.eserviceId)).map((id) =>
      eserviceClient.getEServiceById({
        params: {
          eServiceId: id,
        },
        headers,
      })
    )
  );

  const getTenant = async (id: string): Promise<tenantApi.Tenant> =>
    tenantClient.tenant.getTenant({
      params: {
        id,
      },
      headers,
    });
  const consumers = await Promise.all(
    [...new Set(purposes.results.map((p) => p.consumerId))].map(getTenant)
  );
  const producers = await Promise.all(
    [...new Set(eservices.map((e) => e.producerId))].map(getTenant)
  );

  const enhancePurpose = async (
    purpose: purposeApi.Purpose
  ): Promise<bffApi.Purpose> => {
    const eservice = eservices.find((e) => e.id === purpose.eserviceId);
    if (!eservice) {
      throw eServiceNotFound(unsafeBrandId(purpose.eserviceId));
    }

    const producer = producers.find((p) => p.id === eservice.producerId);
    if (!producer) {
      throw tenantNotFound(unsafeBrandId(eservice.producerId));
    }

    const consumer = consumers.find((c) => c.id === purpose.consumerId);
    if (!consumer) {
      throw tenantNotFound(unsafeBrandId(purpose.consumerId));
    }

    const latestAgreement = await getLatestAgreement(
      agreementClient,
      purpose.consumerId,
      eservice,
      headers
    );
    if (!latestAgreement) {
      throw agreementNotFound(unsafeBrandId(purpose.consumerId));
    }

    const currentDescriptor = eservice.descriptors.find(
      (d) => d.id === latestAgreement.descriptorId
    );
    if (!currentDescriptor) {
      throw eServiceDescriptorNotFound(
        unsafeBrandId(eservice.id),
        unsafeBrandId(latestAgreement.descriptorId)
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
    // eslint-disable-next-line functional/immutable-data
    const latestVersion = purpose.versions
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .pop();

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
  purposeClient: PurposeProcessClient,
  eserviceClient: CatalogProcessClient,
  tenantClient: TenantProcessClient,
  agreementClient: AgreementProcessClient,
  authorizationClient: AuthorizationProcessClient,
  fileManager: FileManager
) {
  return {
    async createPurpose(
      createSeed: bffApi.PurposeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<ReturnType<typeof purposeClient.createPurpose>> {
      logger.info(
        `Creating purpose with eService ${createSeed.eserviceId} and consumer ${createSeed.consumerId}`
      );
      return await purposeClient.createPurpose(createSeed, {
        headers,
      });
    },
    async createPurposeForReceiveEservice(
      createSeed: bffApi.PurposeEServiceSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<ReturnType<typeof purposeClient.createPurposeFromEService>> {
      logger.info(
        `Creating purpose from ESErvice ${createSeed.eserviceId} and Risk Analysis ${createSeed.riskAnalysisId}`
      );
      const payload = {
        ...createSeed,
        eServiceId: createSeed.eserviceId,
      };
      return await purposeClient.createPurposeFromEService(payload, {
        headers,
      });
    },
    async reversePurposeUpdate(
      id: PurposeId,
      updateSeed: bffApi.ReversePurposeUpdateContent,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<{ purposeId: PurposeId; versionId: PurposeVersionId }> {
      logger.info(`Updating reverse purpose ${id}`);
      const updatedPurpose = await purposeClient.updateReversePurpose(
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
          purposeClient,
          eserviceClient,
          tenantClient,
          agreementClient,
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
          purposeClient,
          eserviceClient,
          tenantClient,
          agreementClient,
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

      const cloned = await purposeClient.clonePurpose(seed, {
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

      const purposeVersion = await purposeClient.createPurposeVersion(seed, {
        params: {
          purposeId,
        },
        headers,
      });

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

      const document = await purposeClient.getRiskAnalysisDocument({
        params: {
          purposeId,
          versionId,
          documentId,
        },
        headers,
      });

      return await fileManager.get(
        config.riskAnalysisDocumentsPath,
        document.path,
        logger
      );
    },
  };
}
