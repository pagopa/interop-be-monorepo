import { InteropHeaders, Logger } from "pagopa-interop-commons";
import {
  Delegation,
  Descriptor,
  DescriptorId,
  EService,
  genericInternalError,
} from "pagopa-interop-models";
import {
  CatalogProcessClient,
  ArchiveDelegatedArchivingRequestSeed,
} from "./catalogProcessClient.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export const ARCHIVING_REQUEST_REJECTION_REASON =
  "Request closed automatically by system";

const hasPendingDelegatedArchivingRequest = (
  requests:
    | EService["delegatedArchivingRequest"]
    | Descriptor["delegatedArchivingRequest"]
): boolean =>
  (requests ?? []).some(
    (request) =>
      request.acceptedAt === undefined && request.rejectedAt === undefined
  );

const getDescriptorById = (
  eservice: EService,
  descriptorId: DescriptorId
): Descriptor => {
  const descriptor = eservice.descriptors.find((d) => d.id === descriptorId);

  if (!descriptor) {
    throw genericInternalError(
      `Descriptor ${descriptorId} not found in EService ${eservice.id}`
    );
  }

  return descriptor;
};

const buildSeed = (
  triggerEvent: string,
  options?: {
    descriptorId?: DescriptorId;
    delegationId?: Delegation["id"];
  }
): ArchiveDelegatedArchivingRequestSeed => ({
  reason: ARCHIVING_REQUEST_REJECTION_REASON,
  triggerEvent,
  ...(options?.descriptorId ? { descriptorId: options.descriptorId } : {}),
  ...(options?.delegationId ? { delegationId: options.delegationId } : {}),
});

export const shouldArchiveDelegatedArchivingRequestForDescriptorArchivedEvent =
  (eservice: EService, descriptorId: DescriptorId): boolean => {
    const descriptor = getDescriptorById(eservice, descriptorId);

    return (
      hasPendingDelegatedArchivingRequest(eservice.delegatedArchivingRequest) ||
      hasPendingDelegatedArchivingRequest(descriptor.delegatedArchivingRequest)
    );
  };

export async function processDescriptorArchivedEvent({
  eservice,
  descriptorId,
  catalogProcessClient,
  headers,
  logger,
}: {
  eservice: EService;
  descriptorId: DescriptorId;
  catalogProcessClient: CatalogProcessClient;
  headers: InteropHeaders;
  logger: Logger;
}): Promise<void> {
  if (
    !shouldArchiveDelegatedArchivingRequestForDescriptorArchivedEvent(
      eservice,
      descriptorId
    )
  ) {
    logger.info(
      `Skipping delegated archiving request archive for descriptor ${descriptorId} of EService ${eservice.id}: no pending request found`
    );
    return;
  }

  await catalogProcessClient.archiveDelegatedArchivingRequest({
    eServiceId: eservice.id,
    seed: buildSeed("EServiceDescriptorArchived", {
      descriptorId,
    }),
    headers,
  });

  logger.info(
    `Delegated archiving request archived after descriptor archived event for descriptor ${descriptorId} of EService ${eservice.id}`
  );
}

export async function processDelegationRevokedEvent({
  delegation,
  readModelService,
  catalogProcessClient,
  headers,
  logger,
}: {
  delegation: Delegation;
  readModelService: ReadModelServiceSQL;
  catalogProcessClient: CatalogProcessClient;
  headers: InteropHeaders;
  logger: Logger;
}): Promise<void> {
  const eservice = await readModelService.getEServiceById(
    delegation.eserviceId
  );

  if (!eservice) {
    throw genericInternalError(
      `EService ${delegation.eserviceId} not found while processing delegation revocation ${delegation.id}`
    );
  }

  const pendingDescriptorIds = eservice.descriptors
    .filter((descriptor) =>
      hasPendingDelegatedArchivingRequest(descriptor.delegatedArchivingRequest)
    )
    .map((descriptor) => descriptor.id);

  const hasPendingEServiceArchivingRequest =
    hasPendingDelegatedArchivingRequest(eservice.delegatedArchivingRequest);

  if (
    !hasPendingEServiceArchivingRequest &&
    pendingDescriptorIds.length === 0
  ) {
    logger.info(
      `Skipping delegation revocation ${delegation.id}: no pending delegated archiving request found on EService ${eservice.id}`
    );
    return;
  }

  const archiveRequests: Promise<void>[] = [];

  if (hasPendingEServiceArchivingRequest) {
    archiveRequests.push(
      catalogProcessClient.archiveDelegatedArchivingRequest({
        eServiceId: eservice.id,
        seed: buildSeed(delegation.kind + "DelegationRevoked", {
          delegationId: delegation.id,
        }),
        headers,
      })
    );
  }

  archiveRequests.push(
    ...pendingDescriptorIds.map((descriptorId) =>
      catalogProcessClient.archiveDelegatedArchivingRequest({
        eServiceId: eservice.id,
        seed: buildSeed(delegation.kind + "DelegationRevoked", {
          descriptorId,
          delegationId: delegation.id,
        }),
        headers,
      })
    )
  );

  await Promise.all(archiveRequests);

  logger.info(
    `Archived ${archiveRequests.length} delegated archiving request(s) after delegation revocation ${delegation.id} for EService ${eservice.id}`
  );
}
