import { addDays } from "date-fns";
import {
  filterVerifiedAttributes,
  getVerifiedAttributeExpirationDate,
} from "pagopa-interop-agreement-lifecycle";
import {
  getMockTenant,
  getMockVerifiedTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  Tenant,
  TenantId,
  VerifiedTenantAttribute,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

describe("verified attributes utilities", () => {
  const verifier: Tenant = getMockTenant();

  const mockVerifiedBy = getMockVerifiedTenantAttribute().verifiedBy;
  const mockRevokedBy = getMockVerifiedTenantAttribute().revokedBy;

  const verifiedWithoutExpiration: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    verifiedBy: [
      ...mockVerifiedBy,
      {
        id: verifier.id,
        verificationDate: new Date(),
      },
    ],
    revokedBy: mockRevokedBy,
  };

  const verifiedWithFutureExpiration: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    verifiedBy: [
      ...mockVerifiedBy,
      {
        id: verifier.id,
        verificationDate: new Date(),
        expirationDate: addDays(new Date(), 30),
      },
    ],
    revokedBy: mockRevokedBy,
  };

  const verifiedWithPastExpiration: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    verifiedBy: [
      ...mockVerifiedBy,
      {
        id: verifier.id,
        verificationDate: new Date(),
        expirationDate: addDays(new Date(), -30),
      },
    ],
    revokedBy: mockRevokedBy,
  };

  const verifiedWithFutureExtension: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    verifiedBy: [
      ...mockVerifiedBy,
      {
        id: verifier.id,
        verificationDate: new Date(),
        extensionDate: addDays(new Date(), 30),
      },
    ],
    revokedBy: mockRevokedBy,
  };

  const verifiedWithPastExtension: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    verifiedBy: [
      ...mockVerifiedBy,
      {
        id: verifier.id,
        verificationDate: new Date(),
        extensionDate: addDays(new Date(), -30),
      },
    ],
    revokedBy: mockRevokedBy,
  };

  const verifiedWithFutureExpirationAndExtension: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    verifiedBy: [
      ...mockVerifiedBy,
      {
        id: verifier.id,
        verificationDate: new Date(),
        expirationDate: addDays(new Date(), 30),
        extensionDate: addDays(new Date(), 40),
      },
    ],
    revokedBy: mockRevokedBy,
  };

  // Theoretically, this case should not happen.
  const verifiedWithFutureExpirationAndExtensionSwapped: VerifiedTenantAttribute =
    {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        ...mockVerifiedBy,
        {
          id: verifier.id,
          verificationDate: new Date(),
          expirationDate: addDays(new Date(), 40),
          extensionDate: addDays(new Date(), 30),
        },
      ],
      revokedBy: mockRevokedBy,
    };

  const verifiedWithPastExpirationAndExtension: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    verifiedBy: [
      ...mockVerifiedBy,
      {
        id: verifier.id,
        verificationDate: new Date(),
        expirationDate: addDays(new Date(), -40),
        extensionDate: addDays(new Date(), -30),
      },
    ],
    revokedBy: mockRevokedBy,
  };

  // Theoretically, this case should not happen.
  const verifiedWithPastExpirationAndExtensionSwapped: VerifiedTenantAttribute =
    {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        ...mockVerifiedBy,
        {
          id: verifier.id,
          verificationDate: new Date(),
          expirationDate: addDays(new Date(), -30),
          extensionDate: addDays(new Date(), -40),
        },
      ],
      revokedBy: mockRevokedBy,
    };

  // Theoretically, this case should not happen.
  const verifiedWithFutureExpirationAndPastExtension: VerifiedTenantAttribute =
    {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        ...mockVerifiedBy,
        {
          id: verifier.id,
          verificationDate: new Date(),
          expirationDate: addDays(new Date(), 30),
          extensionDate: addDays(new Date(), -40),
        },
      ],
      revokedBy: mockRevokedBy,
    };

  const verifiedWithPastExpirationAndFutureExtension: VerifiedTenantAttribute =
    {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        ...mockVerifiedBy,
        {
          id: verifier.id,
          verificationDate: new Date(),
          expirationDate: addDays(new Date(), -30),
          extensionDate: addDays(new Date(), 40),
        },
      ],
      revokedBy: mockRevokedBy,
    };

  const notVerified: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    verifiedBy: mockVerifiedBy,
    revokedBy: mockRevokedBy,
  };

  const verifiedByAnotherTenant: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    verifiedBy: [
      ...mockVerifiedBy,
      {
        id: generateId<TenantId>(),
        verificationDate: new Date(),
      },
    ],
    revokedBy: mockRevokedBy,
  };

  const verifiedAndRevoked: VerifiedTenantAttribute = {
    ...getMockVerifiedTenantAttribute(),
    verifiedBy: [
      ...mockVerifiedBy,
      {
        id: verifier.id,
        verificationDate: new Date(),
      },
    ],
    revokedBy: [
      ...mockRevokedBy,
      {
        id: verifier.id,
        verificationDate: new Date(),
        revocationDate: new Date(),
      },
    ],
  };

  describe("filterVerifiedAttributes", () => {
    it("should filter valid verified attributes", () => {
      const tenant: Tenant = {
        ...getMockTenant(),
        selfcareId: generateId(),
        attributes: [
          verifiedWithoutExpiration,
          verifiedWithFutureExpiration,
          verifiedWithPastExpiration,
          verifiedWithFutureExtension,
          verifiedWithPastExtension,
          verifiedWithFutureExpirationAndExtension,
          verifiedWithFutureExpirationAndExtensionSwapped,
          verifiedWithPastExpirationAndExtension,
          verifiedWithPastExpirationAndExtensionSwapped,
          verifiedWithFutureExpirationAndPastExtension,
          verifiedWithPastExpirationAndFutureExtension,
          notVerified,
          verifiedByAnotherTenant,
          verifiedAndRevoked,
        ],
      };

      const validAttributes = filterVerifiedAttributes(
        verifier.id,
        tenant.attributes
      );

      expect(validAttributes).toStrictEqual([
        verifiedWithoutExpiration,
        verifiedWithFutureExpiration,
        verifiedWithFutureExtension,
        verifiedWithFutureExpirationAndExtension,
        verifiedWithFutureExpirationAndExtensionSwapped,
        verifiedWithPastExpirationAndFutureExtension,
      ]);
    });
  });

  describe("getVerifiedAttributeExpirationDate", () => {
    it("should get the expiration date of verified attributes", () => {
      expect(
        getVerifiedAttributeExpirationDate(
          verifier.id,
          verifiedWithoutExpiration
        )
      ).toBeUndefined();

      expect(
        getVerifiedAttributeExpirationDate(
          verifier.id,
          verifiedWithFutureExpiration
        )
      ).toEqual(
        verifiedWithFutureExpiration.verifiedBy.find(
          (v) => v.id === verifier.id
        )?.expirationDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifier.id,
          verifiedWithPastExpiration
        )
      ).toEqual(
        verifiedWithPastExpiration.verifiedBy.find((v) => v.id === verifier.id)
          ?.expirationDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifier.id,
          verifiedWithFutureExtension
        )
      ).toEqual(
        verifiedWithFutureExtension.verifiedBy.find((v) => v.id === verifier.id)
          ?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifier.id,
          verifiedWithPastExtension
        )
      ).toEqual(
        verifiedWithPastExtension.verifiedBy.find((v) => v.id === verifier.id)
          ?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifier.id,
          verifiedWithFutureExpirationAndExtension
        )
      ).toEqual(
        verifiedWithFutureExpirationAndExtension.verifiedBy.find(
          (v) => v.id === verifier.id
        )?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifier.id,
          verifiedWithPastExpirationAndExtension
        )
      ).toEqual(
        verifiedWithPastExpirationAndExtension.verifiedBy.find(
          (v) => v.id === verifier.id
        )?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifier.id,
          verifiedWithPastExpirationAndFutureExtension
        )
      ).toEqual(
        verifiedWithPastExpirationAndFutureExtension.verifiedBy.find(
          (v) => v.id === verifier.id
        )?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(verifier.id, notVerified)
      ).toBeUndefined();

      expect(
        getVerifiedAttributeExpirationDate(verifier.id, verifiedByAnotherTenant)
      ).toBeUndefined();

      expect(
        getVerifiedAttributeExpirationDate(verifier.id, verifiedAndRevoked)
      ).toBeUndefined();

      // Cases that should never happen
      expect(
        getVerifiedAttributeExpirationDate(
          verifier.id,
          verifiedWithFutureExpirationAndExtensionSwapped
        )
      ).toEqual(
        verifiedWithFutureExpirationAndExtensionSwapped.verifiedBy.find(
          (v) => v.id === verifier.id
        )?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifier.id,
          verifiedWithPastExpirationAndExtensionSwapped
        )
      ).toEqual(
        verifiedWithPastExpirationAndExtensionSwapped.verifiedBy.find(
          (v) => v.id === verifier.id
        )?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifier.id,
          verifiedWithFutureExpirationAndPastExtension
        )
      ).toEqual(
        verifiedWithFutureExpirationAndPastExtension.verifiedBy.find(
          (v) => v.id === verifier.id
        )?.extensionDate
      );
    });
  });
});
