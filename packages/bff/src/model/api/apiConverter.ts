/* eslint-disable max-params */
import {
  AgreementApprovalPolicy,
  AttributeId,
  Descriptor,
  DescriptorState,
  Document,
  EServiceAttribute,
  TenantAttribute,
  agreementApprovalPolicy,
  descriptorState,
  tenantAttributeType,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  DescriptorWithOnlyAttributes,
  TenantWithOnlyAttributes,
} from "pagopa-interop-lifecycle";
import {
  AgreementProcessApiAgreement,
  agreementApiState,
} from "./agreementTypes.js";
import {
  BffCatalogApiEServiceResponse,
  BffGetCatalogApiQueryParam,
} from "./bffTypes.js";
import {
  CatalogProcessApiApprovalPolicy,
  CatalogProcessApiEService,
  CatalogProcessApiEServiceAttribute,
  CatalogProcessApiEServiceDescriptor,
  CatalogProcessApiEServiceDescriptorState,
  CatalogProcessApiEServiceDocument,
  CatalogProcessApiQueryParam,
  descriptorApiState,
} from "./catalogTypes.js";
import {
  TenantProcessApiTenant,
  TenantProcessApiTenantAttribute,
} from "./tenantTypes.js";

export function toDescriptorWithOnlyAttributes(
  descriptor: CatalogProcessApiEServiceDescriptor
): DescriptorWithOnlyAttributes {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const toAttribute = (
    atts: CatalogProcessApiEServiceAttribute[]
  ): EServiceAttribute[] =>
    atts.map((att) => ({
      ...att,
      id: unsafeBrandId(att.id),
    }));

  return {
    ...descriptor,
    attributes: {
      certified: descriptor.attributes.certified.map(toAttribute),
      declared: descriptor.attributes.declared.map(toAttribute),
      verified: descriptor.attributes.verified.map(toAttribute),
    },
  };
}

export function toEserviceCatalogProcessQueryParams(
  queryParams: BffGetCatalogApiQueryParam
): CatalogProcessApiQueryParam {
  return {
    ...queryParams,
    producersIds: queryParams.producersIds
      ? queryParams.producersIds.join(",")
      : undefined,
    states: queryParams.states ? queryParams.states.join(",") : undefined,
    attributesIds: queryParams.attributesIds
      ? queryParams.attributesIds.join(",")
      : undefined,
    agreementStates: queryParams.agreementStates
      ? queryParams.agreementStates.join(",")
      : undefined,
  };
}

export function toBffCatalogApiEServiceResponse(
  eservice: CatalogProcessApiEService,
  producerTenant: TenantProcessApiTenant,
  hasCertifiedAttributes: boolean,
  isRequesterEqProducer: boolean,
  activeDescriptor?: CatalogProcessApiEServiceDescriptor,
  agreement?: AgreementProcessApiAgreement
): BffCatalogApiEServiceResponse {
  const isUpgradable = (agreement: AgreementProcessApiAgreement): boolean => {
    const eserviceDescriptor = eservice.descriptors.find(
      (e) => e.id === agreement.descriptorId
    );

    return (
      eserviceDescriptor !== undefined &&
      eservice.descriptors
        .filter((d) => Number(d.version) > Number(eserviceDescriptor.version))
        .find(
          (d) =>
            (d.state === descriptorApiState.PUBLISHED ||
              d.state === descriptorApiState.SUSPENDED) &&
            (agreement.state === agreementApiState.ACTIVE ||
              agreement.state === agreementApiState.SUSPENDED)
        ) !== undefined
    );
  };

  const partialEnhancedEservice = {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    producer: {
      id: eservice.producerId,
      name: producerTenant.name,
    },
    isMine: isRequesterEqProducer,
    hasCertifiedAttributes,
  };

  return {
    ...partialEnhancedEservice,
    ...(activeDescriptor
      ? {
          activeDescriptor: {
            id: activeDescriptor.id,
            version: activeDescriptor.version,
            audience: activeDescriptor.audience,
            state: activeDescriptor.state,
          },
        }
      : {}),
    ...(agreement
      ? {
          agreement: {
            id: agreement.id,
            state: agreement.state,
            canBeUpgraded: isUpgradable(agreement),
          },
        }
      : {}),
  };
}

export function toDescriptorState(
  state: CatalogProcessApiEServiceDescriptorState
): DescriptorState {
  return match(state)
    .with("DRAFT", () => descriptorState.draft)
    .with("PUBLISHED", () => descriptorState.published)
    .with("DEPRECATED", () => descriptorState.deprecated)
    .with("ARCHIVED", () => descriptorState.archived)
    .with("SUSPENDED", () => descriptorState.suspended)
    .exhaustive();
}

export function toEServiceDescriptorDocument(
  document: CatalogProcessApiEServiceDocument
): Document {
  return {
    ...document,
    id: unsafeBrandId(document.id),
    checksum: "", // not provided in CatalogProcessApiEServiceDocument
    uploadDate: new Date(), // not provided in CatalogProcessApiEServiceDocument
  };
}

export function toAttribute(
  attribute: CatalogProcessApiEServiceAttribute
): EServiceAttribute {
  return {
    ...attribute,
    id: unsafeBrandId<AttributeId>(attribute.id),
  };
}

export function toApprovalPolicy(
  approvalPolicy: CatalogProcessApiApprovalPolicy
): AgreementApprovalPolicy {
  return match(approvalPolicy)
    .with("MANUAL", () => agreementApprovalPolicy.manual)
    .with("AUTOMATIC", () => agreementApprovalPolicy.automatic)
    .exhaustive();
}

export function toDescriptor(
  descriptor: CatalogProcessApiEServiceDescriptor
): Descriptor {
  return {
    ...descriptor,
    createdAt: new Date(), // not provided in CatalogProcessApiEServiceDescriptor
    id: unsafeBrandId(descriptor.id),
    state: toDescriptorState(descriptor.state),
    interface:
      descriptor.interface &&
      toEServiceDescriptorDocument(descriptor.interface),
    docs: descriptor.docs.map(toEServiceDescriptorDocument),
    attributes: {
      certified: descriptor.attributes.certified.map((a) => a.map(toAttribute)),
      verified: descriptor.attributes.verified.map((a) => a.map(toAttribute)),
      declared: descriptor.attributes.declared.map((a) => a.map(toAttribute)),
    },
    agreementApprovalPolicy: toApprovalPolicy(
      descriptor.agreementApprovalPolicy
    ),
    archivedAt: descriptor.archivedAt
      ? new Date(descriptor.archivedAt)
      : undefined,
    deprecatedAt: descriptor.deprecatedAt
      ? new Date(descriptor.deprecatedAt)
      : undefined,
    suspendedAt: descriptor.suspendedAt
      ? new Date(descriptor.suspendedAt)
      : undefined,
    publishedAt: descriptor.publishedAt
      ? new Date(descriptor.publishedAt)
      : undefined,
  };
}

export function toTenantAttribute(
  attribute: TenantProcessApiTenantAttribute
): TenantAttribute[] {
  const declaredAttribute = attribute.declared && {
    type: tenantAttributeType.DECLARED,
    id: unsafeBrandId(attribute.declared.id),
    assignmentTimestamp: new Date(attribute.declared.assignmentTimestamp),
    revocationTimestamp: attribute.declared.revocationTimestamp
      ? new Date(attribute.declared.revocationTimestamp)
      : undefined,
  };

  const certifiedAttribute = attribute.certified && {
    type: tenantAttributeType.CERTIFIED,
    id: unsafeBrandId(attribute.certified.id),
    assignmentTimestamp: new Date(attribute.certified.assignmentTimestamp),
    revocationTimestamp: attribute.certified.revocationTimestamp
      ? new Date(attribute.certified.revocationTimestamp)
      : undefined,
  };

  const verifiedAttributes = attribute.verified && {
    type: tenantAttributeType.VERIFIED,
    id: unsafeBrandId(attribute.verified.id),
    assignmentTimestamp: new Date(attribute.verified.assignmentTimestamp),
    verifiedBy: attribute.verified.verifiedBy.map((v) => ({
      id: v.id,
      verificationDate: new Date(v.verificationDate),
      expirationDate: v.expirationDate ? new Date(v.expirationDate) : undefined,
      extensionDate: v.extensionDate ? new Date(v.extensionDate) : undefined,
      revocationDate: undefined, // not provided in TenantProcessApiTenantAttribute
    })),
    revokedBy: attribute.verified.revokedBy.map((r) => ({
      id: r.id,
      expirationDate: r.expirationDate ? new Date(r.expirationDate) : undefined,
      extensionDate: r.extensionDate ? new Date(r.extensionDate) : undefined,
      revocationDate: new Date(r.revocationDate),
      verificationDate: new Date(r.verificationDate),
    })),
  };

  return [
    declaredAttribute,
    certifiedAttribute,
    verifiedAttributes,
  ] as TenantAttribute[];
}

export function toTenantWithOnlyAttributes(
  tenant: TenantProcessApiTenant
): TenantWithOnlyAttributes {
  return {
    ...tenant,
    attributes: tenant.attributes.map(toTenantAttribute).flat(),
  };
}
