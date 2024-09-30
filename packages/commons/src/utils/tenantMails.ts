import { TenantMail, TenantMailKind } from "pagopa-interop-models";

export function getLatestTenantMailOfKind(
  mails: TenantMail[],
  kind: TenantMailKind
): TenantMail | undefined {
  return mails
    .filter((m) => m.kind === kind)
    .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .at(0);
}
