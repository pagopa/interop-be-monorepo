import {
  TenantId,
  TenantVerifier,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

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

  return (
    activeProducerVerification &&
    match(activeProducerVerification)
      .with(
        { extensionDate: P.nonNullable, expirationDate: P.nonNullable },
        (v) =>
          v.extensionDate >= v.expirationDate
            ? v.expirationDate
            : v.extensionDate
      )
      .with(
        { extensionDate: P.nonNullable, expirationDate: P.nullish },
        (v) => v.extensionDate
      )
      .with(
        { expirationDate: P.nonNullable, extensionDate: P.nullish },
        (v) => v.expirationDate
      )
      .with(
        { expirationDate: P.nullish, extensionDate: P.nullish },
        () => undefined
      )
      .exhaustive()
  );
}
