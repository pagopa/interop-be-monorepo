import {
  DelegatedDescriptorArchivingRequest,
  DelegatedEServiceArchivingRequest,
  DescriptorId,
  EServiceId,
} from "pagopa-interop-models";
import {
  delegatedArchivingRequestNotActive,
  noDelegatedArchivingRequestFound,
} from "../model/domain/errors.js";

type ArchivingRequest =
  | DelegatedDescriptorArchivingRequest
  | DelegatedEServiceArchivingRequest;

function isActiveArchivingRequest<T extends ArchivingRequest>(
  archivingRequest: T
): boolean {
  return (
    archivingRequest.acceptedAt !== undefined ||
    archivingRequest.rejectedAt !== undefined
  );
}

export function updateLatestActiveArchivingRequest<T extends ArchivingRequest>(
  archivingRequests: T[],
  lastRequestUpdates: Partial<
    Omit<
      T,
      "requesterId" | "requestedAt" | "gracePeriodDays" | "archivingReason"
    >
  >,
  eserviceId: EServiceId,
  descriptorId?: DescriptorId
): T[] {
  const latestActiveArchivingRequest = getLatestActiveArchivingRequest(
    archivingRequests,
    eserviceId,
    descriptorId
  );

  const updatedRequests = archivingRequests.map((request) =>
    request === latestActiveArchivingRequest
      ? {
          ...request,
          ...lastRequestUpdates,
        }
      : request
  );

  return updatedRequests;
}

export function appendArchivingRequest<T extends ArchivingRequest>(
  previousArchivingRequests: T[] | undefined,
  newArchivingRequest: T
): T[] {
  return [...(previousArchivingRequests ?? []), newArchivingRequest];
}

export function getLatestArchivingRequest<T extends ArchivingRequest>(
  archivingRequests: T[] | undefined,
  eserviceId: EServiceId,
  descriptorId?: DescriptorId
): T {
  if (!archivingRequests) {
    throw noDelegatedArchivingRequestFound(eserviceId, descriptorId);
  }
  const latestRequest = archivingRequests.reduce((latest, current) =>
    current.requestedAt > latest.requestedAt ? current : latest
  );
  return latestRequest;
}

export function getLatestActiveArchivingRequest<T extends ArchivingRequest>(
  archivingRequests: T[] | undefined,
  eserviceId: EServiceId,
  descriptorId?: DescriptorId
): T {
  const latestArchivingRequest = getLatestArchivingRequest(
    archivingRequests,
    eserviceId,
    descriptorId
  );
  if (!isActiveArchivingRequest(latestArchivingRequest)) {
    throw delegatedArchivingRequestNotActive(eserviceId, descriptorId);
  }
  return latestArchivingRequest;
}

export function hasActiveArchivingRequest<T extends ArchivingRequest>(
  archivingRequests: T[] | undefined
): boolean {
  if (!archivingRequests) {
    return false;
  }
  const activeArchivingRequests = archivingRequests.filter(
    isActiveArchivingRequest
  );
  return activeArchivingRequests.length > 0;
}
