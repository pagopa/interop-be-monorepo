import { WithLogger } from "pagopa-interop-commons";
import { agreementApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { AgreementId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { toM2MAgreement } from "../api/agreementApiConverter.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResource,
} from "../utils/polling.js";
import { assertAgreementIsPending } from "../utils/validators/agreementValidators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder({
  agreementProcessClient,
}: PagoPAInteropBeClients) {
  const retrieveAgreementById = async (
    headers: M2MGatewayAppContext["headers"],
    agreementId: AgreementId
  ): Promise<WithMaybeMetadata<agreementApi.Agreement>> =>
    await agreementProcessClient.getAgreementById({
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
    pollResource(() =>
      agreementProcessClient.getAgreementById({
        params: { agreementId: response.data.id },
        headers,
      })
    )({
      checkFn: isPolledVersionAtLeastResponseVersion(response),
    });

  return {
    getAgreements: async (
      ctx: WithLogger<M2MGatewayAppContext>,
      queryParams: m2mGatewayApi.GetAgreementsQueryParams
    ): Promise<m2mGatewayApi.Agreements> => {
      const { producerIds, consumerIds, eserviceIds, states, limit, offset } =
        queryParams;

      ctx.logger.info(
        `Retrieving agreements for producerId ${producerIds} consumerId ${consumerIds} eServiceId ${eserviceIds} states ${states} limit ${limit} offset ${offset}`
      );

      const {
        data: { results, totalCount },
      } = await agreementProcessClient.getAgreements({
        queries: {
          consumersIds: consumerIds,
          producersIds: producerIds,
          eservicesIds: eserviceIds,
          states,
          limit,
          offset,
        },
        headers: ctx.headers,
      });

      return {
        results: results.map(toM2MAgreement),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    getAgreement: async (
      ctx: WithLogger<M2MGatewayAppContext>,
      agreementId: AgreementId
    ): Promise<m2mGatewayApi.Agreement> => {
      ctx.logger.info(`Retrieving agreement with id ${agreementId}`);

      const { data: agreement } = await retrieveAgreementById(
        ctx.headers,
        agreementId
      );

      return toM2MAgreement(agreement);
    },
    createAgreement: async (
      seed: agreementApi.AgreementPayload,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> => {
      logger.info(`Creating agreement`);

      const response = await agreementProcessClient.createAgreement(seed, {
        headers,
      });

      const polledResource = await pollAgreement(response, headers);

      return toM2MAgreement(polledResource.data);
    },
    approveAgreement: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      agreementId: AgreementId
    ): Promise<m2mGatewayApi.Agreement> => {
      logger.info(`Approving pending agreement with id ${agreementId}`);

      const agreement = await retrieveAgreementById(headers, agreementId);

      assertAgreementIsPending(agreement.data);

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
    rejectAgreement: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      agreementId: AgreementId,
      body: m2mGatewayApi.AgreementRejection
    ): Promise<m2mGatewayApi.Agreement> => {
      logger.info(`Rejecting pending agreement with id ${agreementId}`);

      const response = await agreementProcessClient.rejectAgreement(body, {
        params: { agreementId },
        headers,
      });

      const polledResource = await pollAgreement(response, headers);

      return toM2MAgreement(polledResource.data);
    },
    submitAgreement: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      agreementId: AgreementId,
      body: m2mGatewayApi.AgreementSubmission
    ): Promise<m2mGatewayApi.Agreement> => {
      logger.info(`Submitting agreement with id ${agreementId}`);

      const response = await agreementProcessClient.submitAgreement(body, {
        params: { agreementId },
        headers,
      });

      const polledResource = await pollAgreement(response, headers);

      return toM2MAgreement(polledResource.data);
    },
    suspendAgreement: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      agreementId: AgreementId
    ): Promise<m2mGatewayApi.Agreement> => {
      logger.info(`Suspending agreement with id ${agreementId}`);

      const response = await agreementProcessClient.suspendAgreement(
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
