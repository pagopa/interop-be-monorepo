import { WithLogger } from "pagopa-interop-commons";
import { agreementApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { AgreementId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResource,
} from "../utils/polling.js";
import {
  assertAgreementIsPending,
  assertAgreementIsSuspended,
} from "../utils/validators/agreementValidators.js";
import {
  toGetAgreementsApiQueryParams,
  toM2MGatewayApiAgreement,
} from "../api/agreementApiConverter.js";

export type AgreementService = ReturnType<typeof agreementServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(clients: PagoPAInteropBeClients) {
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

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const pollAgreement = (
    response: WithMaybeMetadata<agreementApi.Agreement>,
    headers: M2MGatewayAppContext["headers"]
  ) =>
    pollResource(() => retrieveAgreementById(headers, response.data.id))({
      checkFn: isPolledVersionAtLeastResponseVersion(response),
    });

  return {
    getAgreements: async (
      queryParams: m2mGatewayApi.GetAgreementsQueryParams,
      ctx: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreements> => {
      const { producerIds, consumerIds, eserviceIds, states, limit, offset } =
        queryParams;

      ctx.logger.info(
        `Retrieving agreements for producerId ${producerIds} consumerId ${consumerIds} eServiceId ${eserviceIds} states ${states} limit ${limit} offset ${offset}`
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
    getAgreement: async (
      agreementId: AgreementId,
      ctx: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> => {
      ctx.logger.info(`Retrieving agreement with id ${agreementId}`);

      const { data: agreement } = await retrieveAgreementById(
        ctx.headers,
        agreementId
      );

      return toM2MGatewayApiAgreement(agreement);
    },
    createAgreement: async (
      seed: agreementApi.AgreementPayload,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> => {
      logger.info(`Creating agreement`);

      const response = await clients.agreementProcessClient.createAgreement(
        seed,
        {
          headers,
        }
      );

      const polledResource = await pollAgreement(response, headers);

      return toM2MGatewayApiAgreement(polledResource.data);
    },
    approveAgreement: async (
      agreementId: AgreementId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> => {
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
    rejectAgreement: async (
      agreementId: AgreementId,
      body: m2mGatewayApi.AgreementRejection,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> => {
      logger.info(`Rejecting pending agreement with id ${agreementId}`);

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
    submitAgreement: async (
      agreementId: AgreementId,
      body: m2mGatewayApi.AgreementSubmission,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> => {
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
    suspendAgreement: async (
      agreementId: AgreementId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> => {
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
    unsuspendAgreement: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      agreementId: AgreementId
    ): Promise<m2mGatewayApi.Agreement> => {
      logger.info(`Unsuspending agreement with id ${agreementId}`);

      const agreement = await retrieveAgreementById(headers, agreementId);

      assertAgreementIsSuspended(agreement.data);

      const response = await agreementProcessClient.activateAgreement(
        undefined,
        {
          params: { agreementId },
          headers,
        }
      );
      const polledResource = await pollAgreement(response, headers);

      return toM2MAgreement(polledResource.data);
    },
  };
}
