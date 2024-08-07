/* eslint-disable functional/immutable-data */
/* eslint-disable max-params */
import { DescriptorWithOnlyAttributes } from "pagopa-interop-agreement-lifecycle";
import {
  agreementApi,
  bffApi,
  catalogApi,
  tenantApi,
  attributeRegistryApi,
} from "pagopa-interop-api-clients";
import { EServiceAttribute, unsafeBrandId } from "pagopa-interop-models";
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
  requesterTenant: tenantApi.Tenant,
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
    hasCertifiedAttributes:
      catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied(
        activeDescriptor,
        requesterTenant
      ),
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
  const answers: bffApi.RiskAnalysisForm["answers"] =
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
      .reduce((answers: bffApi.RiskAnalysisForm["answers"], answer) => {
        const key = answer.key;
        if (!answers[key]) {
          answers[key] = [];
        }

        if (answer.value) {
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
