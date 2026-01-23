/* eslint-disable functional/immutable-data */
/* eslint-disable max-params */
import {
  agreementApi,
  attributeRegistryApi,
  bffApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  Descriptor,
  descriptorState,
  DescriptorState,
  EServiceAttribute,
  Technology,
  technology,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { getRulesetExpiration } from "pagopa-interop-commons";
import { attributeNotExists } from "../model/errors.js";
import {
  getLatestActiveDescriptor,
  getLatestTenantContactEmail,
  getValidDescriptor,
} from "../model/modelMappingUtils.js";
import { ConfigurationRiskAnalysis } from "../model/types.js";
import {
  hasCertifiedAttributes,
  isAgreementSubscribed,
  isAgreementUpgradable,
  isInvalidDescriptor,
  isRequesterEserviceProducer,
  isValidDescriptor,
} from "../services/validators.js";
import { toBffCompactAgreement } from "./agreementApiConverter.js";

export function toEserviceCatalogProcessQueryParams(
  queryParams: bffApi.BffGetCatalogQueryParam
): catalogApi.GetEServicesQueryParams {
  return {
    ...queryParams,
    eservicesIds: [],
    name: queryParams.q,
    templatesIds: [],
  };
}

export function toBffCatalogApiEService(
  eservice: catalogApi.EService,
  producerTenant: tenantApi.Tenant,
  isRequesterEqProducer: boolean,
  hasNotifications: boolean,
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
    hasUnreadNotifications: hasNotifications,
    personalData: eservice.personalData,
  };
}

export async function toBffCatalogDescriptorEService(
  eservice: catalogApi.EService,
  descriptor: catalogApi.EServiceDescriptor,
  producerTenant: tenantApi.Tenant,
  agreements: agreementApi.Agreement[],
  requesterTenant: tenantApi.Tenant,
  consumerDelegators: tenantApi.Tenant[]
): Promise<bffApi.CatalogDescriptorEService> {
  const activeDescriptor = getLatestActiveDescriptor(eservice);
  return {
    id: eservice.id,
    name: eservice.name,
    producer: {
      id: producerTenant.id,
      name: producerTenant.name,
      kind: producerTenant.kind,
    },
    description: eservice.description,
    technology: eservice.technology,
    descriptors: getValidDescriptor(eservice).map(toCompactDescriptor),
    agreements: agreements.map((agreement) =>
      toBffCompactAgreement(agreement, eservice)
    ),
    isMine: isRequesterEserviceProducer(requesterTenant.id, eservice),
    hasCertifiedAttributes: [requesterTenant, ...consumerDelegators].some(
      (t) => hasCertifiedAttributes(descriptor, t)
      /* True in case:
      - the requester has the certified attributes required to consume the eservice, or
      - the requester is the delegated consumer for the eservice and
        the delegator has the certified attributes required to consume the eservice */
    ),
    isSubscribed: agreements.some((agreement) =>
      isAgreementSubscribed(agreement)
    ),
    activeDescriptor: activeDescriptor
      ? toCompactDescriptor(activeDescriptor)
      : undefined,
    mail: getLatestTenantContactEmail(producerTenant),
    mode: eservice.mode,
    riskAnalysis: eservice.riskAnalysis.map((ra) =>
      toBffCatalogApiEserviceRiskAnalysis(ra, undefined)
    ),
    isSignalHubEnabled: eservice.isSignalHubEnabled,
    isConsumerDelegable: eservice.isConsumerDelegable,
    isClientAccessDelegable: eservice.isClientAccessDelegable,
    personalData: eservice.personalData,
  };
}

export function toBffCatalogApiDescriptorAttribute(
  attributes: attributeRegistryApi.Attribute[],
  attribute: catalogApi.Attribute
): bffApi.DescriptorAttribute {
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
}

export function toBffCatalogApiDescriptorDoc(
  document: catalogApi.EServiceDoc
): bffApi.EServiceDoc {
  return {
    id: document.id,
    name: document.name,
    contentType: document.contentType,
    prettyName: document.prettyName,
    checksum: document.checksum,
  };
}

export function toBffCatalogApiEserviceRiskAnalysis(
  riskAnalysis: catalogApi.EServiceRiskAnalysis,
  rulesetExpiration: string | undefined
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
    rulesetExpiration,
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

export async function enhanceEServiceToBffCatalogApiProducerDescriptorEService(
  eservice: catalogApi.EService,
  producer: tenantApi.Tenant
): Promise<bffApi.ProducerDescriptorEService> {
  const producerMail = getLatestTenantContactEmail(producer);

  const notDraftDecriptors = eservice.descriptors
    .filter(isValidDescriptor)
    .map(toCompactDescriptor);

  const draftDescriptor = eservice.descriptors.find(isInvalidDescriptor);

  return {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    technology: eservice.technology,
    producer: {
      id: producer.id,
      tenantKind: producer.kind,
    },
    mode: eservice.mode,
    mail: producerMail && {
      address: producerMail.address,
      description: producerMail.description,
    },
    draftDescriptor: draftDescriptor
      ? toCompactDescriptor(draftDescriptor)
      : undefined,
    riskAnalysis: await enhanceEServiceRiskAnalysisArray(
      eservice.riskAnalysis,
      producer.kind
    ),
    descriptors: notDraftDecriptors,
    isSignalHubEnabled: eservice.isSignalHubEnabled,
    isConsumerDelegable: eservice.isConsumerDelegable,
    isClientAccessDelegable: eservice.isClientAccessDelegable,
    personalData: eservice.personalData,
  };
}

export async function enhanceEServiceRiskAnalysisArray(
  riskAnalysisArray: catalogApi.EServiceRiskAnalysis[],
  producerTenantKind: tenantApi.TenantKind | undefined
): Promise<bffApi.EServiceRiskAnalysis[]> {
  return riskAnalysisArray.map((riskAnalysis) =>
    toBffCatalogApiEserviceRiskAnalysis(
      riskAnalysis,
      getRulesetExpiration(
        producerTenantKind,
        riskAnalysis.riskAnalysisForm.version
      )?.toJSON()
    )
  );
}

export function toEserviceAttribute(
  attributes: catalogApi.Attribute[]
): EServiceAttribute[] {
  return attributes.map((attribute) => ({
    ...attribute,
    id: unsafeBrandId(attribute.id),
  }));
}

export function descriptorAttributesFromApi(
  catalogApiDescriptorAttributes: catalogApi.EServiceDescriptor["attributes"]
): Descriptor["attributes"] {
  return {
    certified:
      catalogApiDescriptorAttributes.certified.map(toEserviceAttribute),
    declared: catalogApiDescriptorAttributes.declared.map(toEserviceAttribute),
    verified: catalogApiDescriptorAttributes.verified.map(toEserviceAttribute),
  };
}

function toBffCatalogApiDescriptorAttributeGroups(
  attributes: attributeRegistryApi.Attribute[],
  descriptorAttributesGroups: catalogApi.Attribute[][]
): bffApi.DescriptorAttribute[][] {
  return descriptorAttributesGroups.map((attributeGroup) =>
    attributeGroup.map((attribute) =>
      toBffCatalogApiDescriptorAttribute(attributes, attribute)
    )
  );
}

export function toBffCatalogApiDescriptorAttributes(
  attributes: attributeRegistryApi.Attribute[],
  descriptorAttributes: catalogApi.Attributes
): bffApi.DescriptorAttributes {
  return {
    certified: toBffCatalogApiDescriptorAttributeGroups(
      attributes,
      descriptorAttributes.certified
    ),
    declared: toBffCatalogApiDescriptorAttributeGroups(
      attributes,
      descriptorAttributes.declared
    ),
    verified: toBffCatalogApiDescriptorAttributeGroups(
      attributes,
      descriptorAttributes.verified
    ),
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
    templateVersionId: descriptor.templateVersionRef?.id,
  };
}

export function toCompactProducerDescriptor(
  descriptor: catalogApi.EServiceDescriptor,
  isRequesterProducerDelegate: boolean
): bffApi.CompactProducerDescriptor {
  return {
    id: descriptor.id,
    audience: descriptor.audience,
    state: descriptor.state,
    version: descriptor.version,
    requireCorrections:
      isRequesterProducerDelegate &&
      // The WAITING_FOR_APPROVAL state is not relevant for the producer descriptor's requireCorrections field,
      // so we don't consider it when determining whether corrections are required.
      descriptor.state === catalogApi.EServiceDescriptorState.Values.DRAFT &&
      descriptor.rejectionReasons &&
      descriptor.rejectionReasons.length > 0,
  };
}

export function toBffEServiceTemplateInstance(
  eservice: catalogApi.EService,
  producer: tenantApi.Tenant
): bffApi.EServiceTemplateInstance {
  const validDescriptors = [...eservice.descriptors]
    .filter(isValidDescriptor)
    .sort((a, b) => Number(a.version) - Number(b.version))
    .map(toCompactDescriptor);

  return {
    id: eservice.id,
    name: eservice.name,
    producerId: producer.id,
    producerName: producer.name,
    latestDescriptor: validDescriptors.at(-1),
    descriptors: validDescriptors,
  };
}

export function apiTechnologyToTechnology(
  input: catalogApi.EServiceTechnology
): Technology {
  return match<catalogApi.EServiceTechnology, Technology>(input)
    .with("REST", () => technology.rest)
    .with("SOAP", () => technology.soap)
    .exhaustive();
}

export function apiDescriptorStateToDescriptorState(
  input: catalogApi.EServiceDescriptorState
): DescriptorState {
  return match<catalogApi.EServiceDescriptorState, DescriptorState>(input)
    .with("DRAFT", () => descriptorState.draft)
    .with("PUBLISHED", () => descriptorState.published)
    .with("SUSPENDED", () => descriptorState.suspended)
    .with("DEPRECATED", () => descriptorState.deprecated)
    .with("ARCHIVED", () => descriptorState.archived)
    .with("WAITING_FOR_APPROVAL", () => descriptorState.waitingForApproval)
    .exhaustive();
}
