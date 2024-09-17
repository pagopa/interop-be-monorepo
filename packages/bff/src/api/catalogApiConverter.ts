/* eslint-disable functional/immutable-data */
/* eslint-disable max-params */
import { DescriptorWithOnlyAttributes } from "pagopa-interop-agreement-lifecycle";
import {
  agreementApi,
  attributeRegistryApi,
  bffApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { EServiceAttribute, unsafeBrandId } from "pagopa-interop-models";
import { attributeNotExists } from "../model/errors.js";
import {
  getLatestActiveDescriptor,
  getNotDraftDescriptor,
  getLatestTenantContactEmail,
} from "../model/modelMappingUtils.js";
import {
  isRequesterEserviceProducer,
  isAgreementSubscribed,
  isAgreementUpgradable,
  hasCertifiedAttributes,
} from "../services/validators.js";
import {
  ConfigurationRiskAnalysis,
  catalogApiDescriptorState,
} from "../model/types.js";
import { toBffCompactOrganization } from "./tenantApiConverter.js";
import { toBffCompactAgreement } from "./agreementApiConverter.js";

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
    hasCertifiedAttributes: hasCertifiedAttributes(
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
    hasCertifiedAttributes: hasCertifiedAttributes(descriptor, requesterTenant),
    isSubscribed: isAgreementSubscribed(agreement),
    activeDescriptor: getLatestActiveDescriptor(eservice),
    mail: getLatestTenantContactEmail(producerTenant),
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

export function toBffCatalogApiEserviceRiskAnalysisSeed(
  riskAnalysis: ConfigurationRiskAnalysis
): bffApi.EServiceRiskAnalysisSeed {
  const answers: bffApi.RiskAnalysisForm["answers"] =
    riskAnalysis.riskAnalysisForm.singleAnswers
      .concat(
        riskAnalysis.riskAnalysisForm.multiAnswers.flatMap((multiAnswer) =>
          multiAnswer.values.map((answerValue) => ({
            value: answerValue,
            key: multiAnswer.key,
          }))
        )
      )
      // eslint-disable-next-line sonarjs/no-identical-functions
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
    version: riskAnalysis.riskAnalysisForm.version,
    answers,
  };

  return {
    name: riskAnalysis.name,
    riskAnalysisForm,
  };
}

export function toBffCatalogApiProducerDescriptorEService(
  eservice: catalogApi.EService,
  producer: tenantApi.Tenant
): bffApi.ProducerDescriptorEService {
  const producerMail = getLatestTenantContactEmail(producer);

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
