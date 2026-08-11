import {
  DelegatedDescriptorArchivingRequest,
  DelegatedEServiceArchivingRequest,
} from "pagopa-interop-models";

type ArchivingRequest =
  | DelegatedDescriptorArchivingRequest
  | DelegatedEServiceArchivingRequest;

function isActiveArchivingRequest<T extends ArchivingRequest>(
  archivingRequest: T
): boolean {
  return (
    archivingRequest.acceptedAt === undefined &&
    archivingRequest.rejectedAt === undefined
  );
}

export function appendArchivingRequest<T extends ArchivingRequest>(
  previousArchivingRequests: T[] | undefined,
  newArchivingRequest: T
): T[] {
  return [...(previousArchivingRequests ?? []), newArchivingRequest];
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
