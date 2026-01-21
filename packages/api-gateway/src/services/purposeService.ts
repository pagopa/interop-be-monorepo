import {
  getAllFromPaginated,
  M2MAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import {
  agreementApi,
  apiGatewayApi,
  catalogApi,
  delegationApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import { operationForbidden } from "pagopa-interop-models";
import { DelegationProcessClient } from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import {
  toApiGatewayPurpose,
  toPurposeProcessGetPurposesQueryParams,
} from "../api/purposeApiConverter.js";
import { clientStatusCodeToError } from "../clients/catchClientError.js";
import { purposeNotFound } from "../models/errors.js";
import {
  assertIsEserviceProducer,
  assertIsEserviceDelegateProducer,
  assertOnlyOneActiveProducerDelegationForEserviceExists,
  assertOnlyOneAgreementForEserviceAndConsumerExists,
} from "./validators.js";
import { getAllAgreements } from "./agreementService.js";

export async function getAllPurposes(
  purposeProcessClient: purposeApi.PurposeProcessClient,
  ctx: WithLogger<ApiGatewayAppContext>,
  { eserviceId, consumerId }: apiGatewayApi.GetPurposesQueryParams
): Promise<apiGatewayApi.Purposes> {
  const getPurposesQueryParams = toPurposeProcessGetPurposesQueryParams({
    eserviceId,
    consumerId,
  });

  const purposes = await getAllFromPaginated<purposeApi.Purpose>(
    async (offset, limit) =>
      await purposeProcessClient.getPurposes({
        headers: ctx.headers,
        queries: {
          ...getPurposesQueryParams,
          offset,
          limit,
        },
      })
  );

  return { purposes: purposes.map((p) => toApiGatewayPurpose(p, ctx.logger)) };
}

const retrievePurpose = async (
  purposeProcessClient: purposeApi.PurposeProcessClient,
  headers: ApiGatewayAppContext["headers"],
  purposeId: purposeApi.Purpose["id"]
): Promise<purposeApi.Purpose> =>
  purposeProcessClient
    .getPurpose({
      headers,
      params: {
        id: purposeId,
      },
    })
    .catch((res) => {
      throw clientStatusCodeToError(res, {
        403: operationForbidden,
        404: purposeNotFound(purposeId),
      });
    });

const retrieveActiveProducerDelegationByEServiceId = async (
  delegationProcessClient: DelegationProcessClient,
  headers: ApiGatewayAppContext["headers"],
  eserviceId: catalogApi.EService["id"]
): Promise<delegationApi.Delegation | undefined> => {
  const result = await delegationProcessClient.getDelegations({
    headers,
    queries: {
      eserviceIds: [eserviceId],
      kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
      delegationStates: [delegationApi.DelegationState.Values.ACTIVE],
      limit: 1,
      offset: 0,
    },
  });

  assertOnlyOneActiveProducerDelegationForEserviceExists(result, eserviceId);

  return result.results.at(0);
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(
  purposeProcessClient: purposeApi.PurposeProcessClient,
  catalogProcessClient: catalogApi.CatalogProcessClient,
  agreementProcessClient: agreementApi.AgreementProcessClient,
  delegationProcessClient: DelegationProcessClient
) {
  return {
    getPurpose: async (
      {
        logger,
        headers,
        authData: { organizationId },
      }: WithLogger<ApiGatewayAppContext<M2MAuthData>>,
      purposeId: purposeApi.Purpose["id"]
    ): Promise<apiGatewayApi.Purpose> => {
      logger.info(`Retrieving Purpose ${purposeId}`);

      const purpose = await retrievePurpose(
        purposeProcessClient,
        headers,
        purposeId
      );

      if (purpose.consumerId !== organizationId) {
        const eservice = await catalogProcessClient.getEServiceById({
          headers,
          params: {
            eServiceId: purpose.eserviceId,
          },
        });

        try {
          assertIsEserviceProducer(eservice, organizationId);
        } catch {
          const producerDelegation =
            await retrieveActiveProducerDelegationByEServiceId(
              delegationProcessClient,
              headers,
              eservice.id
            );

          assertIsEserviceDelegateProducer(producerDelegation, organizationId);
        }
      }

      return toApiGatewayPurpose(purpose, logger);
    },

    getPurposes: async (
      ctx: WithLogger<ApiGatewayAppContext>,
      { eserviceId, consumerId }: apiGatewayApi.GetPurposesQueryParams
    ): Promise<apiGatewayApi.Purposes> => {
      ctx.logger.info(
        `Retrieving Purposes for eservice ${eserviceId} and consumer ${consumerId}"`
      );
      return await getAllPurposes(purposeProcessClient, ctx, {
        eserviceId,
        consumerId,
      });
    },

    getAgreementByPurpose: async (
      ctx: WithLogger<ApiGatewayAppContext>,
      purposeId: purposeApi.Purpose["id"]
    ): Promise<apiGatewayApi.Agreement> => {
      ctx.logger.info(`Retrieving agreement by purpose ${purposeId}`);
      const purpose = await retrievePurpose(
        purposeProcessClient,
        ctx.headers,
        purposeId
      );

      const { agreements } = await getAllAgreements(
        agreementProcessClient,
        ctx,
        {
          consumerId: purpose.consumerId,
          eserviceId: purpose.eserviceId,
          producerId: undefined,
          descriptorId: undefined,
          states: [
            apiGatewayApi.AgreementState.Values.ACTIVE,
            apiGatewayApi.AgreementState.Values.SUSPENDED,
          ],
        }
      );

      assertOnlyOneAgreementForEserviceAndConsumerExists(
        agreements,
        purpose.eserviceId,
        purpose.consumerId
      );

      return agreements[0];
    },
  };
}
