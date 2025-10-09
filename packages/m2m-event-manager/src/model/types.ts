import { m2mEventApi } from "pagopa-interop-api-clients";
import { DelegationId, unsafeBrandId } from "pagopa-interop-models";

export type DelegationIdParam = DelegationId | null | undefined;

export function unsafeBrandDelegationIdParam(
  delegationId: m2mEventApi.delegationId
): DelegationIdParam {
  return delegationId
    ? unsafeBrandId<DelegationId>(delegationId)
    : delegationId === null
    ? null
    : undefined;
}
