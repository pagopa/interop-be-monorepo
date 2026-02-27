/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  generateId,
  unsafeBrandId,
  badRequestError,
  CompactTenant,
} from "pagopa-interop-models";
import { agreementApi } from "pagopa-interop-api-clients";
import { describe, it, expect } from "vitest";
import { fromApiCompactTenant } from "../../src/model/domain/apiConverter.js";
import {
  getMockApiTenantCertifiedAttribute,
  getMockApiTenantDeclaredAttribute,
  getMockApiTenantVerifiedAttribute,
} from "../mockUtils.js";

describe("fromApiCompactTenant API converter", () => {
  it("converts an ApiCompactTenant to a CompactTenant", () => {
    const apiCompactTenant: agreementApi.CompactTenant = {
      id: generateId(),
      attributes: [
        getMockApiTenantCertifiedAttribute(),
        getMockApiTenantDeclaredAttribute(),
        getMockApiTenantVerifiedAttribute(),
      ],
    };

    const expectedCompactTenant: CompactTenant = {
      id: unsafeBrandId(apiCompactTenant.id),
      attributes: [
        {
          type: "PersistentCertifiedAttribute",
          id: unsafeBrandId(apiCompactTenant.attributes[0].certified!.id),
          assignmentTimestamp: new Date(
            apiCompactTenant.attributes[0].certified!.assignmentTimestamp
          ),
          revocationTimestamp: apiCompactTenant.attributes[0].certified!
            .revocationTimestamp
            ? new Date(
                apiCompactTenant.attributes[0].certified!.revocationTimestamp
              )
            : undefined,
        },
        {
          type: "PersistentDeclaredAttribute",
          id: unsafeBrandId(apiCompactTenant.attributes[1].declared!.id),
          assignmentTimestamp: new Date(
            apiCompactTenant.attributes[1].declared!.assignmentTimestamp
          ),
          revocationTimestamp: apiCompactTenant.attributes[1].declared!
            .revocationTimestamp
            ? new Date(
                apiCompactTenant.attributes[1].declared!.revocationTimestamp
              )
            : undefined,
        },
        {
          type: "PersistentVerifiedAttribute",
          id: unsafeBrandId(apiCompactTenant.attributes[2].verified!.id),
          assignmentTimestamp: new Date(
            apiCompactTenant.attributes[2].verified!.assignmentTimestamp
          ),
          verifiedBy: [
            {
              id: unsafeBrandId(
                apiCompactTenant.attributes[2].verified!.verifiedBy[0].id
              ),
              verificationDate: new Date(
                apiCompactTenant.attributes[2].verified!.verifiedBy[0]
                  .verificationDate
              ),
              expirationDate: apiCompactTenant.attributes[2].verified!
                .verifiedBy[0].expirationDate
                ? new Date(
                    apiCompactTenant.attributes[2].verified!.verifiedBy[0]
                      .expirationDate
                  )
                : undefined,
              extensionDate: apiCompactTenant.attributes[2].verified!
                .verifiedBy[0].extensionDate
                ? new Date(
                    apiCompactTenant.attributes[2].verified!.verifiedBy[0]
                      .extensionDate
                  )
                : undefined,
            },
          ],
          revokedBy: [
            {
              id: unsafeBrandId(
                apiCompactTenant.attributes[2].verified!.revokedBy[0].id
              ),
              verificationDate: new Date(
                apiCompactTenant.attributes[2].verified!.revokedBy[0]
                  .verificationDate
              ),
              revocationDate: new Date(
                apiCompactTenant.attributes[2].verified!.revokedBy[0]
                  .revocationDate
              ),
              expirationDate: apiCompactTenant.attributes[2].verified!
                .revokedBy[0].expirationDate
                ? new Date(
                    apiCompactTenant.attributes[2].verified!.revokedBy[0]
                      .expirationDate
                  )
                : undefined,
              extensionDate: apiCompactTenant.attributes[2].verified!
                .revokedBy[0].extensionDate
                ? new Date(
                    apiCompactTenant.attributes[2].verified!.revokedBy[0]
                      .extensionDate
                  )
                : undefined,
            },
          ],
        },
      ],
    };

    const actualCompactTenant: CompactTenant =
      fromApiCompactTenant(apiCompactTenant);
    expect(actualCompactTenant).toMatchObject(expectedCompactTenant);
  });

  it("throws a badRequestError when the ApiCompactTenant cannot be converted to a CompactTenant", () => {
    const apiCompactTenant: agreementApi.CompactTenant = {
      id: generateId(),
      attributes: [
        {
          // An attribute with both certified and declared keys cannot
          // be converted to a TenantAttribute.
          ...getMockApiTenantCertifiedAttribute(),
          ...getMockApiTenantDeclaredAttribute(),
        },
      ],
    };

    expect(() => fromApiCompactTenant(apiCompactTenant)).toThrow(
      badRequestError(
        `Invalid tenant attribute in API request: ${JSON.stringify(
          apiCompactTenant.attributes[0]
        )}`
      )
    );
  });
});
