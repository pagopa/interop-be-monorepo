import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import { apiGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import {
  AgreementProcessClient,
  CatalogProcessClient,
  PurposeProcessClient,
} from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import {
  toApiGatewayPurpose,
  toPurposeProcessGetPurposesQueryParams,
} from "../api/purposeApiConverter.js";
import { clientStatusCodeToError } from "../clients/catchClientError.js";
import { purposeNotFound } from "../models/errors.js";
import {
  assertIsEserviceProducer,
  assertOnlyOneAgreementForEserviceAndConsumerExists,
} from "./validators.js";
import { getAllAgreements } from "./agreementService.js";

export async function getAllPurposes(
  purposeProcessClient: PurposeProcessClient,
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
  purposeProcessClient: PurposeProcessClient,
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
        404: purposeNotFound(purposeId),
      });
    });

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(
  purposeProcessClient: PurposeProcessClient,
  catalogProcessClient: CatalogProcessClient,
  agreementProcessClient: AgreementProcessClient
) {
  return {
    getPurpose: async (
      {
        logger,
        headers,
        authData: { organizationId },
      }: WithLogger<ApiGatewayAppContext>,
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

        assertIsEserviceProducer(eservice, organizationId);
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
