/* eslint-disable functional/immutable-data */
/* eslint-disable max-params */
import { tenantMailKind, unsafeBrandId } from "pagopa-interop-models";
import { attributeNotExists } from "../../domain/errors.js";
import {
  AgreementProcessApiAgreement,
  agreementApiState,
} from "../agreementTypes.js";
import { AttributeProcessApi } from "../attributeTypes.js";
import {
  BffCatalogApiCompactDescriptor,
  BffCatalogApiDescriptorAttribute,
  BffCatalogApiEService,
  BffCatalogApiEServiceDoc,
  BffCatalogApiProducerDescriptorEService,
  BffCatalogApiProducerEServiceRiskAnalysis,
  BffCatalogApiProducerRiskAnalysisForm,
  BffGetCatalogApiQueryParam,
} from "../bffTypes.js";
import {
  CatalogProcessApiQueryParam,
  EServiceCatalogProcessApi,
  EServiceCatalogProcessApiAttribute,
  EServiceCatalogProcessApiDescriptor,
  EServiceCatalogProcessApiDocument,
  EServiceCatalogProcessApiRiskAnalysis,
  descriptorApiState,
} from "../catalogTypes.js";
import { TenantProcessApiResponse } from "../tenantTypes.js";

export function toEserviceCatalogProcessQueryParams(
  queryParams: BffGetCatalogApiQueryParam
): CatalogProcessApiQueryParam {
  return {
    ...queryParams,
    producersIds: queryParams.producersIds
      ? queryParams.producersIds[0]
      : undefined,
    states: queryParams.states ? queryParams.states[0] : undefined,
    attributesIds: queryParams.attributesIds
      ? queryParams.attributesIds[0]
      : undefined,
    agreementStates: queryParams.agreementStates
      ? queryParams.agreementStates[0]
      : undefined,
  };
}

export function toBffCatalogApiEService(
  eservice: EServiceCatalogProcessApi,
  producerTenant: TenantProcessApiResponse,
  hasCertifiedAttributes: boolean,
  isRequesterEqProducer: boolean,
  activeDescriptor?: EServiceCatalogProcessApiDescriptor,
  agreement?: AgreementProcessApiAgreement
): BffCatalogApiEService {
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

export function toBffCatalogApiDescriptorAttribute(
  attributes: AttributeProcessApi[],
  descriptorAttributes: EServiceCatalogProcessApiAttribute[]
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
  document: EServiceCatalogProcessApiDocument
): BffCatalogApiEServiceDoc {
  return {
    id: document.id,
    name: document.name,
    contentType: document.contentType,
    prettyName: document.prettyName,
  };
}

export function toBffCatalogApiEserviceRiskAnalysis(
  riskAnalysis: EServiceCatalogProcessApiRiskAnalysis
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
  eservice: EServiceCatalogProcessApi,
  producer: TenantProcessApiResponse
): BffCatalogApiProducerDescriptorEService {
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
