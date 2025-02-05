import {
  TenantId,
  TenantVerifier,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";

export const isVerificationRevoked = (
  verifierId: TenantId,
  attribute: VerifiedTenantAttribute
): boolean =>
  attribute.revokedBy.some((revocation) => revocation.id === verifierId);

export function getVerifiedAttributeExpirationDate(
  verifierId: TenantId,
  attribute: VerifiedTenantAttribute
): Date | undefined {
  const activeProducerVerification: TenantVerifier | undefined =
    attribute.verifiedBy
      .filter((verification) => verification.id === verifierId)
      .sort(
        (a, b) => a.verificationDate.getTime() - b.verificationDate.getTime()
      )
      .find(
        (verification) => !isVerificationRevoked(verification.id, attribute)
      );

  // We assume that if the extensionDate is defined, it is always
  // after the expirationDate, so we return the extensionDate if it's defined
  return (
    activeProducerVerification?.extensionDate ??
    activeProducerVerification?.expirationDate
  );
}
