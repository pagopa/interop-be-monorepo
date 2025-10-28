import {
  agreementApi,
  attributeRegistryApi,
  bffApi,
  catalogApi,
} from "pagopa-interop-api-clients";
import { AgreementState } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { isAgreementUpgradable } from "../services/validators.js";

export function toApiAgreementState(
  state: AgreementState
): agreementApi.AgreementState {
  return match<AgreementState, agreementApi.AgreementState>(state)
    .with("Draft", () => agreementApi.AgreementState.Values.DRAFT)
    .with("Active", () => agreementApi.AgreementState.Values.ACTIVE)
    .with("Archived", () => agreementApi.AgreementState.Values.ARCHIVED)
    .with("Pending", () => agreementApi.AgreementState.Values.PENDING)
    .with("Suspended", () => agreementApi.AgreementState.Values.SUSPENDED)
    .with(
      "MissingCertifiedAttributes",
      () => agreementApi.AgreementState.Values.MISSING_CERTIFIED_ATTRIBUTES
    )
    .with("Rejected", () => agreementApi.AgreementState.Values.REJECTED)
    .exhaustive();
}

export function toBffCompactOrganization(
  organization: agreementApi.CompactOrganization,
  hasNotifications?: boolean
): bffApi.CompactOrganization {
  return {
    id: organization.id,
    name: organization.name,
    hasUnreadNotifications: hasNotifications || false,
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
