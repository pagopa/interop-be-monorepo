/* eslint-disable functional/immutable-data */
/* eslint-disable max-params */
import {
  TenantAttribute,
  EServiceAttribute,
  unsafeBrandId,
  tenantAttributeType,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  tenantMailKind,
  VerifiedTenantAttribute,
} from "pagopa-interop-models";
import {
  DescriptorWithOnlyAttributes,
  TenantWithOnlyAttributes,
} from "pagopa-interop-agreement-lifecycle";
import {
  bffApi,
  catalogApi,
  tenantApi,
  agreementApi,
  descriptorApiState,
  agreementApiState,
  GetCatalogQueryParam,
  BffGetCatalogQueryParam,
  EService,
  EServiceDoc,
  EServiceDescriptor,
  EServiceRiskAnalysis,
  BffCatalogApiDescriptorAttribute,
  BffCatalogApiCompactDescriptor,
  BffCatalogApiEServiceDoc,
  BffCatalogApiProducerEServiceRiskAnalysis,
  BffCatalogApiProducerRiskAnalysisForm,
  AttributeProcessApi,
} from "pagopa-interop-api-clients";
import { attributeNotExists } from "../../domain/errors.js";

export function toEserviceCatalogProcessQueryParams(
  queryParams: BffGetCatalogQueryParam
): GetCatalogQueryParam {
  return {
    ...queryParams,
    eservicesIds: [],
    name: queryParams.q,
  };
}

export function toBffCatalogApiEServiceResponse(
  eservice: catalogApi.EService,
  producerTenant: tenantApi.Tenant,
  hasCertifiedAttributes: boolean,
  isRequesterEqProducer: boolean,
  activeDescriptor?: catalogApi.EServiceDescriptor,
  agreement?: agreementApi.Agreement
): bffApi.CatalogEService {
  const isUpgradable = (agreement: agreementApi.Agreement): boolean => {
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

export function toBffCatalogApiDescriptorAttribute(
  attributes: AttributeProcessApi[],
  descriptorAttributes: EServiceAttribute[]
): BffCatalogApiDescriptorAttribute[] {
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

export function toBffCatalogApiDescriptorInterface(
  document: EServiceDoc
): BffCatalogApiEServiceDoc {
  return {
    id: document.id,
    name: document.name,
    contentType: document.contentType,
    prettyName: document.prettyName,
  };
}

export function toBffCatalogApiEserviceRiskAnalysis(
  riskAnalysis: EServiceRiskAnalysis
): BffCatalogApiProducerEServiceRiskAnalysis {
  const answers: { [key: string]: string[] } = {};

  riskAnalysis.riskAnalysisForm.singleAnswers
    .concat(riskAnalysis.riskAnalysisForm.multiAnswers)
    .map((answer) => ({
      questionId: answer.questionId,
      answer: answer.value,
    }))
    .forEach((QA) => {
      if (answers[`${QA.questionId}`] && QA.answer) {
        answers[`${QA.questionId}`] = [
          ...answers[`${QA.questionId}`],
          QA.answer,
        ];
      } else {
        answers[`${QA.questionId}`] = [];
      }
    });

  const riskAnalysisForm: BffCatalogApiProducerRiskAnalysisForm = {
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
  eservice: EServiceDescriptor,
  producer: TenantProcessApiTenant
): bffApi.CatalogEService {
  const producerMail = producer.mails.find(
    (m) => m.kind === tenantMailKind.ContactEmail
  );

  const notDraftDecriptor: BffCatalogApiCompactDescriptor[] =
    eservice.descriptors.filter((d) => d.state !== descriptorApiState.DRAFT);

  const draftDescriptor: BffCatalogApiCompactDescriptor | undefined =
    eservice.descriptors.find((d) => d.state === descriptorApiState.DRAFT);

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
    descriptors: notDraftDecriptor,
  };
}

export function toEserviceAttribute(
  attributes: EServiceAttribute[]
): EServiceAttribute[] {
  return attributes.map((attribute) => ({
    ...attribute,
    id: unsafeBrandId(attribute.id),
  }));
}

export function toDescriptorWithOnlyAttributes(
  descriptor: EServiceDescriptor
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
