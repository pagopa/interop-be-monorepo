import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PurposeId, PurposeVersionId } from "pagopa-interop-models";
import {
  toGetPurposesApiQueryParams,
  toM2MGatewayApiPurpose,
  toM2mGatewayApiPurposeVersion,
} from "../api/purposeApiConverter.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  pollResource,
  isPolledVersionAtLeastResponseVersion,
} from "../utils/polling.js";
import { purposeVersionNotFound } from "../model/errors.js";
import { assertPurposeVersionExists } from "../utils/validators/purposeValidator.js";

export type PurposeService = ReturnType<typeof purposeServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(clients: PagoPAInteropBeClients) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const pollPurpose = (
    response: WithMaybeMetadata<purposeApi.Purpose>,
    headers: M2MGatewayAppContext["headers"]
  ) =>
    pollResource(() =>
      clients.purposeProcessClient.getPurpose({
        params: { id: response.data.id },
        headers,
      })
    )({
      checkFn: isPolledVersionAtLeastResponseVersion(response),
    });

  const retrievePurposeCurrentVersion = (
    purpose: purposeApi.Purpose
  ): purposeApi.PurposeVersion => {
    const statesToExclude: m2mGatewayApi.PurposeVersionState[] = [
      m2mGatewayApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL,
      m2mGatewayApi.PurposeVersionState.Values.REJECTED,
    ];
    const currentVersion = purpose.versions
      .filter((v) => !statesToExclude.includes(v.state))
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .at(-1);

    assertPurposeVersionExists(currentVersion, purpose.id);

    return currentVersion;
  };

  return {
    async getPurposes(
      queryParams: m2mGatewayApi.GetPurposesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purposes> {
      const { eserviceIds, limit, offset } = queryParams;

      logger.info(
        `Retrieving purposes for eServiceIds ${eserviceIds} limit ${limit} offset ${offset}`
      );

      const queries = toGetPurposesApiQueryParams(queryParams);

      const {
        data: { results, totalCount },
      } = await clients.purposeProcessClient.getPurposes({ queries, headers });

      return {
        results: results.map((purpose) =>
          toM2MGatewayApiPurpose({
            purpose,
            logger,
            mapThrownErrorsToNotFound: true,
          })
        ),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    async getPurpose(
      purposeId: PurposeId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> {
      logger.info(`Retrieving purpose with id ${purposeId}`);

      const { data } = await clients.purposeProcessClient.getPurpose({
        params: {
          id: purposeId,
        },
        headers,
      });

      return toM2MGatewayApiPurpose({
        purpose: data,
        logger,
        mapThrownErrorsToNotFound: true,
      });
    },
    async createPurpose(
      purposeSeed: m2mGatewayApi.PurposeSeed,
      { logger, headers, authData }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> {
      logger.info(
        `Creating purpose for e-service ${purposeSeed.eserviceId} and consumer ${authData.organizationId}`
      );

      const purposeResponse = await clients.purposeProcessClient.createPurpose(
        {
          ...purposeSeed,
          consumerId: authData.organizationId,
        },
        { headers }
      );

      const polledResource = await pollPurpose(purposeResponse, headers);

      return toM2MGatewayApiPurpose({
        purpose: polledResource.data,
        logger,
      });
    },
    getPurposeVersions: async (
      purposeId: PurposeId,
      queryParams: m2mGatewayApi.GetPurposeVersionsQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeVersions> => {
      logger.info(`Retrieving versions for purpose ${purposeId}`);

      const { state, limit, offset } = queryParams;

      const { data } = await clients.purposeProcessClient.getPurpose({
        params: {
          id: purposeId,
        },
        headers,
      });

      const versions = state
        ? data.versions.filter((version) => version.state === state)
        : data.versions;

      const paginatedVersions = versions.slice(offset, offset + limit);

      return {
        results: paginatedVersions.map(toM2mGatewayApiPurposeVersion),
        pagination: {
          limit,
          offset,
          totalCount: versions.length,
        },
      };
    },
    async getPurposeVersion(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeVersion> {
      logger.info(`Retrieving version ${versionId} of purpose ${purposeId}`);

      const { data } = await clients.purposeProcessClient.getPurpose({
        params: {
          id: purposeId,
        },
        headers,
      });

      const version = data.versions.find((version) => version.id === versionId);

      if (!version) {
        throw purposeVersionNotFound(purposeId, versionId);
      }

      return toM2mGatewayApiPurposeVersion(version);
    },
    async createPurposeVersion(
      purposeId: PurposeId,
      versionSeed: m2mGatewayApi.PurposeVersionSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeVersion> {
      logger.info(
        `Creating version for purpose ${purposeId} with dailyCalls ${versionSeed.dailyCalls}`
      );

      const {
        data: { createdVersionId, purpose },
        metadata,
      } = await clients.purposeProcessClient.createPurposeVersion(versionSeed, {
        params: { purposeId },
        headers,
      });

      await pollPurpose(
        {
          data: purpose,
          metadata,
        },
        headers
      );

      const createdVersion = purpose.versions.find(
        (v) => v.id === createdVersionId
      );

      if (!createdVersion) {
        throw purposeVersionNotFound(purposeId, createdVersionId);
      }

      return toM2mGatewayApiPurposeVersion(createdVersion);
    },
    async activatePurpose(
      purposeId: PurposeId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Retrieveing current version for purpose ${purposeId} activation`
      );
      const purposeResponse = await clients.purposeProcessClient.getPurpose({
        params: {
          id: purposeId,
        },
        headers,
      });

      const versionToActivate = retrievePurposeCurrentVersion(
        purposeResponse.data
      );

      logger.info(
        `Activating version ${versionToActivate.id} of purpose ${purposeId}`
      );

      const {
        data: { purpose },
        metadata,
      } = await clients.purposeProcessClient.activatePurposeVersion(undefined, {
        params: { purposeId, versionId: versionToActivate.id },
        headers,
      });

      await pollPurpose(
        {
          data: purpose,
          metadata,
        },
        headers
      );
    },
    async archivePurpose(
      purposeId: PurposeId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Retrieveing current version for purpose ${purposeId} archiving`
      );
      const purposeResponse = await clients.purposeProcessClient.getPurpose({
        params: {
          id: purposeId,
        },
        headers,
      });

      const versionToArchive = retrievePurposeCurrentVersion(
        purposeResponse.data
      );

      logger.info(
        `Archiving version ${versionToArchive.id} of purpose ${purposeId}`
      );

      const {
        data: { purpose },
        metadata,
      } = await clients.purposeProcessClient.archivePurposeVersion(undefined, {
        params: { purposeId, versionId: versionToArchive.id },
        headers,
      });

      await pollPurpose(
        {
          data: purpose,
          metadata,
        },
        headers
      );
    },
    suspendPurposeVersion: async (
      { logger, headers }: WithLogger<M2MGatewayAppContext>,
      purposeId: PurposeId,
      versionId: PurposeVersionId
    ): Promise<void> => {
      logger.info(`Suspending version ${versionId} of purpose ${purposeId}`);

      const versionResponse = await purposeProcessClient.suspendPurposeVersion(
        undefined,
        { params: { purposeId, versionId }, headers }
      );

      await pollPurposeVersion(purposeId, versionResponse, headers);
    },
  };
}
