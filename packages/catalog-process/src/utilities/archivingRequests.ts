import {
  archivingScope,
  DelegatedArchivingRequest,
  DescriptorId,
  EServiceId,
} from "pagopa-interop-models";
import {
  delegatedArchivingRequestNotActive,
  noDelegatedArchivingRequestFound,
} from "../model/domain/errors.js";
import { calculateArchivableOn } from "./dateCalculator.js";

// All delegated archiving requests (both e-service-wide and per-descriptor)
// live in a single array on EService.delegatedArchivingRequest. The functions
// below always operate on that full array and use `descriptorId` to select
// the relevant scope: when provided, only "Descriptor"-scoped requests for
// that descriptor are considered; when omitted, only "EService"-scoped
// requests are considered.

function matchesScope(
  request: DelegatedArchivingRequest,
  descriptorId?: DescriptorId
): boolean {
  return descriptorId !== undefined
    ? request.scope === archivingScope.descriptor &&
        request.descriptorId === descriptorId
    : request.scope === archivingScope.eservice;
}

function filterByScope(
  archivingRequests: DelegatedArchivingRequest[] | undefined,
  descriptorId?: DescriptorId
): DelegatedArchivingRequest[] {
  return (archivingRequests ?? []).filter((request) =>
    matchesScope(request, descriptorId)
  );
}

function isActiveArchivingRequest(
  archivingRequest: DelegatedArchivingRequest
): boolean {
  return (
    archivingRequest.acceptedAt === undefined &&
    archivingRequest.rejectedAt === undefined
  );
}

export function updateLatestActiveArchivingRequest(
  archivingRequests: DelegatedArchivingRequest[],
  lastRequestUpdates: Partial<
    Omit<
      DelegatedArchivingRequest,
      | "requesterId"
      | "requestedAt"
      | "gracePeriodDays"
      | "archivingReason"
      | "scope"
      | "descriptorId"
    >
  >,
  eserviceId: EServiceId,
  descriptorId?: DescriptorId
): DelegatedArchivingRequest[] {
  const latestActiveArchivingRequest = getLatestActiveArchivingRequest(
    archivingRequests,
    eserviceId,
    descriptorId
  );

  return archivingRequests.map((request) =>
    request === latestActiveArchivingRequest
      ? {
          ...request,
          ...lastRequestUpdates,
        }
      : request
  );
}

export function removeActiveArchivingRequest(
  archivingRequests: DelegatedArchivingRequest[] | undefined,
  descriptorId?: DescriptorId
): DelegatedArchivingRequest[] {
  if (!archivingRequests) {
    return [];
  }
  return archivingRequests.filter(
    (request) =>
      !(
        matchesScope(request, descriptorId) && isActiveArchivingRequest(request)
      )
  );
}

export function appendArchivingRequest(
  previousArchivingRequests: DelegatedArchivingRequest[] | undefined,
  newArchivingRequest: DelegatedArchivingRequest
): DelegatedArchivingRequest[] {
  return [...(previousArchivingRequests ?? []), newArchivingRequest];
}

export function getLatestArchivingRequest(
  archivingRequests: DelegatedArchivingRequest[] | undefined,
  eserviceId: EServiceId,
  descriptorId?: DescriptorId
): DelegatedArchivingRequest {
  const scopedRequests = filterByScope(archivingRequests, descriptorId);
  if (scopedRequests.length === 0) {
    throw noDelegatedArchivingRequestFound(eserviceId, descriptorId);
  }
  return scopedRequests.reduce((latest, current) =>
    current.requestedAt > latest.requestedAt ? current : latest
  );
}

export function getLatestActiveArchivingRequest(
  archivingRequests: DelegatedArchivingRequest[] | undefined,
  eserviceId: EServiceId,
  descriptorId?: DescriptorId
): DelegatedArchivingRequest {
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

export function hasActiveArchivingRequest(
  archivingRequests: DelegatedArchivingRequest[] | undefined,
  descriptorId?: DescriptorId
): boolean {
  return filterByScope(archivingRequests, descriptorId).some(
    isActiveArchivingRequest
  );
}

export function calculateProjectedArchivingDateForArchivingRequest(
  requestDate: Date,
  archivingRequests: DelegatedArchivingRequest[] | undefined,
  eserviceId: EServiceId,
  descriptorId?: DescriptorId
): { archivableOn: Date; gracePeriodDays: number } | undefined {
  if (hasActiveArchivingRequest(archivingRequests, descriptorId)) {
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
