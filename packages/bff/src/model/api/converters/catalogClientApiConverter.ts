/* eslint-disable functional/immutable-data */
/* eslint-disable max-params */
import {
  DescriptorWithOnlyAttributes,
  TenantWithOnlyAttributes,
} from "pagopa-interop-agreement-lifecycle";
import {
  agreementApi,
  bffApi,
  catalogApi,
  tenantApi,
  attributeRegistryApi,
  authorizationApi,
  selfcareV2ClientApi,
} from "pagopa-interop-api-clients";
import {
  EServiceAttribute,
  unsafeBrandId,
  TenantAttribute,
  tenantAttributeType,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { attributeNotExists } from "../../domain/errors.js";
import {
  getLatestActiveDescriptor,
  getNotDraftDescriptor,
  getTenantEmail,
} from "../../modelMappingUtils.js";
import {
  catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied,
  isRequesterEserviceProducer,
  isAgreementSubscribed,
  isAgreementUpgradable,
} from "../../validators.js";
import { catalogApiDescriptorState } from "../apiTypes.js";

export function toEserviceCatalogProcessQueryParams(
  queryParams: bffApi.BffGetCatalogQueryParam
): catalogApi.GetCatalogQueryParam {
  return {
    ...queryParams,
    eservicesIds: [],
    name: queryParams.q,
  };
}

export function toBffCatalogApiEService(
  eservice: catalogApi.EService,
  producerTenant: tenantApi.Tenant,
  hasCertifiedAttributes: boolean,
  isRequesterEqProducer: boolean,
  activeDescriptor?: catalogApi.EServiceDescriptor,
  agreement?: agreementApi.Agreement
): bffApi.CatalogEService {
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
            canBeUpgraded: isAgreementUpgradable(eservice, agreement),
          },
        }
      : {}),
  };
}

export function toBffCompactOrganization(
  tenant: tenantApi.Tenant
): bffApi.CompactOrganization {
  return {
    id: tenant.id,
    name: tenant.name,
    kind: tenant.kind,
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

export function toBffCatalogDescriptorEService(
  eservice: catalogApi.EService,
  descriptor: catalogApi.EServiceDescriptor,
  producerTenant: tenantApi.Tenant,
  agreement: agreementApi.Agreement | undefined,
  requesterTenant: tenantApi.Tenant
): bffApi.CatalogDescriptorEService {
  return {
    id: eservice.id,
    name: eservice.name,
    producer: toBffCompactOrganization(producerTenant),
    description: eservice.description,
    technology: eservice.technology,
    descriptors: getNotDraftDescriptor(eservice),
    agreement: agreement && toBffCompactAgreement(agreement, eservice),
    isMine: isRequesterEserviceProducer(requesterTenant.id, eservice),
    hasCertifiedAttributes:
      catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied(
        descriptor,
        requesterTenant
      ),
    isSubscribed: isAgreementSubscribed(agreement),
    activeDescriptor: getLatestActiveDescriptor(eservice),
    mail: getTenantEmail(producerTenant),
    mode: eservice.mode,
    riskAnalysis: eservice.riskAnalysis.map(
      toBffCatalogApiEserviceRiskAnalysis
    ),
  };
}

export function toBffCatalogApiDescriptorAttribute(
  attributes: attributeRegistryApi.Attribute[],
  descriptorAttributes: catalogApi.Attribute[]
): bffApi.DescriptorAttribute[] {
  return descriptorAttributes.map((attribute) => {
    const foundAttribute = attributes.find((att) => att.id === attribute.id);
    if (!foundAttribute) {
      throw attributeNotExists(unsafeBrandId(attribute.id));
    }

    return {
      id: attribute.id,
      name: foundAttribute.name,
      description: foundAttribute.description,
      explicitAttributeVerification: attribute.explicitAttributeVerification,
    };
  });
}

export function toBffCatalogApiDescriptorDoc(
  document: catalogApi.EServiceDoc
): bffApi.EServiceDoc {
  return {
    id: document.id,
    name: document.name,
    contentType: document.contentType,
    prettyName: document.prettyName,
  };
}

export function toBffCatalogApiEserviceRiskAnalysis(
  riskAnalysis: catalogApi.EServiceRiskAnalysis
): bffApi.EServiceRiskAnalysis {
  const answers: { [key: string]: string[] } =
    riskAnalysis.riskAnalysisForm.singleAnswers
      .concat(
        riskAnalysis.riskAnalysisForm.multiAnswers.flatMap((multiAnswer) =>
          multiAnswer.values.map((answerValue) => ({
            id: multiAnswer.id,
            value: answerValue,
            key: multiAnswer.key,
          }))
        )
      )
      .reduce((answers: { [key: string]: string[] }, answer) => {
        const key = `${answer.key}`;
        if (answers[key] && answer.value) {
          answers[key] = [...answers[key], answer.value];
        } else {
          answers[key] = [];
        }

        return answers;
      }, {});

  const riskAnalysisForm: bffApi.RiskAnalysisForm = {
    riskAnalysisId: riskAnalysis.id,
    version: riskAnalysis.riskAnalysisForm.version,
    answers,
  };

  return {
    id: riskAnalysis.id,
    name: riskAnalysis.name,
    createdAt: riskAnalysis.createdAt,
    riskAnalysisForm,
  };
}

export function toBffCatalogApiProducerDescriptorEService(
  eservice: catalogApi.EService,
  producer: tenantApi.Tenant
): bffApi.ProducerDescriptorEService {
  const producerMail = getTenantEmail(producer);

  const notDraftDecriptors: bffApi.CompactDescriptor[] =
    eservice.descriptors.filter(
      (d) => d.state !== catalogApiDescriptorState.DRAFT
    );

  const draftDescriptor: bffApi.CompactDescriptor | undefined =
    eservice.descriptors.find(
      (d) => d.state === catalogApiDescriptorState.DRAFT
    );

  return {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    technology: eservice.technology,
    mode: eservice.mode,
    mail: producerMail && {
      address: producerMail.address,
      description: producerMail.description,
    },
    draftDescriptor,
    riskAnalysis: eservice.riskAnalysis.map(
      toBffCatalogApiEserviceRiskAnalysis
    ),
    descriptors: notDraftDecriptors,
  };
}

export function toEserviceAttribute(
  attributes: catalogApi.Attribute[]
): EServiceAttribute[] {
  return attributes.map((attribute) => ({
    ...attribute,
    id: unsafeBrandId(attribute.id),
  }));
}

export function toDescriptorWithOnlyAttributes(
  descriptor: catalogApi.EServiceDescriptor
): DescriptorWithOnlyAttributes {
  return {
    ...descriptor,
    attributes: {
      certified: descriptor.attributes.certified.map(toEserviceAttribute),
      declared: descriptor.attributes.declared.map(toEserviceAttribute),
      verified: descriptor.attributes.verified.map(toEserviceAttribute),
    },
  };
}

export function toBffCatalogApiDescriptorAttributes(
  attributes: attributeRegistryApi.Attribute[],
  descriptor: catalogApi.EServiceDescriptor
): bffApi.DescriptorAttributes {
  return {
    certified: [
      toBffCatalogApiDescriptorAttribute(
        attributes,
        descriptor.attributes.certified.flat()
      ),
    ],
    declared: [
      toBffCatalogApiDescriptorAttribute(
        attributes,
        descriptor.attributes.declared.flat()
      ),
    ],
    verified: [
      toBffCatalogApiDescriptorAttribute(
        attributes,
        descriptor.attributes.verified.flat()
      ),
    ],
  };
}
export function toTenantAttribute(
  att: tenantApi.TenantAttribute
): TenantAttribute[] {
  const certified: CertifiedTenantAttribute | undefined = att.certified && {
    id: unsafeBrandId(att.certified.id),
    type: tenantAttributeType.CERTIFIED,
    revocationTimestamp: att.certified.revocationTimestamp
      ? new Date(att.certified.revocationTimestamp)
      : undefined,
    assignmentTimestamp: new Date(att.certified.assignmentTimestamp),
  };

  const verified: VerifiedTenantAttribute | undefined = att.verified && {
    id: unsafeBrandId(att.verified.id),
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
    id: unsafeBrandId(att.declared.id),
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
  tenant: tenantApi.Tenant
): TenantWithOnlyAttributes {
  return {
    ...tenant,
    attributes: tenant.attributes.map(toTenantAttribute).flat(),
  };
}

export function toCatalogCreateEServiceSeed(
  eServiceSeed: bffApi.EServiceSeed
): catalogApi.EServiceSeed {
  return {
    ...eServiceSeed,
    descriptor: {
      audience: [],
      voucherLifespan: 60,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1,
      agreementApprovalPolicy:
        catalogApi.AgreementApprovalPolicy.Values.AUTOMATIC,
    },
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

export function toCompactOrganization(
  organization: agreementApi.CompactOrganization
): bffApi.CompactOrganization {
  return {
    id: organization.id,
    name: organization.name,
  };
}

export function toCompactEservice(
  eservice: catalogApi.EService,
  producer: tenantApi.Tenant
): bffApi.CompactEService {
  return {
    id: eservice.id,
    name: eservice.name,
    producer: {
      id: producer.id,
      name: producer.name,
      kind: producer.kind,
    },
  };
}

export function toCompactDescriptor(
  descriptor: catalogApi.EServiceDescriptor
): bffApi.CompactDescriptor {
  return {
    id: descriptor.id,
    audience: descriptor.audience,
    state: descriptor.state,
    version: descriptor.version,
  };
}
export const toBffApiCompactClient = (
  input: authorizationApi.ClientWithKeys
): bffApi.CompactClient => ({
  hasKeys: input.keys.length > 0,
  id: input.client.id,
  name: input.client.name,
});

export const toBffApiCompactUser = (
  input: selfcareV2ClientApi.UserResponse,
  userId: string
): bffApi.CompactUser =>
  match(input)
    .with({ name: P.nullish, surname: P.nullish }, () => ({
      userId,
      name: "Utente",
      familyName: userId,
    }))
    .otherwise((ur) => ({
      userId,
      name: ur.name ?? "",
      familyName: ur.surname ?? "",
    }));

export const toBffApiCompactProducerKeychain = (
  input: authorizationApi.ProducerKeychain
): bffApi.CompactProducerKeychain => ({
  hasKeys: input.keys.length > 0,
  id: input.id,
  name: input.name,
});
