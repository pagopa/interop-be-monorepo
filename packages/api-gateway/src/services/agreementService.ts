import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import {
  agreementApi,
  apiGatewayApi,
  purposeApi,
} from "pagopa-interop-api-clients";
import {
  AgreementProcessClient,
  PurposeProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { toApiGatewayAgreementIfNotDraft } from "../api/agreementApiConverter.js";
import { producerAndConsumerParamMissing } from "../models/errors.js";
import { toAgreementProcessGetAgreementsQueryParams } from "../api/agreementApiConverter.js";
import { toApiGatewayAgreementAttributes } from "../api/attributesApiConverter.js";
import {
  toApiGatewayPurpose,
  toPurposeProcessGetPurposesQueryParams,
} from "../api/purposeApiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(
  agreementProcessClient: AgreementProcessClient,
  tenantProcessClient: TenantProcessClient,
  purposeProcessClient: PurposeProcessClient
) {
  return {
    getAgreements: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      queryParams: apiGatewayApi.GetAgreementsQueryParams
    ): Promise<apiGatewayApi.Agreements> => {
      const { producerId, consumerId, eserviceId, descriptorId, states } =
        queryParams;

      logger.info(
        `Retrieving agreements for producerId ${producerId} consumerId ${consumerId} eServiceId ${eserviceId} descriptorId ${descriptorId} states ${states}`
      );

      if (producerId === undefined && consumerId === undefined) {
        throw producerAndConsumerParamMissing();
      }

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
      return { agreements: agreements.map(toApiGatewayAgreementIfNotDraft) };
    },

    getAgreementById: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      agreementId: agreementApi.Agreement["id"]
    ): Promise<apiGatewayApi.Agreement> => {
      logger.info(`Retrieving agreement by id = ${agreementId}`);
      const agreement = await agreementProcessClient.getAgreementById({
        headers,
        params: {
          agreementId,
        },
      });

      return toApiGatewayAgreementIfNotDraft(agreement);
    },

    getAgreementAttributes: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      agreementId: agreementApi.Agreement["id"]
    ): Promise<apiGatewayApi.Attributes> => {
      logger.info(`Retrieving Attributes for Agreement ${agreementId}`);

      const agreement = await agreementProcessClient.getAgreementById({
        headers,
        params: {
          agreementId,
        },
      });

      const tenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: agreement.consumerId,
        },
      });

      return toApiGatewayAgreementAttributes(agreement, tenant);
    },

    getAgreementPurposes: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      agreementId: agreementApi.Agreement["id"]
    ): Promise<apiGatewayApi.Purposes> => {
      logger.info(`Retrieving Purposes for Agreement ${agreementId}`);

      const agreement = await agreementProcessClient.getAgreementById({
        headers,
        params: {
          agreementId,
        },
      });

      const getPurposesQueryParams = toPurposeProcessGetPurposesQueryParams({
        eserviceId: agreement.eserviceId,
        consumerId: agreement.consumerId,
      });

      const purposes = await getAllFromPaginated<purposeApi.Purpose>(
        async (offset, limit) =>
          await purposeProcessClient.getPurposes({
            headers,
            queries: {
              ...getPurposesQueryParams,
              offset,
              limit,
            },
          })
      );

      return { purposes: purposes.map(toApiGatewayPurpose) };
    },
  };
}
