import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import {
  agreementApi,
  apiGatewayApi,
  purposeApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { toApiGatewayAgreementIfNotDraft } from "../api/agreementApiConverter.js";
import {
  agreementNotFound,
  producerAndConsumerParamMissing,
} from "../models/errors.js";
import { toAgreementProcessGetAgreementsQueryParams } from "../api/agreementApiConverter.js";
import { toApiGatewayAgreementAttributes } from "../api/attributeApiConverter.js";
import { clientStatusCodeToError } from "../clients/catchClientError.js";
import { getAllPurposes } from "./purposeService.js";

export async function getAllAgreements(
  agreementProcessClient: agreementApi.AgreementProcessClient,
  { headers, logger }: WithLogger<ApiGatewayAppContext>,
  queryParams: apiGatewayApi.GetAgreementsQueryParams
): Promise<apiGatewayApi.Agreements> {
  const getAgreementsQueryParams =
    toAgreementProcessGetAgreementsQueryParams(queryParams);

  const agreements = await getAllFromPaginated<agreementApi.Agreement>(
    async (offset, limit) =>
      await agreementProcessClient.getAgreements({
        headers,
        queries: {
          ...getAgreementsQueryParams,
          offset,
          limit,
        },
      })
  );
  return {
    agreements: agreements.map((agreement) =>
      toApiGatewayAgreementIfNotDraft(agreement, logger)
    ),
  };
}

const retrieveAgreement = (
  agreementProcessClient: agreementApi.AgreementProcessClient,
  headers: ApiGatewayAppContext["headers"],
  agreementId: agreementApi.Agreement["id"]
): Promise<agreementApi.Agreement> =>
  agreementProcessClient
    .getAgreementById({
      headers,
      params: {
        agreementId,
      },
    })
    .catch((res) => {
      throw clientStatusCodeToError(res, {
        404: agreementNotFound(agreementId),
      });
    });

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(
  agreementProcessClient: agreementApi.AgreementProcessClient,
  tenantProcessClient: tenantApi.TenantProcessClient,
  purposeProcessClient: purposeApi.PurposeProcessClient
) {
  return {
    getAgreements: async (
      ctx: WithLogger<ApiGatewayAppContext>,
      queryParams: apiGatewayApi.GetAgreementsQueryParams
    ): Promise<apiGatewayApi.Agreements> => {
      const { producerId, consumerId, eserviceId, descriptorId, states } =
        queryParams;

      ctx.logger.info(
        `Retrieving agreements for producerId ${producerId} consumerId ${consumerId} eServiceId ${eserviceId} descriptorId ${descriptorId} states ${states}`
      );

      if (producerId === undefined && consumerId === undefined) {
        throw producerAndConsumerParamMissing();
      }

      return await getAllAgreements(agreementProcessClient, ctx, queryParams);
    },

    getAgreementById: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      agreementId: agreementApi.Agreement["id"]
    ): Promise<apiGatewayApi.Agreement> => {
      logger.info(`Retrieving agreement by id = ${agreementId}`);
      const agreement = await retrieveAgreement(
        agreementProcessClient,
        headers,
        agreementId
      );

      return toApiGatewayAgreementIfNotDraft(agreement, logger);
    },

    getAgreementAttributes: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      agreementId: agreementApi.Agreement["id"]
    ): Promise<apiGatewayApi.Attributes> => {
      logger.info(`Retrieving Attributes for Agreement ${agreementId}`);

      const agreement = await retrieveAgreement(
        agreementProcessClient,
        headers,
        agreementId
      );

      const tenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: agreement.consumerId,
        },
      });

      return toApiGatewayAgreementAttributes(agreement, tenant);
    },

    getAgreementPurposes: async (
      ctx: WithLogger<ApiGatewayAppContext>,
      agreementId: agreementApi.Agreement["id"]
    ): Promise<apiGatewayApi.Purposes> => {
      ctx.logger.info(`Retrieving Purposes for Agreement ${agreementId}`);

      const agreement = await retrieveAgreement(
        agreementProcessClient,
        ctx.headers,
        agreementId
      );

      return await getAllPurposes(purposeProcessClient, ctx, {
        eserviceId: agreement.eserviceId,
        consumerId: agreement.consumerId,
      });
    },
  };
}
