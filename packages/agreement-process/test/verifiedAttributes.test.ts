import { addDays } from "date-fns";
import {
  filterVerifiedAttributes,
  getVerifiedAttributeExpirationDate,
} from "pagopa-interop-agreement-lifecycle";
import {
  getMockTenant,
  getMockVerifiedTenantAttribute,
} from "pagopa-interop-commons-test/index.js";
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

  const verifiedWithPastExpirationAndExtension: VerifiedTenantAttribute = {
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
          verifiedWithPastExpirationAndExtension,
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
        verifiedWithPastExpirationAndFutureExtension,
      ]);
    });
  });

  describe("getVerifiedAttributeExpirationDate", () => {
    it("should get the expiration date of verified attributes", () => {
      expect(
        getVerifiedAttributeExpirationDate(
          verifiedWithoutExpiration,
          verifier.id
        )
      ).toBeUndefined();

      expect(
        getVerifiedAttributeExpirationDate(
          verifiedWithFutureExpiration,
          verifier.id
        )
      ).toEqual(
        verifiedWithFutureExpiration.verifiedBy.find(
          (v) => v.id === verifier.id
        )?.expirationDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifiedWithPastExpiration,
          verifier.id
        )
      ).toEqual(
        verifiedWithPastExpiration.verifiedBy.find((v) => v.id === verifier.id)
          ?.expirationDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifiedWithFutureExtension,
          verifier.id
        )
      ).toEqual(
        verifiedWithFutureExtension.verifiedBy.find((v) => v.id === verifier.id)
          ?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifiedWithPastExtension,
          verifier.id
        )
      ).toEqual(
        verifiedWithPastExtension.verifiedBy.find((v) => v.id === verifier.id)
          ?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifiedWithFutureExpirationAndExtension,
          verifier.id
        )
      ).toEqual(
        verifiedWithFutureExpirationAndExtension.verifiedBy.find(
          (v) => v.id === verifier.id
        )?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifiedWithPastExpirationAndExtension,
          verifier.id
        )
      ).toEqual(
        verifiedWithPastExpirationAndExtension.verifiedBy.find(
          (v) => v.id === verifier.id
        )?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifiedWithPastExpirationAndFutureExtension,
          verifier.id
        )
      ).toEqual(
        verifiedWithPastExpirationAndFutureExtension.verifiedBy.find(
          (v) => v.id === verifier.id
        )?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(
          verifiedWithFutureExpirationAndPastExtension,
          verifier.id
        )
      ).toEqual(
        verifiedWithFutureExpirationAndPastExtension.verifiedBy.find(
          (v) => v.id === verifier.id
        )?.extensionDate
      );

      expect(
        getVerifiedAttributeExpirationDate(notVerified, verifier.id)
      ).toBeUndefined();

      expect(
        getVerifiedAttributeExpirationDate(verifiedByAnotherTenant, verifier.id)
      ).toBeUndefined();

      expect(
        getVerifiedAttributeExpirationDate(verifiedAndRevoked, verifier.id)
      ).toBeUndefined();
    });
  });
});
