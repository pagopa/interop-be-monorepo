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
import { calculateArchivableOn } from "./dateCalculator.js";

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

function isNotActiveArchivingRequest<T extends ArchivingRequest>(
  archivingRequest: T
): boolean {
  return !isActiveArchivingRequest(archivingRequest);
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

export function removeActiveArchivingRequest<T extends ArchivingRequest>(
  archivingRequests: T[] | undefined
): T[] {
  if (!archivingRequests) {
    return [];
  }
  return archivingRequests.filter(isNotActiveArchivingRequest);
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

export function calculateProjectedArchivingDateForArchivingRequest<
  T extends ArchivingRequest,
>(
  requestDate: Date,
  archivingRequests: T[] | undefined,
  eserviceId: EServiceId,
  descriptorId?: DescriptorId
): { archivableOn: Date; gracePeriodDays: number } | undefined {
  if (
    archivingRequests &&
    archivingRequests.length > 0 &&
    hasActiveArchivingRequest(archivingRequests)
  ) {
    const latestActiveRequest = getLatestActiveArchivingRequest(
      archivingRequests,
      eserviceId,
      descriptorId
    );
    const archivableOn = calculateArchivableOn(
      requestDate,
      latestActiveRequest.gracePeriodDays
    ).archivableOn;
    return {
      archivableOn,
      gracePeriodDays: latestActiveRequest.gracePeriodDays,
    };
  }
  return undefined;
}
