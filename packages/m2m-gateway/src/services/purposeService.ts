import { basename } from "path";
import { m2mGatewayApi, purposeApi } from "pagopa-interop-api-clients";
import {
  FileManager,
  M2MAdminAuthData,
  WithLogger,
} from "pagopa-interop-commons";
import {
  PurposeId,
  PurposeVersionId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  toGetAgreementsApiQueryParamsForPurpose,
  toGetPurposesApiQueryParams,
  toM2MGatewayApiPurpose,
  toM2mGatewayApiPurposeVersion,
} from "../api/purposeApiConverter.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  pollResourceWithMetadata,
  isPolledVersionAtLeastResponseVersion,
  isPolledVersionAtLeastMetadataTargetVersion,
  pollResourceUntilDeletion,
} from "../utils/polling.js";
import {
  purposeAgreementNotFound,
  purposeNotFound,
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
} from "../model/errors.js";
import {
  assertPurposeCurrentVersionExists,
  assertPurposeVersionExistsWithState,
  assertSeedPatchPurposeUpdateFromTemplateContent,
} from "../utils/validators/purposeValidator.js";
import { toM2MGatewayApiAgreement } from "../api/agreementApiConverter.js";
import { downloadDocument, DownloadedDocument } from "../utils/fileDownload.js";
import { config } from "../config/config.js";
import { assertRequesterIsDelegateConsumerForEservice } from "../utils/validators/delegationValidators.js";

export type PurposeService = ReturnType<typeof purposeServiceBuilder>;

export const sortPurposeVersionsByDate = (
  versions: purposeApi.PurposeVersion[]
): purposeApi.PurposeVersion[] =>
  [...versions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

export const getPurposeCurrentVersion = (
  purpose: purposeApi.Purpose
): purposeApi.PurposeVersion | undefined => {
  const statesToExclude: purposeApi.PurposeVersionState[] = [
    purposeApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL,
    purposeApi.PurposeVersionState.Values.REJECTED,
  ];
  return sortPurposeVersionsByDate(purpose.versions)
    .filter((v) => !statesToExclude.includes(v.state))
    .at(-1);
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeServiceBuilder(
  clients: PagoPAInteropBeClients,
  fileManager: FileManager
) {
  const retrievePurposeById = async (
    purposeId: PurposeId,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<purposeApi.Purpose>> =>
    await clients.purposeProcessClient.getPurpose({
      params: {
        id: purposeId,
      },
      headers,
    });

  const pollPurpose = (
    response: WithMaybeMetadata<purposeApi.Purpose>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<purposeApi.Purpose>> =>
    pollResourceWithMetadata(() =>
      retrievePurposeById(unsafeBrandId(response.data.id), headers)
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  const pollPurposeUntilDeletion = (
    purposeId: string,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<void> =>
    pollResourceUntilDeletion(() =>
      retrievePurposeById(unsafeBrandId(purposeId), headers)
    )({});

  const pollPurposeById = (
    purposeId: PurposeId,
    metadata: { version: number } | undefined,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<purposeApi.Purpose>> =>
    pollResourceWithMetadata(() => retrievePurposeById(purposeId, headers))({
      condition: isPolledVersionAtLeastMetadataTargetVersion(metadata),
    });

  const retrievePurpose = async (
    purposeId: PurposeId,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<purposeApi.Purpose> => {
    const purpose = await retrievePurposeById(purposeId, headers);

    if (!purpose.data) {
      throw purposeNotFound(purposeId);
    }

    return purpose.data;
  };

  const retrieveLatestPurposeVersionByState = (
    purpose: purposeApi.Purpose,
    state: purposeApi.PurposeVersionState
  ): purposeApi.PurposeVersion => {
    const latestVersion = sortPurposeVersionsByDate(purpose.versions)
      .filter((v) => v.state === state)
      .at(-1);

    assertPurposeVersionExistsWithState(latestVersion, purpose.id, state);

    return latestVersion;
  };

  const retrievePurposeCurrentVersion = (
    purpose: purposeApi.Purpose
  ): purposeApi.PurposeVersion => {
    const currentVersion = getPurposeCurrentVersion(purpose);

    assertPurposeCurrentVersionExists(currentVersion, purpose.id);

    return currentVersion;
  };

  const getConsumerIdForPurposeCreation = async (
    purposeSeed: m2mGatewayApi.PurposeSeed | m2mGatewayApi.ReversePurposeSeed,
    authData: M2MAdminAuthData,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<TenantId> => {
    if (!purposeSeed.delegationId) {
      return authData.organizationId;
    } else {
      const delegation = (
        await clients.delegationProcessClient.delegation.getDelegation({
          params: {
            delegationId: purposeSeed.delegationId,
          },
          headers,
        })
      ).data;

      assertRequesterIsDelegateConsumerForEservice(
        authData,
        purposeSeed.eserviceId,
        delegation
      );
      return unsafeBrandId<TenantId>(delegation.delegatorId);
    }
  };

  const innerUpdateDraftPurpose = async (
    purposeId: PurposeId,
    updateSeed: m2mGatewayApi.PurposeDraftUpdateSeed,
    purpose: purposeApi.Purpose,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<purposeApi.Purpose>> => {
    if (purpose.purposeTemplateId) {
      assertSeedPatchPurposeUpdateFromTemplateContent(updateSeed);

      return clients.purposeProcessClient.patchUpdatePurposeFromTemplate(
        updateSeed,
        {
          params: {
            purposeId,
            purposeTemplateId: purpose.purposeTemplateId,
          },
          headers,
        }
      );
    }

    return await clients.purposeProcessClient.patchUpdatePurpose(updateSeed, {
      params: { id: purposeId },
      headers,
    });
  };

  return {
    async getPurposes(
      queryParams: m2mGatewayApi.GetPurposesQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purposes> {
      const { eserviceIds, title, consumerIds, states, limit, offset } =
        queryParams;

      logger.info(
        `Retrieving purposes for eServiceIds ${eserviceIds}, title ${title}, consumerIds ${consumerIds}, states ${states}, limit ${limit} offset ${offset}`
      );

      const queries = toGetPurposesApiQueryParams(queryParams);

      const {
        data: { results, totalCount },
      } = await clients.purposeProcessClient.getPurposes({ queries, headers });

      return {
        results: results.map(toM2MGatewayApiPurpose),
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

      const { data } = await retrievePurposeById(purposeId, headers);

      return toM2MGatewayApiPurpose(data);
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
          consumerId: await getConsumerIdForPurposeCreation(
            purposeSeed,
            authData,
            headers
          ),
          eserviceId: purposeSeed.eserviceId,
          dailyCalls: purposeSeed.dailyCalls,
          description: purposeSeed.description,
          isFreeOfCharge: purposeSeed.isFreeOfCharge,
          riskAnalysisForm: purposeSeed.riskAnalysisForm,
          title: purposeSeed.title,
          freeOfChargeReason: purposeSeed.freeOfChargeReason,
        },
        { headers }
      );

      const polledResource = await pollPurpose(purposeResponse, headers);

      return toM2MGatewayApiPurpose(polledResource.data);
    },
    async getPurposeVersions(
      purposeId: PurposeId,
      { limit, offset, state }: m2mGatewayApi.GetPurposeVersionsQueryParams,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeVersions> {
      logger.info(
        `Retrieving versions for purpose with id ${purposeId} state ${state} offset ${offset} limit ${limit}`
      );

      const { data } = await retrievePurposeById(purposeId, headers);

      const filteredVersions = state
        ? data.versions.filter((version) => version.state === state)
        : data.versions;

      const paginatedVersions = filteredVersions.slice(offset, offset + limit);

      return {
        results: paginatedVersions.map(toM2mGatewayApiPurposeVersion),
        pagination: {
          limit,
          offset,
          totalCount: filteredVersions.length,
        },
      };
    },
    async getPurposeVersion(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.PurposeVersion> {
      logger.info(`Retrieving version ${versionId} of purpose ${purposeId}`);

      const { data } = await retrievePurposeById(purposeId, headers);

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
    async activateDraftPurpose(
      purposeId: PurposeId,
      { delegationId }: m2mGatewayApi.DelegationRef,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> {
      logger.info(
        `Retrieving latest draft version for purpose ${purposeId} activation`
      );
      const { data: purpose } = await retrievePurposeById(purposeId, headers);

      const versionToActivate = retrieveLatestPurposeVersionByState(
        purpose,
        purposeApi.PurposeVersionState.Values.DRAFT
      );

      logger.info(
        `Activating version ${versionToActivate.id} of purpose ${purposeId}`
      );

      const { metadata } =
        await clients.purposeProcessClient.activatePurposeVersion(
          { delegationId },
          {
            params: { purposeId, versionId: versionToActivate.id },
            headers,
          }
        );

      const polledPurpose = await pollPurposeById(purposeId, metadata, headers);
      return toM2MGatewayApiPurpose(polledPurpose.data);
    },
    async archivePurpose(
      purposeId: PurposeId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> {
      logger.info(
        `Retrieving current version for purpose ${purposeId} archiving`
      );
      const { data: purpose } = await retrievePurposeById(purposeId, headers);

      const versionToArchive = retrievePurposeCurrentVersion(purpose);

      logger.info(
        `Archiving version ${versionToArchive.id} of purpose ${purposeId}`
      );

      const { metadata } =
        await clients.purposeProcessClient.archivePurposeVersion(undefined, {
          params: { purposeId, versionId: versionToArchive.id },
          headers,
        });

      const polledPurpose = await pollPurposeById(purposeId, metadata, headers);
      return toM2MGatewayApiPurpose(polledPurpose.data);
    },
    async suspendPurpose(
      purposeId: PurposeId,
      { delegationId }: m2mGatewayApi.DelegationRef,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> {
      logger.info(
        `Retrieving current version for purpose ${purposeId} suspension`
      );
      const { data: purpose } = await retrievePurposeById(purposeId, headers);

      const versionToSuspend = retrievePurposeCurrentVersion(purpose);

      logger.info(
        `Suspending version ${versionToSuspend.id} of purpose ${purposeId}`
      );

      const { metadata } =
        await clients.purposeProcessClient.suspendPurposeVersion(
          { delegationId },
          {
            params: { purposeId, versionId: versionToSuspend.id },
            headers,
          }
        );

      const polledPurpose = await pollPurposeById(purposeId, metadata, headers);
      return toM2MGatewayApiPurpose(polledPurpose.data);
    },
    async approvePurpose(
      purposeId: PurposeId,
      { delegationId }: m2mGatewayApi.DelegationRef,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> {
      logger.info(
        `Retrieving latest waiting for approval version for purpose ${purposeId} approval`
      );
      const { data: purpose } = await retrievePurposeById(purposeId, headers);

      const versionToApprove = retrieveLatestPurposeVersionByState(
        purpose,
        purposeApi.PurposeVersionState.Values.WAITING_FOR_APPROVAL
      );

      logger.info(
        `Approving (activating) version ${versionToApprove.id} of purpose ${purposeId}`
      );

      const { metadata } =
        await clients.purposeProcessClient.activatePurposeVersion(
          { delegationId },
          {
            params: { purposeId, versionId: versionToApprove.id },
            headers,
          }
        );

      const polledPurpose = await pollPurposeById(purposeId, metadata, headers);
      return toM2MGatewayApiPurpose(polledPurpose.data);
    },
    async unsuspendPurpose(
      purposeId: PurposeId,
      { delegationId }: m2mGatewayApi.DelegationRef,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> {
      logger.info(
        `Retrieving latest suspended version for purpose ${purposeId} unsuspension`
      );
      const { data: purpose } = await retrievePurposeById(purposeId, headers);

      const versionToApprove = retrieveLatestPurposeVersionByState(
        purpose,
        purposeApi.PurposeVersionState.Values.SUSPENDED
      );

      logger.info(
        `Unsuspending (activating) version ${versionToApprove.id} of purpose ${purposeId}`
      );

      const { metadata } =
        await clients.purposeProcessClient.activatePurposeVersion(
          { delegationId },
          {
            params: { purposeId, versionId: versionToApprove.id },
            headers,
          }
        );

      const polledPurpose = await pollPurposeById(purposeId, metadata, headers);
      return toM2MGatewayApiPurpose(polledPurpose.data);
    },
    async deletePurpose(
      purposeId: PurposeId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(`Deleting purpose with id ${purposeId}`);

      await clients.purposeProcessClient.deletePurpose(undefined, {
        params: { id: purposeId },
        headers,
      });

      await pollPurposeUntilDeletion(purposeId, headers);
    },
    async deletePurposeVersion(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(`Deleting version ${versionId} of purpose ${purposeId}`);

      const { metadata } =
        await clients.purposeProcessClient.deletePurposeVersion(undefined, {
          params: { purposeId, versionId },
          headers,
        });

      await pollPurposeById(purposeId, metadata, headers);
    },
    async createReversePurpose(
      purposeSeed: m2mGatewayApi.ReversePurposeSeed,
      { logger, headers, authData }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> {
      logger.info(
        `Creating reverse purpose for e-service ${purposeSeed.eserviceId}`
      );

      const purposeResponse =
        await clients.purposeProcessClient.createPurposeFromEService(
          {
            consumerId: await getConsumerIdForPurposeCreation(
              purposeSeed,
              authData,
              headers
            ),
            eserviceId: purposeSeed.eserviceId,
            dailyCalls: purposeSeed.dailyCalls,
            description: purposeSeed.description,
            isFreeOfCharge: purposeSeed.isFreeOfCharge,
            riskAnalysisId: purposeSeed.riskAnalysisId,
            title: purposeSeed.title,
            freeOfChargeReason: purposeSeed.freeOfChargeReason,
          },
          {
            headers,
          }
        );

      const polledResource = await pollPurpose(purposeResponse, headers);

      return toM2MGatewayApiPurpose(polledResource.data);
    },
    async downloadPurposeVersionRiskAnalysisDocument(
      purposeId: PurposeId,
      versionId: PurposeVersionId,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<DownloadedDocument> {
      logger.info(
        `Retrieving document for version ${versionId} of purpose ${purposeId}`
      );

      const { data: purpose } = await retrievePurposeById(purposeId, headers);

      const version = purpose.versions.find(
        (version) => version.id === versionId
      );

      if (!version) {
        throw purposeVersionNotFound(purposeId, versionId);
      }

      if (!version.riskAnalysis) {
        throw purposeVersionDocumentNotFound(purposeId, versionId);
      }

      const name = basename(version.riskAnalysis.path);

      return downloadDocument(
        { ...version.riskAnalysis, name },
        fileManager,
        config.riskAnalysisDocumentsContainer,
        logger
      );
    },
    async getPurposeAgreement(
      purposeId: PurposeId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Agreement> {
      logger.info(`Retrieving agreement for purpose with id ${purposeId}`);

      const { data: purpose } = await retrievePurposeById(purposeId, headers);

      const { data: agreements } =
        await clients.agreementProcessClient.getAgreements({
          queries: toGetAgreementsApiQueryParamsForPurpose(purpose),
          headers,
        });

      const agreement = agreements.results.at(0);

      if (!agreement) {
        throw purposeAgreementNotFound(purposeId);
      }

      return toM2MGatewayApiAgreement(agreement, purpose.delegationId);
    },
    async updateDraftPurpose(
      purposeId: PurposeId,
      updateSeed:
        | m2mGatewayApi.PurposeDraftUpdateSeed
        | m2mGatewayApi.PurposeDraftFromTemplateUpdateSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> {
      logger.info(`Updating draft purpose with id ${purposeId}`);

      const purpose = await retrievePurpose(purposeId, headers);

      const updatedPurpose = await innerUpdateDraftPurpose(
        purposeId,
        updateSeed,
        purpose,
        headers
      );

      const polledResource = await pollPurpose(updatedPurpose, headers);

      return toM2MGatewayApiPurpose(polledResource.data);
    },
    async updateDraftReversePurpose(
      purposeId: PurposeId,
      updateSeed: m2mGatewayApi.ReversePurposeDraftUpdateSeed,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.Purpose> {
      logger.info(`Updating draft reverse purpose with id ${purposeId}`);

      const updatedPurpose =
        await clients.purposeProcessClient.patchUpdateReversePurpose(
          updateSeed,
          {
            params: { id: purposeId },
            headers,
          }
        );

      const polledResource = await pollPurpose(updatedPurpose, headers);

      return toM2MGatewayApiPurpose(polledResource.data);
    },
  };
}
