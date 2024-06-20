import { AppContext, WithLogger } from "pagopa-interop-commons";
import {
  PurposeId,
  PurposeVersionId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  PurposeProcessApiCreateReversePurposeSeed,
  PurposeProcessApiCreatePurposeSeed,
  PurposeProcessApiUpdateReversePurposeSeed,
  PurposeProcessApiPurposeVersion,
  PurposeProcessApiPurpose,
  PurposeProcessApiPurposeVersionState,
} from "../model/api/purposeTypes.js";
import {
  Headers,
  AuthorizationProcessClient,
  PurposeProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
  AgreementProcessClient,
} from "../providers/clientProvider.js";
import {
  agreementNotFound,
  eServiceDescriptorNotFound,
  eServiceNotFound,
  purposeNotFound,
  tenantNotFound,
} from "../model/domain/errors.js";
import { AgreementProcessApiAgreement } from "../model/api/agreementTypes.js";
import { CatalogProcessApiDescriptor } from "../model/api/catalogTypes.js";
import { BffApiPurpose, BffApiPurposes } from "../model/api/bffTypes.js";
import { getAllClients } from "./authorizationService.js";
import { getLatestAgreement } from "./agreementService.js";

export const getCurrentVersion = (
  purposeVersions: PurposeProcessApiPurposeVersion[]
): PurposeProcessApiPurposeVersion | undefined => {
  const statesToExclude: PurposeProcessApiPurposeVersionState[] = [
    "WAITING_FOR_APPROVAL",
    "REJECTED",
  ];
  // eslint-disable-next-line functional/immutable-data
  return purposeVersions
    .filter((v) => !statesToExclude.includes(v.state))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .pop();
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(
  purposeClient: PurposeProcessClient,
  eserviceClient: CatalogProcessClient,
  tenantClient: TenantProcessClient,
  agreementClient: AgreementProcessClient,
  authorizationClient: AuthorizationProcessClient
) {
  return {
    async createPurpose(
      createSeed: PurposeProcessApiCreatePurposeSeed,
      { logger }: WithLogger<AppContext>,
      requestHeaders: Headers
    ): Promise<ReturnType<typeof purposeClient.createPurpose>> {
      logger.info(
        `Creating purpose with eService ${createSeed.eserviceId} and consumer ${createSeed.consumerId}`
      );
      return await purposeClient.createPurpose(createSeed, {
        headers: { ...requestHeaders },
        withCredentials: true,
      });
    },
    async createPurposeFromEService(
      createSeed: PurposeProcessApiCreateReversePurposeSeed,
      { logger }: WithLogger<AppContext>,
      requestHeaders: Headers
    ): Promise<ReturnType<typeof purposeClient.createPurposeFromEService>> {
      logger.info("Creating purpose from e-service");
      return await purposeClient.createPurposeFromEService(createSeed, {
        headers: { ...requestHeaders },
        withCredentials: true,
      });
    },
    async reversePurposeUpdate(
      id: PurposeId,
      updateSeed: PurposeProcessApiUpdateReversePurposeSeed,
      { logger }: WithLogger<AppContext>,
      requestHeaders: Headers
    ): Promise<{ purposeId: PurposeId; versionId: PurposeVersionId }> {
      logger.info(`Updating reverse purpose ${id}`);
      const updatedPurpose = await purposeClient.updateReversePurpose(
        updateSeed,
        {
          headers: { ...requestHeaders },
          withCredentials: true,
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
    async getPurposeProducer(
      filters: {
        name?: string | undefined;
        eservicesIds?: string | undefined;
        consumersIds?: string | undefined;
        producersIds?: string | undefined;
        states?: string | undefined;
        excludeDraft?: boolean | undefined;
      },
      offset: number,
      limit: number,
      { authData }: WithLogger<AppContext>,
      requestHeaders: Headers
    ): Promise<BffApiPurposes> {
      const purposes = await purposeClient.getPurposes({
        queries: {
          ...filters,
          limit,
          offset,
        },
        withCredentials: true,
        headers: { ...requestHeaders },
      });

      const eservices = await Promise.all(
        [...new Set(purposes.results.map((p) => p.eserviceId))].map((id) =>
          eserviceClient.getEServiceById({
            params: {
              eServiceId: id,
            },
            withCredentials: true,
            headers: { ...requestHeaders },
          })
        )
      );
      const consumers = await Promise.all(
        [...new Set(purposes.results.map((p) => p.consumerId))].map((id) =>
          tenantClient.getTenant({
            params: {
              id,
            },
            withCredentials: true,
            headers: { ...requestHeaders },
          })
        )
      );
      const producers = await Promise.all(
        // eslint-disable-next-line sonarjs/no-identical-functions
        [...new Set(eservices.map((e) => e.producerId))].map((id) =>
          tenantClient.getTenant({
            params: {
              id,
            },
            withCredentials: true,
            headers: { ...requestHeaders },
          })
        )
      );

      const enhancePurpose = async (
        purpose: PurposeProcessApiPurpose
      ): Promise<BffApiPurpose> => {
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
          requestHeaders
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

        const requesterId = authData.organizationId;
        const clients =
          requesterId === purpose.consumerId
            ? (
                await getAllClients(
                  authorizationClient,
                  purpose.consumerId,
                  purpose.id,
                  requestHeaders
                )
              ).map((c) => ({
                id: c.client.id,
                name: c.client.name,
                hasKeys: c.keys.length > 0,
              }))
            : [];

        const currentVersion = getCurrentVersion(purpose.versions);
        const waitingForApprovalVersion = purpose.versions.find(
          (v) => v.state === "WAITING_FOR_APPROVAL"
        );
        const rejectedVersion = purpose.versions.find(
          (v) => v.state === "REJECTED"
        );

        const isUpgradable = (
          descriptor: CatalogProcessApiDescriptor,
          agreement: AgreementProcessApiAgreement,
          descriptors: CatalogProcessApiDescriptor[]
        ): boolean =>
          descriptors
            .filter((d) => Number(d.version) > Number(descriptor.version))
            .some(
              (d) =>
                (d.state === "PUBLISHED" || d.state === "SUSPENDED") &&
                (agreement.state === "ACTIVE" ||
                  agreement.state === "SUSPENDED")
            );

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
            canBeUpgraded: isUpgradable(
              currentDescriptor,
              latestAgreement,
              eservice.descriptors
            ),
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
    },
  };
}
