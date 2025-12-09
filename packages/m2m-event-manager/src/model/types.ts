import { DelegationId, unsafeBrandId } from "pagopa-interop-models";

export type DelegationIdParam = DelegationId | null | undefined;

export function unsafeBrandDelegationIdParam(
  delegationId: string | null | undefined
): DelegationIdParam {
  return delegationId
    ? unsafeBrandId<DelegationId>(delegationId)
    : delegationId === null
    ? null
    : undefined;
}
