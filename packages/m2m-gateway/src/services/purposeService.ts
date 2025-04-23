import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PurposeId } from "pagopa-interop-models";
import {
  toM2MPurpose,
  toM2MPurposeVersion,
} from "../api/purposeApiConverter.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  pollResource,
  isPolledVersionAtLeastResponseVersion,
} from "../utils/polling.js";
import { purposeVersionNotFound } from "../model/errors.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder({
  purposeProcessClient,
}: PagoPAInteropBeClients) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const pollPurpose = (
    response: WithMaybeMetadata<purposeApi.Purpose>,
    headers: M2MGatewayAppContext["headers"]
  ) =>
    pollResource(() =>
      purposeProcessClient.getPurpose({
        params: { id: response.data.id },
        headers,
      })
    )({
      checkFn: isPolledVersionAtLeastResponseVersion(response),
    });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const pollPurposeVersion = (
    purposeId: PurposeId,
    newVersion: WithMaybeMetadata<purposeApi.PurposeVersion>,
    headers: M2MGatewayAppContext["headers"]
  ) =>
    pollResource(() =>
      purposeProcessClient.getPurpose({
        params: { id: purposeId },
        headers,
      })
    )({
      checkFn: (polledPurpose) =>
        polledPurpose.data.versions.some(
          (version) => version.id === newVersion.data.id
        ),
    });

  return {
    getPurposes: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      queryParams: m2mGatewayApi.GetPurposesQueryParams
    ): Promise<m2mGatewayApi.Purposes> => {
      const { eserviceIds, limit, offset } = queryParams;

      logger.info(
        `Retrieving purposes for eServiceIds ${eserviceIds} limit ${limit} offset ${offset}`
      );

      const {
        data: { results, totalCount },
      } = await purposeProcessClient.getPurposes({
        queries: {
          eservicesIds: eserviceIds,
          limit,
          offset,
        },
        headers,
      });

      return {
        results: results.map(toM2MPurpose),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    getPurpose: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      purposeId: PurposeId
    ): Promise<m2mGatewayApi.Purpose> => {
      logger.info(`Retrieving purpose with id ${purposeId}`);

      const { data } = await purposeProcessClient.getPurpose({
        params: {
          id: purposeId,
        },
        headers,
      });

      return toM2MPurpose(data);
    },
    createPurpose: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      purposeSeed: m2mGatewayApi.PurposeSeed
    ): Promise<m2mGatewayApi.Purpose> => {
      logger.info(`Creating purpose`);

      const purposeResponse = await purposeProcessClient.createPurpose(
        purposeSeed,
        {
          headers,
        }
      );

      const polledResource = await pollPurpose(purposeResponse, headers);

      return toM2MPurpose(polledResource.data);
    },
    getPurposeVersion: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      purposeId: PurposeId,
      versionId: string
    ): Promise<m2mGatewayApi.PurposeVersion> => {
      logger.info(`Retrieving version ${versionId} of purpose ${purposeId}`);

      const { data } = await purposeProcessClient.getPurpose({
        params: {
          id: purposeId,
        },
        headers,
      });

      const version = data.versions.find((version) => version.id === versionId);

      if (!version) {
        throw purposeVersionNotFound(purposeId, versionId);
      }

      return version;
    },
    createPurposeVersion: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      purposeId: PurposeId,
      versionSeed: m2mGatewayApi.PurposeVersionSeed
    ): Promise<m2mGatewayApi.PurposeVersion> => {
      logger.info(`Creating purpose version`);

      const versionResponse = await purposeProcessClient.createPurposeVersion(
        versionSeed,
        { params: { purposeId }, headers }
      );

      const polledPurpose = await pollPurposeVersion(
        purposeId,
        versionResponse,
        headers
      );

      const createdVersion = polledPurpose.data.versions.find(
        (version) => version.id === versionResponse.data.id
      );

      if (!createdVersion) {
        throw purposeVersionNotFound(purposeId, versionResponse.data.id);
      }

      return toM2MPurposeVersion(createdVersion);
    },
  };
}
