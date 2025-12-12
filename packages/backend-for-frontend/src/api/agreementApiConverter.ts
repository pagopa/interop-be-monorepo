import {
  agreementApi,
  attributeRegistryApi,
  bffApi,
  catalogApi,
} from "pagopa-interop-api-clients";
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

export function toBffAgreementConsumerDocument(
  doc: agreementApi.Document
): bffApi.Document {
  return {
    id: doc.id,
    name: doc.name,
    prettyName: doc.prettyName,
    contentType: doc.contentType,
    createdAt: doc.createdAt,
  };
}

export function toBffAttribute(
  attribute: attributeRegistryApi.Attribute
):
  | bffApi.VerifiedAttribute
  | bffApi.DeclaredAttribute
  | bffApi.CertifiedAttribute {
  return {
    id: attribute.id,
    description: attribute.description,
    name: attribute.name,
    creationTime: attribute.creationTime,
  };
}
