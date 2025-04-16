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
  EServiceTemplateRef,
  AttributeKind,
  RiskAnalysisAnswerKind,
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
  EServiceTemplateRefSQL,
  EServiceTemplateRiskAnalysisAnswerSQL,
  EServiceTemplateRiskAnalysisSQL,
  EServiceTemplateVersionAttributeSQL,
  EServiceTemplateVersionDocumentSQL,
} from "pagopa-interop-readmodel-models";
import { match } from "ts-pattern";
import { makeUniqueKey } from "../utils.js";

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
    verified: declaredAttributesSQL,
    declared: verifiedAttributesSQL,
  } = attributesSQL.reduce(
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
  templateRefSQL,
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
  const descriptors = descriptorsSQL.map((descriptorSQL) =>
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

  const templateRef: EServiceTemplateRef | undefined = templateRefSQL
    ? {
        id: unsafeBrandId(templateRefSQL.eserviceTemplateId),
        ...(templateRefSQL.instanceLabel
          ? { instanceLabel: templateRefSQL.instanceLabel }
          : {}),
      }
    : undefined;

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
    ...(templateRef ? { templateRef } : {}),
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
  templateRefsSQL,
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
  templateRefsSQL: EServiceTemplateRefSQL[];
  templateVersionRefsSQL: EServiceDescriptorTemplateVersionRefSQL[];
}): Array<WithMetadata<EService>> =>
  eservicesSQL.map((eserviceSQL) =>
    aggregateEservice({
      eserviceSQL,
      riskAnalysesSQL: riskAnalysesSQL.filter(
        (ra) => ra.eserviceId === eserviceSQL.id
      ),
      riskAnalysisAnswersSQL: riskAnalysisAnswersSQL.filter(
        (answer) => answer.eserviceId === eserviceSQL.id
      ),
      descriptorsSQL: descriptorsSQL.filter(
        (d) => d.eserviceId === eserviceSQL.id
      ),
      interfacesSQL: interfacesSQL.filter(
        (descriptorInterface) =>
          descriptorInterface.eserviceId === eserviceSQL.id
      ),
      documentsSQL: documentsSQL.filter(
        (doc) => doc.eserviceId === eserviceSQL.id
      ),
      attributesSQL: attributesSQL.filter(
        (attr) => attr.eserviceId === eserviceSQL.id
      ),
      rejectionReasonsSQL: rejectionReasonsSQL.filter(
        (rejectionReason) => rejectionReason.eserviceId === eserviceSQL.id
      ),
      templateRefSQL: templateRefsSQL.find(
        (t) => t.eserviceId === eserviceSQL.id
      ),
      templateVersionRefsSQL: templateVersionRefsSQL.filter(
        (t) => t.eserviceId === eserviceSQL.id
      ),
    })
  );

export const aggregateRiskAnalysis = (
  riskAnalysisSQL: EServiceRiskAnalysisSQL | EServiceTemplateRiskAnalysisSQL,
  answers:
    | EServiceRiskAnalysisAnswerSQL[]
    | EServiceTemplateRiskAnalysisAnswerSQL[]
): RiskAnalysis => {
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

  const riskAnalysis: RiskAnalysis = {
    id: unsafeBrandId(riskAnalysisSQL.id),
    name: riskAnalysisSQL.name,
    createdAt: stringToDate(riskAnalysisSQL.createdAt),
    riskAnalysisForm: {
      version: riskAnalysisSQL.riskAnalysisFormVersion,
      id: unsafeBrandId(riskAnalysisSQL.riskAnalysisFormId),
      singleAnswers,
      multiAnswers,
    },
  };
  return riskAnalysis;
};

export const attributesSQLtoAttributes = (
  attributesSQL:
    | EServiceDescriptorAttributeSQL[]
    | EServiceTemplateVersionAttributeSQL[]
): EServiceAttribute[][] => {
  const attributesMap = new Map<number, EServiceAttribute[]>();
  attributesSQL.forEach((current) => {
    const currentAttribute: EServiceAttribute = {
      id: unsafeBrandId(current.attributeId),
      explicitAttributeVerification: current.explicitAttributeVerification,
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
    templateRef: EServiceTemplateRefSQL | null;
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
    templateRefsSQL,
    templateVersionRefsSQL,
  } = toEServiceAggregatorArray(queryRes);

  return {
    eserviceSQL: eservicesSQL[0],
    descriptorsSQL,
    interfacesSQL,
    documentsSQL,
    attributesSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
    rejectionReasonsSQL,
    templateRefSQL: templateRefsSQL[0],
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
    templateRef: EServiceTemplateRefSQL | null;
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
  templateRefsSQL: EServiceTemplateRefSQL[];
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

  const templateRefIdSet = new Set<string>();
  const templateRefsSQL: EServiceTemplateRefSQL[] = [];

  const templateVersionRefIdSet = new Set<string>();
  const templateVersionRefsSQL: EServiceDescriptorTemplateVersionRefSQL[] = [];

  // eslint-disable-next-line sonarjs/cognitive-complexity
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
      if (
        attributeSQL &&
        !attributeIdSet.has(
          makeUniqueKey([
            attributeSQL.attributeId,
            attributeSQL.descriptorId,
            attributeSQL.groupId.toString(),
          ])
        )
      ) {
        attributeIdSet.add(
          makeUniqueKey([
            attributeSQL.attributeId,
            attributeSQL.descriptorId,
            attributeSQL.groupId.toString(),
          ])
        );
        // eslint-disable-next-line functional/immutable-data
        attributesSQL.push(attributeSQL);
      }

      const rejectionReasonSQL = row.rejection;
      if (
        rejectionReasonSQL &&
        !rejectionReasonsSet.has(
          makeUniqueKey([
            rejectionReasonSQL.descriptorId,
            rejectionReasonSQL.rejectedAt,
          ])
        )
      ) {
        rejectionReasonsSet.add(
          makeUniqueKey([
            rejectionReasonSQL.descriptorId,
            rejectionReasonSQL.rejectedAt,
          ])
        );
        // eslint-disable-next-line functional/immutable-data
        rejectionReasonsSQL.push(rejectionReasonSQL);
      }

      const templateVersionRefSQL = row.templateVersionRef;
      if (
        templateVersionRefSQL &&
        !templateVersionRefIdSet.has(
          makeUniqueKey([
            templateVersionRefSQL.eserviceTemplateVersionId,
            templateVersionRefSQL.descriptorId,
          ])
        )
      ) {
        templateVersionRefIdSet.add(
          makeUniqueKey([
            templateVersionRefSQL.eserviceTemplateVersionId,
            templateVersionRefSQL.descriptorId,
          ])
        );
        // eslint-disable-next-line functional/immutable-data
        templateVersionRefsSQL.push(templateVersionRefSQL);
      }
    }

    const riskAnalysisSQL = row.riskAnalysis;
    if (riskAnalysisSQL) {
      if (!riskAnalysisIdSet.has(riskAnalysisSQL.id)) {
        riskAnalysisIdSet.add(riskAnalysisSQL.id);
        // eslint-disable-next-line functional/immutable-data
        riskAnalysesSQL.push(riskAnalysisSQL);
      }

      const riskAnalysisAnswerSQL = row.riskAnalysisAnswer;
      if (
        riskAnalysisAnswerSQL &&
        !riskAnalysisAnswerIdSet.has(riskAnalysisAnswerSQL.id)
      ) {
        riskAnalysisAnswerIdSet.add(riskAnalysisAnswerSQL.id);
        // eslint-disable-next-line functional/immutable-data
        riskAnalysisAnswersSQL.push(riskAnalysisAnswerSQL);
      }
    }

    const templateRefSQL = row.templateRef;
    if (
      templateRefSQL &&
      !templateRefIdSet.has(
        makeUniqueKey([
          templateRefSQL.eserviceTemplateId,
          templateRefSQL.eserviceId,
        ])
      )
    ) {
      templateRefIdSet.add(
        makeUniqueKey([
          templateRefSQL.eserviceTemplateId,
          templateRefSQL.eserviceId,
        ])
      );
      // eslint-disable-next-line functional/immutable-data
      templateRefsSQL.push(templateRefSQL);
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
    templateRefsSQL,
    templateVersionRefsSQL,
  };
};
