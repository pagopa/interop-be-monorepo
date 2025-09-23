import { FileManager, WithLogger } from "pagopa-interop-commons";
import {
  agreementApi,
  delegationApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import {
  AgreementDocumentId,
  AgreementId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  isPolledVersionAtLeastMetadataTargetVersion,
  isPolledVersionAtLeastResponseVersion,
  pollResourceUntilDeletion,
  pollResourceWithMetadata,
} from "../utils/polling.js";
import {
  assertAgreementIsPending,
  assertAgreementIsSuspended,
} from "../utils/validators/agreementValidators.js";
import {
  toGetAgreementsApiQueryParams,
  toGetPurposesApiQueryParamsForAgreement,
  toM2MGatewayApiAgreement,
  toM2MGatewayApiDocument,
} from "../api/agreementApiConverter.js";
import { toM2MGatewayApiPurpose } from "../api/purposeApiConverter.js";
import { config } from "../config/config.js";
import { DownloadedDocument, downloadDocument } from "../utils/fileDownload.js";
import { agreementContractNotFound } from "../model/errors.js";

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(
  clients: PagoPAInteropBeClients,
  fileManager: FileManager
) {
  const retrieveAgreementById = async (
    headers: M2MGatewayAppContext["headers"],
    agreementId: string
  ): Promise<WithMaybeMetadata<agreementApi.Agreement>> =>
    await clients.agreementProcessClient.getAgreementById({
      params: {
        agreementId,
      },
      headers,
    });

  const retrieveAgreementDelegationId = async (
    agreement: agreementApi.Agreement,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<delegationApi.Delegation["id"] | undefined> =>
    agreement.stamps.submission
      ? agreement.stamps.submission.delegationId
      : (
          await clients.delegationProcessClient.delegation.getDelegations({
            headers,
            queries: {
              eserviceIds: [agreement.eserviceId],
              delegatorIds: [agreement.consumerId],
              kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
              delegationStates: [delegationApi.DelegationState.Values.ACTIVE],
              limit: 1,
              offset: 0,
            },
          })
        ).data.results.at(0)?.id;
  /* ^ For an unsubmitted Agreement (no submission stamp yet), retrieve the
    Delegation ID from the Active Delegation. The Delegation, if present, can only
    be active here, since on Delegation revocation:
    - Active / Suspended agreements are archived
    - Unsubmitted agreements are deleted (Draft, Pending, MissingCertifiedAttributes)
    */

  const toM2MGatewayApiAgreementWithDelegationId = async (
    agreement: agreementApi.Agreement,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<m2mGatewayApi.Agreement> =>
    toM2MGatewayApiAgreement(
      agreement,
      await retrieveAgreementDelegationId(agreement, headers)
    );

  const pollAgreement = (
    response: WithMaybeMetadata<agreementApi.Agreement>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<agreementApi.Agreement>> =>
    pollResourceWithMetadata(() =>
      retrieveAgreementById(headers, response.data.id)
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  const pollAgreementById = (
    agreementId: AgreementId,
    metadata: { version: number } | undefined,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<agreementApi.Agreement>> =>
    pollResourceWithMetadata(() => retrieveAgreementById(headers, agreementId))(
      {
        condition: isPolledVersionAtLeastMetadataTargetVersion(metadata),
      }
    );

  const pollAgreementUntilDeletion = (
    agreementId: string,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<void> =>
    pollResourceUntilDeletion(() =>
      retrieveAgreementById(headers, unsafeBrandId(agreementId))
    )({});

  return {
    async getAgreements(
      queryParams: m2mGatewayApi.GetAgreementsQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreements> {
      const {
        producerIds,
        consumerIds,
        eserviceIds,
        descriptorIds,
        states,
        limit,
        offset,
      } = queryParams;

      logger.info(
        `Retrieving agreements for producerIds ${producerIds}, consumerIds ${consumerIds}, eServiceIds ${eserviceIds}, descriptorIds ${descriptorIds}, states ${states}, limit ${limit}, offset ${offset}`
      );

      const {
        data: { results, totalCount },
      } = await clients.agreementProcessClient.getAgreements({
        queries: toGetAgreementsApiQueryParams(queryParams),
        headers,
      });

      return {
        results: await Promise.all(
          results.map((a) =>
            toM2MGatewayApiAgreementWithDelegationId(a, headers)
          )
        ),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    async getAgreement(
      agreementId: AgreementId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(`Retrieving agreement with id ${agreementId}`);

      const { data: agreement } = await retrieveAgreementById(
        headers,
        agreementId
      );

      return toM2MGatewayApiAgreementWithDelegationId(agreement, headers);
    },
    async getAgreementPurposes(
      agreementId: AgreementId,
      { limit, offset }: m2mGatewayApi.GetAgreementPurposesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purposes> {
      logger.info(`Retrieving purposes for agreement ${agreementId}`);

      const { data: agreement } = await retrieveAgreementById(
        headers,
        agreementId
      );

      const {
        data: { results, totalCount },
      } = await clients.purposeProcessClient.getPurposes({
        queries: toGetPurposesApiQueryParamsForAgreement(agreement, {
          limit,
          offset,
        }),
        headers,
      });

      return {
        results: results.map(toM2MGatewayApiPurpose),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    async createAgreement(
      seed: agreementApi.AgreementPayload,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(
        `Creating agreement for e-service ${seed.eserviceId} and descriptor ${seed.descriptorId}` +
          (seed.delegationId ? ` with delegation ${seed.delegationId}` : "")
      );

      const response = await clients.agreementProcessClient.createAgreement(
        seed,
        {
          headers,
        }
      );

      const polledResource = await pollAgreement(response, headers);

      return toM2MGatewayApiAgreementWithDelegationId(
        polledResource.data,
        headers
      );
    },
    async approveAgreement(
      agreementId: AgreementId,
      { delegationId }: m2mGatewayApi.DelegationRef,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(`Approving pending agreement with id ${agreementId}`);

      const agreement = await retrieveAgreementById(headers, agreementId);

      assertAgreementIsPending(agreement.data);

      const response = await clients.agreementProcessClient.activateAgreement(
        { delegationId },
        {
          params: { agreementId },
          headers,
        }
      );

      const polledResource = await pollAgreement(response, headers);

      return toM2MGatewayApiAgreementWithDelegationId(
        polledResource.data,
        headers
      );
    },
    async rejectAgreement(
      agreementId: AgreementId,
      body: m2mGatewayApi.AgreementRejection,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(`Rejecting agreement with id ${agreementId}`);

      const response = await clients.agreementProcessClient.rejectAgreement(
        body,
        {
          params: { agreementId },
          headers,
        }
      );

      const polledResource = await pollAgreement(response, headers);

      return toM2MGatewayApiAgreementWithDelegationId(
        polledResource.data,
        headers
      );
    },
    async submitAgreement(
      agreementId: AgreementId,
      body: m2mGatewayApi.AgreementSubmission,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(`Submitting agreement with id ${agreementId}`);

      const response = await clients.agreementProcessClient.submitAgreement(
        body,
        {
          params: { agreementId },
          headers,
        }
      );

      const polledResource = await pollAgreement(response, headers);

      return toM2MGatewayApiAgreementWithDelegationId(
        polledResource.data,
        headers
      );
    },
    async suspendAgreement(
      agreementId: AgreementId,
      { delegationId }: m2mGatewayApi.DelegationRef,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(`Suspending agreement with id ${agreementId}`);

      const response = await clients.agreementProcessClient.suspendAgreement(
        { delegationId },
        {
          params: { agreementId },
          headers,
        }
      );

      const polledResource = await pollAgreement(response, headers);

      return toM2MGatewayApiAgreementWithDelegationId(
        polledResource.data,
        headers
      );
    },
    async unsuspendAgreement(
      agreementId: AgreementId,
      { delegationId }: m2mGatewayApi.DelegationRef,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(`Unsuspending agreement with id ${agreementId}`);

      const agreement = await retrieveAgreementById(headers, agreementId);

      assertAgreementIsSuspended(agreement.data);

      const response = await clients.agreementProcessClient.activateAgreement(
        { delegationId },
        {
          params: { agreementId },
          headers,
        }
      );
      const polledResource = await pollAgreement(response, headers);

      return toM2MGatewayApiAgreementWithDelegationId(
        polledResource.data,
        headers
      );
    },
    async upgradeAgreement(
      agreementId: AgreementId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(`Upgrading agreement with id ${agreementId}`);

      const response = await clients.agreementProcessClient.upgradeAgreement(
        undefined,
        {
          params: { agreementId },
          headers,
        }
      );

      const polledResource = await pollAgreement(response, headers);

      return toM2MGatewayApiAgreementWithDelegationId(
        polledResource.data,
        headers
      );
    },
    async getAgreementConsumerDocuments(
      agreementId: AgreementId,
      { offset, limit }: m2mGatewayApi.GetAgreementConsumerDocumentsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Documents> {
      logger.info(
        `Retrieving consumer documents for agreement with id ${agreementId}`
      );

      const { data: documents } =
        await clients.agreementProcessClient.getAgreementConsumerDocuments({
          params: { agreementId },
          queries: { offset, limit },
          headers,
        });

      return {
        results: documents.results.map(toM2MGatewayApiDocument),
        pagination: {
          limit,
          offset,
          totalCount: documents.totalCount,
        },
      };
    },
    async uploadAgreementConsumerDocument(
      agreementId: AgreementId,
      fileUpload: m2mGatewayApi.FileUploadMultipart,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Document> {
      logger.info(
        `Adding consumer document ${fileUpload.file.name} to agreement with id ${agreementId}`
      );

      const documentId = generateId();
      const storagePath = await fileManager.storeBytes(
        {
          bucket: config.agreementConsumerDocumentsContainer,
          path: `${config.agreementConsumerDocumentsPath}/${agreementId}`,
          resourceId: documentId,
          name: fileUpload.file.name,
          content: Buffer.from(await fileUpload.file.arrayBuffer()),
        },
        logger
      );

      const documentSeed: agreementApi.DocumentSeed = {
        id: documentId,
        prettyName: fileUpload.prettyName,
        name: fileUpload.file.name,
        contentType: fileUpload.file.type,
        path: storagePath,
      };

      const { data: document, metadata } =
        await clients.agreementProcessClient.addAgreementConsumerDocument(
          documentSeed,
          {
            params: { agreementId },
            headers,
          }
        );

      await pollAgreementById(agreementId, metadata, headers);

      return toM2MGatewayApiDocument(document);
    },
    async downloadAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<DownloadedDocument> {
      logger.info(
        `Retrieving consumer document with id ${documentId} for agreement with id ${agreementId}`
      );

      const { data: document } =
        await clients.agreementProcessClient.getAgreementConsumerDocument({
          params: { agreementId, documentId },
          headers,
        });

      return downloadDocument(
        document,
        fileManager,
        config.agreementConsumerDocumentsContainer,
        logger
      );
    },
    async deleteAgreementById(
      agreementId: AgreementId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(`Deleting agreement with id ${agreementId}`);

      await clients.agreementProcessClient.deleteAgreement(undefined, {
        params: { agreementId },
        headers,
      });
      await pollAgreementUntilDeletion(agreementId, headers);
    },
    async downloadAgreementConsumerContract(
      agreementId: AgreementId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<DownloadedDocument> {
      logger.info(`Retrieving contract for agreement with id ${agreementId}`);

      const { data: agreement } = await retrieveAgreementById(
        headers,
        agreementId
      );

      if (!agreement.contract) {
        throw agreementContractNotFound(agreementId);
      }

      return downloadDocument(
        agreement.contract,
        fileManager,
        config.agreementConsumerDocumentsContainer,
        logger
      );
    },
    async deleteAgreementConsumerDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Removing consumer document ${documentId} for agreement with id ${agreementId}`
      );
      const { metadata } =
        await clients.agreementProcessClient.removeAgreementConsumerDocument(
          undefined,
          {
            params: { agreementId, documentId },
            headers,
          }
        );

      await pollAgreementById(agreementId, metadata, headers);
    },
    async cloneAgreement(
      agreementId: AgreementId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(`Cloning agreement with id ${agreementId}`);

      const response = await clients.agreementProcessClient.cloneAgreement(
        undefined,
        {
          params: { agreementId },
          headers,
        }
      );

      const polledResource = await pollAgreement(response, headers);

      return toM2MGatewayApiAgreementWithDelegationId(
        polledResource.data,
        headers
      );
    },
  };
}
