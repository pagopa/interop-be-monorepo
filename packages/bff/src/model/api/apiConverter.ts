/* eslint-disable max-params */
import {
  AgreementApprovalPolicy,
  TenantAttribute,
  AttributeId,
  DescriptorState,
  Document,
  EServiceAttribute,
  agreementApprovalPolicy,
  descriptorState,
  unsafeBrandId,
  tenantAttributeType,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  VerifiedTenantAttribute,
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

export function toEserviceAttribute(
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

export function toTenantAttribute(
  att: TenantProcessApiTenantAttribute
): TenantAttribute[] {
  const certified: CertifiedTenantAttribute | undefined = att.certified && {
    id: unsafeBrandId<AttributeId>(att.certified.id),
    type: tenantAttributeType.CERTIFIED,
    revocationTimestamp: att.certified.revocationTimestamp
      ? new Date(att.certified.revocationTimestamp)
      : undefined,
    assignmentTimestamp: new Date(att.certified.assignmentTimestamp),
  };

  const verified: VerifiedTenantAttribute | undefined = att.verified && {
    id: unsafeBrandId<AttributeId>(att.verified.id),
    type: tenantAttributeType.VERIFIED,
    assignmentTimestamp: new Date(att.verified.assignmentTimestamp),
    verifiedBy: att.verified.verifiedBy.map((v) => ({
      id: v.id,
      verificationDate: new Date(v.verificationDate),
      expirationDate: v.expirationDate ? new Date(v.expirationDate) : undefined,
      extensionDate: v.extensionDate ? new Date(v.extensionDate) : undefined,
    })),
    revokedBy: att.verified.revokedBy.map((r) => ({
      id: r.id,
      verificationDate: new Date(r.verificationDate),
      revocationDate: new Date(r.revocationDate),
      expirationDate: r.expirationDate ? new Date(r.expirationDate) : undefined,
      extensionDate: r.extensionDate ? new Date(r.extensionDate) : undefined,
    })),
  };

  const declared: DeclaredTenantAttribute | undefined = att.declared && {
    id: unsafeBrandId<AttributeId>(att.declared.id),
    type: tenantAttributeType.DECLARED,
    assignmentTimestamp: new Date(att.declared.assignmentTimestamp),
    revocationTimestamp: att.declared.revocationTimestamp
      ? new Date(att.declared.revocationTimestamp)
      : undefined,
  };

  return [certified, verified, declared].filter(
    (a): a is TenantAttribute => !!a
  );
}

export function toTenantWithOnlyAttributes(
  tenant: TenantProcessApiTenant
): TenantWithOnlyAttributes {
  return {
    ...tenant,
    attributes: tenant.attributes.map(toTenantAttribute).flat(),
  };
}
