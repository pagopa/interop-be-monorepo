import {
  Document,
  attributeKind,
  Descriptor,
  EServiceAttribute,
  EService,
  RiskAnalysis,
  riskAnalysisAnswerKind,
  RiskAnalysisSingleAnswer,
  RiskAnalysisMultiAnswer,
  WithMetadata,
  unsafeBrandId,
  Technology,
  EServiceMode,
  DescriptorState,
  AgreementApprovalPolicy,
  stringToDate,
  EServiceTemplateVersionRef,
  AttributeKind,
  RiskAnalysisAnswerKind,
  EServiceId,
  EServiceTemplateId,
  RiskAnalysisForm,
} from "pagopa-interop-models";
import {
  EServiceDescriptorAttributeSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorInterfaceSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  EServiceDescriptorTemplateVersionRefSQL,
  EServiceItemsSQL,
  EServiceRiskAnalysisAnswerSQL,
  EServiceRiskAnalysisSQL,
  EServiceSQL,
  EServiceTemplateRiskAnalysisAnswerSQL,
  EServiceTemplateRiskAnalysisSQL,
  EServiceTemplateVersionDocumentSQL,
} from "pagopa-interop-readmodel-models";
import { match } from "ts-pattern";
import { makeUniqueKey, throwIfMultiple } from "../utils.js";

export const documentSQLtoDocument = (
  documentSQL:
    | EServiceDescriptorDocumentSQL
    | EServiceTemplateVersionDocumentSQL
): Document => ({
  id: unsafeBrandId(documentSQL.id),
  path: documentSQL.path,
  name: documentSQL.name,
  prettyName: documentSQL.prettyName,
  contentType: documentSQL.contentType,
  checksum: documentSQL.checksum,
  uploadDate: stringToDate(documentSQL.uploadDate),
});

// eslint-disable-next-line complexity
export const aggregateDescriptor = ({
  descriptorSQL,
  interfaceSQL,
  documentsSQL,
  attributesSQL,
  rejectionReasonsSQL,
  templateVersionRefSQL,
}: {
  descriptorSQL: EServiceDescriptorSQL;
  interfaceSQL: EServiceDescriptorInterfaceSQL | undefined;
  documentsSQL: EServiceDescriptorDocumentSQL[];
  attributesSQL: EServiceDescriptorAttributeSQL[];
  rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
  templateVersionRefSQL: EServiceDescriptorTemplateVersionRefSQL | undefined;
  // eslint-disable-next-line sonarjs/cognitive-complexity
}): Descriptor => {
  const interfaceDoc = interfaceSQL
    ? documentSQLtoDocument(interfaceSQL)
    : undefined;

  const {
    certified: certifiedAttributesSQL,
    verified: verifiedAttributesSQL,
    declared: declaredAttributesSQL,
  } = [...attributesSQL]
    .sort((attr1, attr2) => attr1.groupId - attr2.groupId)
    .reduce(
      (acc, attributeSQL) =>
        match(AttributeKind.parse(attributeSQL.kind))
          .with(attributeKind.certified, () => ({
            ...acc,
            certified: [...acc.certified, attributeSQL],
          }))
          .with(attributeKind.declared, () => ({
            ...acc,
            declared: [...acc.declared, attributeSQL],
          }))
          .with(attributeKind.verified, () => ({
            ...acc,
            verified: [...acc.verified, attributeSQL],
          }))
          .exhaustive(),
      {
        certified: new Array<EServiceDescriptorAttributeSQL>(),
        declared: new Array<EServiceDescriptorAttributeSQL>(),
        verified: new Array<EServiceDescriptorAttributeSQL>(),
      }
    );
  const certifiedAttributes = attributesSQLtoAttributes(certifiedAttributesSQL);
  const declaredAttributes = attributesSQLtoAttributes(declaredAttributesSQL);
  const verifiedAttributes = attributesSQLtoAttributes(verifiedAttributesSQL);

  const rejectionReasonsArray = rejectionReasonsSQL.map((rejectionReason) => ({
    rejectionReason: rejectionReason.rejectionReason,
    rejectedAt: stringToDate(rejectionReason.rejectedAt),
  }));
  const rejectionReasons =
    rejectionReasonsArray.length > 0 ? rejectionReasonsArray : undefined;

  const templateVersionRef: EServiceTemplateVersionRef | undefined =
    templateVersionRefSQL
      ? {
          id: unsafeBrandId(templateVersionRefSQL.eserviceTemplateVersionId),
          ...(templateVersionRefSQL.contactName ||
          templateVersionRefSQL.contactEmail ||
          templateVersionRefSQL.contactUrl ||
          templateVersionRefSQL.termsAndConditionsUrl
            ? {
                interfaceMetadata: {
                  ...(templateVersionRefSQL.contactName
                    ? { contactName: templateVersionRefSQL.contactName }
                    : {}),
                  ...(templateVersionRefSQL.contactEmail
                    ? { contactEmail: templateVersionRefSQL.contactEmail }
                    : {}),
                  ...(templateVersionRefSQL.contactUrl
                    ? { contactUrl: templateVersionRefSQL.contactUrl }
                    : {}),
                  ...(templateVersionRefSQL.termsAndConditionsUrl
                    ? {
                        termsAndConditionsUrl:
                          templateVersionRefSQL.termsAndConditionsUrl,
                      }
                    : {}),
                },
              }
            : {}),
        }
      : undefined;

  return {
    id: unsafeBrandId(descriptorSQL.id),
    version: descriptorSQL.version,
    docs: [...documentsSQL]
      .sort((doc1, doc2) => (doc1.name < doc2.name ? -1 : 0))
      .map(documentSQLtoDocument),
    state: DescriptorState.parse(descriptorSQL.state),
    audience: descriptorSQL.audience,
    voucherLifespan: descriptorSQL.voucherLifespan,
    dailyCallsPerConsumer: descriptorSQL.dailyCallsPerConsumer,
    dailyCallsTotal: descriptorSQL.dailyCallsTotal,
    createdAt: stringToDate(descriptorSQL.createdAt),
    serverUrls: descriptorSQL.serverUrls,
    attributes: {
      certified: certifiedAttributes,
      declared: declaredAttributes,
      verified: verifiedAttributes,
    },
    ...(interfaceDoc ? { interface: interfaceDoc } : {}),
    ...(descriptorSQL.description
      ? { description: descriptorSQL.description }
      : {}),
    ...(descriptorSQL.agreementApprovalPolicy
      ? {
          agreementApprovalPolicy: AgreementApprovalPolicy.parse(
            descriptorSQL.agreementApprovalPolicy
          ),
        }
      : {}),
    ...(descriptorSQL.publishedAt
      ? { publishedAt: stringToDate(descriptorSQL.publishedAt) }
      : {}),
    ...(descriptorSQL.suspendedAt
      ? { suspendedAt: stringToDate(descriptorSQL.suspendedAt) }
      : {}),
    ...(descriptorSQL.deprecatedAt
      ? { deprecatedAt: stringToDate(descriptorSQL.deprecatedAt) }
      : {}),
    ...(descriptorSQL.archivedAt
      ? { archivedAt: stringToDate(descriptorSQL.archivedAt) }
      : {}),
    ...(rejectionReasons ? { rejectionReasons } : {}),
    ...(templateVersionRef ? { templateVersionRef } : {}),
  };
};

export const aggregateEservice = ({
  eserviceSQL,
  riskAnalysesSQL,
  riskAnalysisAnswersSQL,
  descriptorsSQL,
  interfacesSQL,
  attributesSQL,
  documentsSQL,
  rejectionReasonsSQL,
  templateVersionRefsSQL,
}: EServiceItemsSQL): WithMetadata<EService> => {
  const interfacesSQLByDescriptorId = interfacesSQL.reduce((acc, i) => {
    acc.set(i.descriptorId, i);
    return acc;
  }, new Map<string, EServiceDescriptorInterfaceSQL>());
  const documentsSQLByDescriptorId = documentsSQL.reduce((acc, d) => {
    acc.set(d.descriptorId, [...(acc.get(d.descriptorId) || []), d]);
    return acc;
  }, new Map<string, EServiceDescriptorDocumentSQL[]>());
  const attributesSQLByDescriptorId = attributesSQL.reduce((acc, a) => {
    acc.set(a.descriptorId, [...(acc.get(a.descriptorId) || []), a]);
    return acc;
  }, new Map<string, EServiceDescriptorAttributeSQL[]>());
  const rejectionReasonsSQLByDescriptorId = rejectionReasonsSQL.reduce(
    (acc, r) => {
      acc.set(r.descriptorId, [...(acc.get(r.descriptorId) || []), r]);
      return acc;
    },
    new Map<string, EServiceDescriptorRejectionReasonSQL[]>()
  );
  const templateVersionRefsSQLByDescriptorId = templateVersionRefsSQL.reduce(
    (acc, t) => {
      acc.set(t.descriptorId, t);
      return acc;
    },
    new Map<string, EServiceDescriptorTemplateVersionRefSQL>()
  );
  const descriptors = [...descriptorsSQL]
    .sort((d1, d2) => Number(d1.version) - Number(d2.version))
    .map((descriptorSQL) =>
      aggregateDescriptor({
        descriptorSQL,
        interfaceSQL: interfacesSQLByDescriptorId.get(descriptorSQL.id),
        documentsSQL: documentsSQLByDescriptorId.get(descriptorSQL.id) || [],
        attributesSQL: attributesSQLByDescriptorId.get(descriptorSQL.id) || [],
        rejectionReasonsSQL:
          rejectionReasonsSQLByDescriptorId.get(descriptorSQL.id) || [],
        templateVersionRefSQL: templateVersionRefsSQLByDescriptorId.get(
          descriptorSQL.id
        ),
      })
    );

  const riskAnalysisAnswersSQLByFormId = riskAnalysisAnswersSQL.reduce(
    (acc, answer) => {
      const formId = answer.riskAnalysisFormId;
      acc.set(formId, [...(acc.get(formId) || []), answer]);
      return acc;
    },
    new Map<string, EServiceRiskAnalysisAnswerSQL[]>()
  );
  const riskAnalysis = riskAnalysesSQL.map((ra) =>
    aggregateRiskAnalysis(
      ra,
      riskAnalysisAnswersSQLByFormId.get(ra.riskAnalysisFormId) || []
    )
  );

  const eservice: EService = {
    id: unsafeBrandId(eserviceSQL.id),
    name: eserviceSQL.name,
    createdAt: stringToDate(eserviceSQL.createdAt),
    producerId: unsafeBrandId(eserviceSQL.producerId),
    description: eserviceSQL.description,
    technology: Technology.parse(eserviceSQL.technology),
    descriptors,
    riskAnalysis,
    mode: EServiceMode.parse(eserviceSQL.mode),
    ...(eserviceSQL.isClientAccessDelegable !== null
      ? { isClientAccessDelegable: eserviceSQL.isClientAccessDelegable }
      : {}),
    ...(eserviceSQL.isConsumerDelegable !== null
      ? { isConsumerDelegable: eserviceSQL.isConsumerDelegable }
      : {}),
    ...(eserviceSQL.isSignalHubEnabled !== null
      ? { isSignalHubEnabled: eserviceSQL.isSignalHubEnabled }
      : {}),
    ...(eserviceSQL.templateId
      ? {
          templateId: unsafeBrandId<EServiceTemplateId>(eserviceSQL.templateId),
        }
      : {}),
    ...(eserviceSQL.personalData !== null
      ? {
          personalData: eserviceSQL.personalData,
        }
      : {}),
  };
  return {
    data: eservice,
    metadata: { version: eserviceSQL.metadataVersion },
  };
};

export const aggregateEserviceArray = ({
  eservicesSQL,
  riskAnalysesSQL,
  riskAnalysisAnswersSQL,
  descriptorsSQL,
  attributesSQL,
  interfacesSQL,
  documentsSQL,
  rejectionReasonsSQL,
  templateVersionRefsSQL,
}: {
  eservicesSQL: EServiceSQL[];
  riskAnalysesSQL: EServiceRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
  descriptorsSQL: EServiceDescriptorSQL[];
  attributesSQL: EServiceDescriptorAttributeSQL[];
  interfacesSQL: EServiceDescriptorInterfaceSQL[];
  documentsSQL: EServiceDescriptorDocumentSQL[];
  rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
  templateVersionRefsSQL: EServiceDescriptorTemplateVersionRefSQL[];
}): Array<WithMetadata<EService>> => {
  const riskAnalysesSQLByEServiceId =
    createEServiceSQLPropertyMap(riskAnalysesSQL);
  const riskAnalysisAnswersSQLByEServiceId = createEServiceSQLPropertyMap(
    riskAnalysisAnswersSQL
  );
  const descriptorsSQLByEServiceId =
    createEServiceSQLPropertyMap(descriptorsSQL);
  const interfacesSQLByEServiceId = createEServiceSQLPropertyMap(interfacesSQL);
  const documentsSQLByEServiceId = createEServiceSQLPropertyMap(documentsSQL);
  const attributesSQLByEServiceId = createEServiceSQLPropertyMap(attributesSQL);
  const rejectionReasonsSQLByEServiceId =
    createEServiceSQLPropertyMap(rejectionReasonsSQL);
  const templateVersionRefsSQLByEServiceId = createEServiceSQLPropertyMap(
    templateVersionRefsSQL
  );

  return eservicesSQL.map((eserviceSQL) => {
    const eserviceId = unsafeBrandId<EServiceId>(eserviceSQL.id);
    return aggregateEservice({
      eserviceSQL,
      riskAnalysesSQL: riskAnalysesSQLByEServiceId.get(eserviceId) || [],
      riskAnalysisAnswersSQL:
        riskAnalysisAnswersSQLByEServiceId.get(eserviceId) || [],
      descriptorsSQL: descriptorsSQLByEServiceId.get(eserviceId) || [],
      interfacesSQL: interfacesSQLByEServiceId.get(eserviceId) || [],
      documentsSQL: documentsSQLByEServiceId.get(eserviceId) || [],
      attributesSQL: attributesSQLByEServiceId.get(eserviceId) || [],
      rejectionReasonsSQL:
        rejectionReasonsSQLByEServiceId.get(eserviceId) || [],
      templateVersionRefsSQL:
        templateVersionRefsSQLByEServiceId.get(eserviceId) || [],
    });
  });
};

const createEServiceSQLPropertyMap = <
  T extends
    | EServiceRiskAnalysisSQL
    | EServiceRiskAnalysisAnswerSQL
    | EServiceDescriptorSQL
    | EServiceDescriptorInterfaceSQL
    | EServiceDescriptorDocumentSQL
    | EServiceDescriptorAttributeSQL
    | EServiceDescriptorRejectionReasonSQL
    | EServiceDescriptorTemplateVersionRefSQL
>(
  items: T[]
): Map<EServiceId, T[]> =>
  items.reduce((acc, item) => {
    const eserviceId = unsafeBrandId<EServiceId>(item.eserviceId);
    const values = acc.get(eserviceId) || [];
    // eslint-disable-next-line functional/immutable-data
    values.push(item);
    acc.set(eserviceId, values);

    return acc;
  }, new Map<EServiceId, T[]>());

export const aggregateRiskAnalysisForm = (
  riskAnalysisSQL: EServiceRiskAnalysisSQL | EServiceTemplateRiskAnalysisSQL,
  answers:
    | EServiceRiskAnalysisAnswerSQL[]
    | EServiceTemplateRiskAnalysisAnswerSQL[]
): RiskAnalysisForm => {
  const { single: singleAnswers, multi: multiAnswers } = answers.reduce(
    (acc, answer) =>
      match(RiskAnalysisAnswerKind.parse(answer.kind))
        .with(riskAnalysisAnswerKind.single, () => ({
          ...acc,
          single: [
            ...acc.single,
            {
              id: unsafeBrandId(answer.id),
              key: answer.key,
              value: answer.value.length > 0 ? answer.value[0] : undefined,
            } satisfies RiskAnalysisSingleAnswer,
          ],
        }))
        .with(riskAnalysisAnswerKind.multi, () => ({
          ...acc,
          multi: [
            ...acc.multi,
            {
              id: unsafeBrandId(answer.id),
              key: answer.key,
              values: answer.value,
            } satisfies RiskAnalysisMultiAnswer,
          ],
        }))
        .exhaustive(),
    {
      single: Array<RiskAnalysisSingleAnswer>(),
      multi: Array<RiskAnalysisMultiAnswer>(),
    }
  );

  return {
    version: riskAnalysisSQL.riskAnalysisFormVersion,
    id: unsafeBrandId(riskAnalysisSQL.riskAnalysisFormId),
    singleAnswers,
    multiAnswers,
  };
};

export const aggregateRiskAnalysis = (
  riskAnalysisSQL: EServiceRiskAnalysisSQL,
  answers:
    | EServiceRiskAnalysisAnswerSQL[]
    | EServiceTemplateRiskAnalysisAnswerSQL[]
): RiskAnalysis => ({
  id: unsafeBrandId(riskAnalysisSQL.id),
  name: riskAnalysisSQL.name,
  createdAt: stringToDate(riskAnalysisSQL.createdAt),
  riskAnalysisForm: aggregateRiskAnalysisForm(riskAnalysisSQL, answers),
});

export const attributesSQLtoAttributes = (
  attributesSQL: EServiceDescriptorAttributeSQL[]
): EServiceAttribute[][] => {
  const attributesMap = new Map<number, EServiceAttribute[]>();
  attributesSQL.forEach((current) => {
    const currentAttribute: EServiceAttribute = {
      id: unsafeBrandId(current.attributeId),
      explicitAttributeVerification: current.explicitAttributeVerification,
      dailyCallsPerConsumer: current.dailyCallsPerConsumer ?? undefined,
    };
    const group = attributesMap.get(current.groupId);
    if (group) {
      attributesMap.set(current.groupId, [...group, currentAttribute]);
    } else {
      attributesMap.set(current.groupId, [currentAttribute]);
    }
  });

  return Array.from(attributesMap.values());
};

export const toEServiceAggregator = (
  queryRes: Array<{
    eservice: EServiceSQL;
    descriptor: EServiceDescriptorSQL | null;
    interface: EServiceDescriptorInterfaceSQL | null;
    document: EServiceDescriptorDocumentSQL | null;
    attribute: EServiceDescriptorAttributeSQL | null;
    rejection: EServiceDescriptorRejectionReasonSQL | null;
    riskAnalysis: EServiceRiskAnalysisSQL | null;
    riskAnalysisAnswer: EServiceRiskAnalysisAnswerSQL | null;
    templateVersionRef: EServiceDescriptorTemplateVersionRefSQL | null;
  }>
): EServiceItemsSQL => {
  const {
    eservicesSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
    descriptorsSQL,
    interfacesSQL,
    documentsSQL,
    attributesSQL,
    rejectionReasonsSQL,
    templateVersionRefsSQL,
  } = toEServiceAggregatorArray(queryRes);

  throwIfMultiple(eservicesSQL, "e-service");

  return {
    eserviceSQL: eservicesSQL[0],
    descriptorsSQL,
    interfacesSQL,
    documentsSQL,
    attributesSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
    rejectionReasonsSQL,
    templateVersionRefsSQL,
  };
};

export const toEServiceAggregatorArray = (
  queryRes: Array<{
    eservice: EServiceSQL;
    descriptor: EServiceDescriptorSQL | null;
    interface: EServiceDescriptorInterfaceSQL | null;
    document: EServiceDescriptorDocumentSQL | null;
    attribute: EServiceDescriptorAttributeSQL | null;
    rejection: EServiceDescriptorRejectionReasonSQL | null;
    riskAnalysis: EServiceRiskAnalysisSQL | null;
    riskAnalysisAnswer: EServiceRiskAnalysisAnswerSQL | null;
    templateVersionRef: EServiceDescriptorTemplateVersionRefSQL | null;
  }>
): {
  eservicesSQL: EServiceSQL[];
  riskAnalysesSQL: EServiceRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
  descriptorsSQL: EServiceDescriptorSQL[];
  attributesSQL: EServiceDescriptorAttributeSQL[];
  interfacesSQL: EServiceDescriptorInterfaceSQL[];
  documentsSQL: EServiceDescriptorDocumentSQL[];
  rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
  templateVersionRefsSQL: EServiceDescriptorTemplateVersionRefSQL[];
} => {
  const eserviceIdSet = new Set<string>();
  const eservicesSQL: EServiceSQL[] = [];

  const descriptorIdSet = new Set<string>();
  const descriptorsSQL: EServiceDescriptorSQL[] = [];

  const interfaceIdSet = new Set<string>();
  const interfacesSQL: EServiceDescriptorInterfaceSQL[] = [];

  const documentIdSet = new Set<string>();
  const documentsSQL: EServiceDescriptorDocumentSQL[] = [];

  const attributeIdSet = new Set<string>();
  const attributesSQL: EServiceDescriptorAttributeSQL[] = [];

  const riskAnalysisIdSet = new Set<string>();
  const riskAnalysesSQL: EServiceRiskAnalysisSQL[] = [];

  const riskAnalysisAnswerIdSet = new Set<string>();
  const riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[] = [];

  const rejectionReasonsSet = new Set<string>();
  const rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[] = [];

  const templateVersionRefIdSet = new Set<string>();
  const templateVersionRefsSQL: EServiceDescriptorTemplateVersionRefSQL[] = [];

  // eslint-disable-next-line sonarjs/cognitive-complexity, complexity
  queryRes.forEach((row) => {
    const eserviceSQL = row.eservice;

    if (!eserviceIdSet.has(eserviceSQL.id)) {
      eserviceIdSet.add(eserviceSQL.id);
      // eslint-disable-next-line functional/immutable-data
      eservicesSQL.push(eserviceSQL);
    }

    const descriptorSQL = row.descriptor;

    if (descriptorSQL) {
      if (!descriptorIdSet.has(descriptorSQL.id)) {
        descriptorIdSet.add(descriptorSQL.id);
        // eslint-disable-next-line functional/immutable-data
        descriptorsSQL.push(descriptorSQL);
      }

      const interfaceSQL = row.interface;

      if (interfaceSQL && !interfaceIdSet.has(interfaceSQL.id)) {
        interfaceIdSet.add(interfaceSQL.id);
        // eslint-disable-next-line functional/immutable-data
        interfacesSQL.push(interfaceSQL);
      }

      const documentSQL = row.document;

      if (documentSQL && !documentIdSet.has(documentSQL.id)) {
        documentIdSet.add(documentSQL.id);
        // eslint-disable-next-line functional/immutable-data
        documentsSQL.push(documentSQL);
      }

      const attributeSQL = row.attribute;
      const attributePK = attributeSQL
        ? makeUniqueKey([
            attributeSQL.attributeId,
            attributeSQL.descriptorId,
            attributeSQL.groupId.toString(),
          ])
        : undefined;
      if (attributeSQL && attributePK && !attributeIdSet.has(attributePK)) {
        attributeIdSet.add(attributePK);
        // eslint-disable-next-line functional/immutable-data
        attributesSQL.push(attributeSQL);
      }

      const rejectionReasonSQL = row.rejection;
      const rejectionReasonPK = rejectionReasonSQL
        ? makeUniqueKey([
            rejectionReasonSQL.descriptorId,
            rejectionReasonSQL.rejectedAt,
          ])
        : undefined;
      if (
        rejectionReasonSQL &&
        rejectionReasonPK &&
        !rejectionReasonsSet.has(rejectionReasonPK)
      ) {
        rejectionReasonsSet.add(rejectionReasonPK);
        // eslint-disable-next-line functional/immutable-data
        rejectionReasonsSQL.push(rejectionReasonSQL);
      }

      const templateVersionRefSQL = row.templateVersionRef;
      const templateVersionRefPK = templateVersionRefSQL
        ? makeUniqueKey([
            templateVersionRefSQL.eserviceTemplateVersionId,
            templateVersionRefSQL.descriptorId,
          ])
        : undefined;
      if (
        templateVersionRefSQL &&
        templateVersionRefPK &&
        !templateVersionRefIdSet.has(templateVersionRefPK)
      ) {
        templateVersionRefIdSet.add(templateVersionRefPK);
        // eslint-disable-next-line functional/immutable-data
        templateVersionRefsSQL.push(templateVersionRefSQL);
      }
    }

    const riskAnalysisSQL = row.riskAnalysis;
    const riskAnalysisPK = riskAnalysisSQL
      ? makeUniqueKey([riskAnalysisSQL.id, riskAnalysisSQL.eserviceId])
      : undefined;
    if (riskAnalysisSQL && riskAnalysisPK) {
      if (!riskAnalysisIdSet.has(riskAnalysisPK)) {
        riskAnalysisIdSet.add(riskAnalysisPK);
        // eslint-disable-next-line functional/immutable-data
        riskAnalysesSQL.push(riskAnalysisSQL);
      }

      const riskAnalysisAnswerSQL = row.riskAnalysisAnswer;
      const riskAnalysisAnswerPK = riskAnalysisAnswerSQL
        ? makeUniqueKey([
            riskAnalysisAnswerSQL.id,
            riskAnalysisAnswerSQL.eserviceId,
          ])
        : undefined;
      if (
        riskAnalysisAnswerSQL &&
        riskAnalysisAnswerPK &&
        !riskAnalysisAnswerIdSet.has(riskAnalysisAnswerPK)
      ) {
        riskAnalysisAnswerIdSet.add(riskAnalysisAnswerPK);
        // eslint-disable-next-line functional/immutable-data
        riskAnalysisAnswersSQL.push(riskAnalysisAnswerSQL);
      }
    }
  });

  return {
    eservicesSQL,
    descriptorsSQL,
    interfacesSQL,
    documentsSQL,
    attributesSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
    rejectionReasonsSQL,
    templateVersionRefsSQL,
  };
};
