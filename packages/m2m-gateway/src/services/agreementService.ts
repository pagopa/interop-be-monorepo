import { FileManager, WithLogger } from "pagopa-interop-commons";
import { agreementApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  AgreementDocumentId,
  AgreementId,
  generateId,
} from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  isPolledVersionAtLeastMetadataTargetVersion,
  isPolledVersionAtLeastResponseVersion,
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

  return {
    async getAgreements(
      queryParams: m2mGatewayApi.GetAgreementsQueryParams,
      ctx: WithLogger<M2MGatewayAppContext>
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

      ctx.logger.info(
        `Retrieving agreements for producerIds ${producerIds}, consumerIds ${consumerIds}, eServiceIds ${eserviceIds}, descriptorIds ${descriptorIds}, states ${states}, limit ${limit}, offset ${offset}`
      );

      const {
        data: { results, totalCount },
      } = await clients.agreementProcessClient.getAgreements({
        queries: toGetAgreementsApiQueryParams(queryParams),
        headers: ctx.headers,
      });

      return {
        results: results.map(toM2MGatewayApiAgreement),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    async getAgreement(
      agreementId: AgreementId,
      ctx: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      ctx.logger.info(`Retrieving agreement with id ${agreementId}`);

      const { data: agreement } = await retrieveAgreementById(
        ctx.headers,
        agreementId
      );

      return toM2MGatewayApiAgreement(agreement);
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

      return toM2MGatewayApiAgreement(polledResource.data);
    },
    async approveAgreement(
      agreementId: AgreementId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(`Approving pending agreement with id ${agreementId}`);

      const agreement = await retrieveAgreementById(headers, agreementId);

      assertAgreementIsPending(agreement.data);

      const response = await clients.agreementProcessClient.activateAgreement(
        undefined,
        {
          params: { agreementId },
          headers,
        }
      );

      const polledResource = await pollAgreement(response, headers);

      return toM2MGatewayApiAgreement(polledResource.data);
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

      return toM2MGatewayApiAgreement(polledResource.data);
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

      return toM2MGatewayApiAgreement(polledResource.data);
    },
    async suspendAgreement(
      agreementId: AgreementId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(`Suspending agreement with id ${agreementId}`);

      const response = await clients.agreementProcessClient.suspendAgreement(
        undefined,
        {
          params: { agreementId },
          headers,
        }
      );

      const polledResource = await pollAgreement(response, headers);

      return toM2MGatewayApiAgreement(polledResource.data);
    },
    async unsuspendAgreement(
      agreementId: AgreementId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(`Unsuspending agreement with id ${agreementId}`);

      const agreement = await retrieveAgreementById(headers, agreementId);

      assertAgreementIsSuspended(agreement.data);

      const response = await clients.agreementProcessClient.activateAgreement(
        undefined,
        {
          params: { agreementId },
          headers,
        }
      );
      const polledResource = await pollAgreement(response, headers);

      return toM2MGatewayApiAgreement(polledResource.data);
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

      return toM2MGatewayApiAgreement(polledResource.data);
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

      return toM2MGatewayApiAgreement(polledResource.data);
    },
  };
}
