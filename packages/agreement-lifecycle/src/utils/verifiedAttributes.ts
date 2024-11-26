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

  if (!activeProducerVerification) {
    return undefined;
  }

  if (
    activeProducerVerification.extensionDate &&
    activeProducerVerification.expirationDate
  ) {
    return activeProducerVerification.extensionDate >=
      activeProducerVerification.expirationDate
      ? activeProducerVerification.extensionDate
      : activeProducerVerification.expirationDate;
  }

  return (
    activeProducerVerification.extensionDate ??
    activeProducerVerification.expirationDate
  );
}
