import { agreementApi, apiGatewayApi } from "pagopa-interop-api-clients";
import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import {
  AgreementProcessClient,
  TenantProcessClient,
} from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { toApiGatewayAgreementIfNotDraft } from "../api/agreementApiConverter.js";
import { producerAndConsumerParamMissing } from "../models/errors.js";
import { toAgreementProcessGetAgreementsQueryParams } from "../api/agreementApiConverter.js";
import {
  certifiedAttributeToAttributeValidityState,
  declaredAttributeToAttributeValidityState,
  verifiedAttributeToAttributeValidityState,
} from "../api/tenantApiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function agreementServiceBuilder(
  agreementProcessClient: AgreementProcessClient,
  tenantProcessClient: TenantProcessClient
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

      // TODO is it correct that in this case we succeed even if the agreement is in draft state?
      // In the other two cases we never return info about draft agreements.
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

      const attributes: apiGatewayApi.Attributes = {
        verified: Array.from(
          new Set(
            agreement.verifiedAttributes.flatMap((attr) =>
              tenant.attributes
                .filter(
                  (a) => a.verified !== undefined && a.verified.id === attr.id
                )
                .map((v) => v.verified!) // TODO fix this usage of non-null assertion
                .map((v: tenantApi.VerifiedTenantAttribute) =>
                  verifiedAttributeToAttributeValidityState(v)
                )
            )
          )
        ),
        certified: Array.from(
          new Set(
            agreement.certifiedAttributes.flatMap((attr) =>
              tenant.attributes
                .filter(
                  (a) => a.certified !== undefined && a.certified.id === attr.id
                )
                .map((c) => c.certified!) // TODO fix this usage of non-null assertion
                .map((c: tenantApi.CertifiedTenantAttribute) =>
                  certifiedAttributeToAttributeValidityState(c)
                )
            )
          )
        ),
        declared: Array.from(
          new Set(
            agreement.declaredAttributes.flatMap((attr) =>
              tenant.attributes
                .filter(
                  (a) => a.declared !== undefined && a.declared.id === attr.id
                )
                .map((d) => d.declared!) // TODO fix this usage of non-null assertion
                .map((d: tenantApi.DeclaredTenantAttribute) =>
                  declaredAttributeToAttributeValidityState(d)
                )
            )
          )
        ),
      };

      return attributes;
    },
  };
}
