import {
  agreementApi,
  tenantApi,
  apiGatewayApi,
} from "pagopa-interop-api-clients";
import { isDefined, toSetToArray } from "pagopa-interop-commons";
import {
  verifiedAttributeToAttributeValidityState,
  certifiedAttributeToAttributeValidityState,
  declaredAttributeToAttributeValidityState,
} from "./tenantApiConverter.js";

export function toApiGatewayAgreementAttributes(
  agreement: agreementApi.Agreement,
  tenant: tenantApi.Tenant
): apiGatewayApi.Attributes {
  return {
    verified: toSetToArray(
      agreement.verifiedAttributes.flatMap((attr) =>
        tenant.attributes
          .map((v) => v.verified)
          .filter(isDefined)
          .filter((v) => v.id === attr.id)
          .map(verifiedAttributeToAttributeValidityState)
      )
    ),
    certified: toSetToArray(
      agreement.certifiedAttributes.flatMap((attr) =>
        tenant.attributes
          .map((c) => c.certified)
          .filter(isDefined)
          .filter((c) => c.id === attr.id)
          .map(certifiedAttributeToAttributeValidityState)
      )
    ),
    declared: toSetToArray(
      agreement.declaredAttributes.flatMap((attr) =>
        tenant.attributes
          .map((d) => d.declared)
          .filter(isDefined)
          .filter((d) => d.id === attr.id)
          .map(declaredAttributeToAttributeValidityState)
      )
    ),
  };
}
