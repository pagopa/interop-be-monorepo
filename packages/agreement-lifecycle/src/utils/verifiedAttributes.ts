import { TenantId, VerifiedTenantAttribute } from "pagopa-interop-models";

export function getVerifiedAttributeExpirationDate(
  tenantAttribute: VerifiedTenantAttribute,
  verifierId: TenantId
): Date | undefined {
  const activeProducerVerification = tenantAttribute.verifiedBy
    .filter((verification) => verification.id === verifierId)
    .sort((a, b) => a.verificationDate.getTime() - b.verificationDate.getTime())
    .find(
      (verification) =>
        !tenantAttribute.revokedBy.find(
          (revocation) => revocation.id === verification.id
        )
    );

  return (
    activeProducerVerification?.extensionDate ??
    activeProducerVerification?.expirationDate
  );
}
