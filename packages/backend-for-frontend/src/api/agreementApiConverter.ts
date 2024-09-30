import { agreementApi, bffApi, catalogApi } from "pagopa-interop-api-clients";
import { isAgreementUpgradable } from "../services/validators.js";

export function toBffCompactOrganization(
  organization: agreementApi.CompactOrganization
): bffApi.CompactOrganization {
  return {
    id: organization.id,
    name: organization.name,
  };
}

export function toCompactEserviceLight(
  eservice: agreementApi.CompactEService
): bffApi.CompactEServiceLight {
  return {
    id: eservice.id,
    name: eservice.name,
  };
}

export function toBffCompactAgreement(
  agreement: agreementApi.Agreement,
  eservice: catalogApi.EService
): bffApi.CompactAgreement {
  return {
    id: agreement.id,
    state: agreement.state,
    canBeUpgraded: isAgreementUpgradable(eservice, agreement),
  };
}
