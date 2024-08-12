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
import {
  assertIsEserviceProducer,
  assertOnlyOneAgreementForEserviceAndConsumerExists,
} from "./validators.js";
import { getAgreements } from "./agreementService.js";

export async function getPurposes(
  purposeProcessClient: PurposeProcessClient,
  headers: ApiGatewayAppContext["headers"],
  { eserviceId, consumerId }: apiGatewayApi.GetPurposesQueryParams
): Promise<apiGatewayApi.Purposes> {
  const getPurposesQueryParams = toPurposeProcessGetPurposesQueryParams({
    eserviceId,
    consumerId,
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
}

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

      const purpose = await purposeProcessClient.getPurpose({
        headers,
        params: {
          id: purposeId,
        },
      });

      if (purpose.consumerId !== organizationId) {
        const eservice = await catalogProcessClient.getEServiceById({
          headers,
          params: {
            eServiceId: purpose.eserviceId,
          },
        });

        assertIsEserviceProducer(eservice, organizationId);
      }

      return toApiGatewayPurpose(purpose);
    },

    getPurposes: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      { eserviceId, consumerId }: apiGatewayApi.GetPurposesQueryParams
    ): Promise<apiGatewayApi.Purposes> => {
      logger.info(
        `Retrieving Purposes for eservice ${eserviceId} and consumer ${consumerId}"`
      );
      return await getPurposes(purposeProcessClient, headers, {
        eserviceId,
        consumerId,
      });
    },

    getAgreementByPurpose: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      purposeId: purposeApi.Purpose["id"]
    ): Promise<apiGatewayApi.Agreement> => {
      logger.info(`Retrieving agreement by purpose ${purposeId}`);
      const purpose = await purposeProcessClient.getPurpose({
        headers,
        params: {
          id: purposeId,
        },
      });

      const { agreements } = await getAgreements(
        agreementProcessClient,
        headers,
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

      // TODO Doubt:
      // in this case we succeed and return the agreement even if the purpose has no active version - this is what Scala does as well.
      // Is it correct? In getPurpose and getPurposes we don't allow purposes without active versions to be returned.
      // If we decide do the same here, we should remember to update the error mapper in the router.
      return agreements[0];
    },
  };
}
