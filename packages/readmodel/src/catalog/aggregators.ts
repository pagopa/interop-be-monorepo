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
  RiskAnalysisMultiAnswerId,
  WithMetadata,
  unsafeBrandId,
  Technology,
  EServiceMode,
  DescriptorState,
  AgreementApprovalPolicy,
  stringToDate,
} from "pagopa-interop-models";
import {
  EServiceDescriptorAttributeSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorInterfaceSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  EServiceItemsSQL,
  EServiceRiskAnalysisAnswerSQL,
  EServiceRiskAnalysisSQL,
  EServiceSQL,
  // EServiceTemplateBindingSQL,
} from "pagopa-interop-readmodel-models";

export const documentSQLtoDocument = (
  documentSQL: EServiceDescriptorDocumentSQL
): Document => ({
  id: unsafeBrandId(documentSQL.id),
  path: documentSQL.path,
  name: documentSQL.name,
  prettyName: documentSQL.prettyName,
  contentType: documentSQL.contentType,
  checksum: documentSQL.checksum,
  uploadDate: stringToDate(documentSQL.uploadDate),
});

export const aggregateDescriptor = ({
  descriptorSQL,
  interfaceSQL,
  documentsSQL,
  attributesSQL,
  rejectionReasonsSQL,
}: {
  descriptorSQL: EServiceDescriptorSQL;
  interfaceSQL: EServiceDescriptorInterfaceSQL | undefined;
  documentsSQL: EServiceDescriptorDocumentSQL[];
  attributesSQL: EServiceDescriptorAttributeSQL[];
  rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
}): Descriptor => {
  const parsedInterface = interfaceSQL
    ? documentSQLtoDocument(interfaceSQL)
    : undefined;

  const certifiedAttributesSQL = attributesSQL.filter(
    (a) => a.kind === attributeKind.certified
  );
  const declaredAttributesSQL = attributesSQL.filter(
    (a) => a.kind === attributeKind.declared
  );
  const verifiedAttributesSQL = attributesSQL.filter(
    (a) => a.kind === attributeKind.verified
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

  return {
    id: unsafeBrandId(descriptorSQL.id),
    version: descriptorSQL.version,
    docs: documentsSQL.map(documentSQLtoDocument),
    state: DescriptorState.parse(descriptorSQL.state), // TODO use safeParse?
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
    ...(parsedInterface ? { interface: parsedInterface } : {}),
    ...(descriptorSQL.description
      ? { description: descriptorSQL.description }
      : {}),
    ...(descriptorSQL.agreementApprovalPolicy
      ? {
          agreementApprovalPolicy: AgreementApprovalPolicy.parse(
            descriptorSQL.agreementApprovalPolicy
          ), // TODO use safeParse?
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
}: // TODO add template
EServiceItemsSQL): WithMetadata<EService> => {
  const descriptors = descriptorsSQL.map((descriptorSQL) =>
    aggregateDescriptor({
      descriptorSQL,
      interfaceSQL: interfacesSQL.find(
        (descriptorInterface) =>
          descriptorInterface.descriptorId === descriptorSQL.id
      ),
      documentsSQL: documentsSQL.filter(
        (d) => d.descriptorId === descriptorSQL.id
      ),
      attributesSQL: attributesSQL.filter(
        (a) => a.descriptorId === descriptorSQL.id
      ),
      rejectionReasonsSQL: rejectionReasonsSQL.filter(
        (r) => r.descriptorId === descriptorSQL.id
      ),
    })
  );

  const riskAnalysis = riskAnalysesSQL.map((ra) =>
    aggregateRiskAnalysis(
      ra,
      riskAnalysisAnswersSQL.filter(
        (answer) => answer.riskAnalysisFormId === ra.riskAnalysisFormId
      )
    )
  );
  const eservice: EService = {
    id: unsafeBrandId(eserviceSQL.id),
    name: eserviceSQL.name,
    createdAt: stringToDate(eserviceSQL.createdAt),
    producerId: unsafeBrandId(eserviceSQL.producerId),
    description: eserviceSQL.description,
    technology: Technology.parse(eserviceSQL.technology), // TODO use safeParse?
    descriptors,
    riskAnalysis,
    mode: EServiceMode.parse(eserviceSQL.mode), // TODO use safeParse?
    ...(eserviceSQL.isClientAccessDelegable
      ? { isClientAccessDelegable: true }
      : {}),
    ...(eserviceSQL.isConsumerDelegable ? { isConsumerDelegable: true } : {}),
    ...(eserviceSQL.isSignalHubEnabled ? { isSignalHubEnabled: true } : {}),
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
}: {
  eservicesSQL: EServiceSQL[];
  riskAnalysesSQL: EServiceRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
  descriptorsSQL: EServiceDescriptorSQL[];
  attributesSQL: EServiceDescriptorAttributeSQL[];
  interfacesSQL: EServiceDescriptorInterfaceSQL[];
  documentsSQL: EServiceDescriptorDocumentSQL[];
  rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
  // templateBindingSQL: EServiceTemplateBindingSQL[];
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
      // templateBindingSQL: [],
    })
  );

export const aggregateRiskAnalysis = (
  riskAnalysisSQL: EServiceRiskAnalysisSQL,
  answers: EServiceRiskAnalysisAnswerSQL[]
): RiskAnalysis => {
  const singleAnswers = answers
    .filter((a) => a.kind === riskAnalysisAnswerKind.single)
    .map(
      (a): RiskAnalysisSingleAnswer => ({
        id: unsafeBrandId(a.id),
        key: a.key,
        value: a.value.length > 0 ? a.value[0] : undefined,
      })
    );

  const multiAnswers = answers
    .filter((a) => a.kind === riskAnalysisAnswerKind.multi)
    .map(
      (a): RiskAnalysisMultiAnswer => ({
        id: a.id as RiskAnalysisMultiAnswerId,
        key: a.key,
        values: a.value,
      })
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
  attributesSQL: EServiceDescriptorAttributeSQL[]
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
    // templateBinding: EServiceTemplateBindingSQL | null;
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
    // templateBindingSQL: [],
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
    // templateBinding: EServiceTemplateBindingSQL | null;
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
  // templateBindingSQL: EServiceTemplateBindingSQL[];
} => {
  const eserviceIdSet = new Set<string>();
  const eservicesSQL: EServiceSQL[] = [];

  const descriptorIdSet = new Set<string>();
  const descriptorsSQL: EServiceDescriptorSQL[] = [];

  const interfaceIdSet = new Set<string>();
  const interfacesSQL: EServiceDescriptorDocumentSQL[] = [];

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
          uniqueKey([
            attributeSQL.attributeId,
            attributeSQL.descriptorId,
            attributeSQL.groupId.toString(),
          ])
        )
      ) {
        attributeIdSet.add(
          uniqueKey([
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
          uniqueKey([
            rejectionReasonSQL.descriptorId,
            rejectionReasonSQL.rejectedAt,
          ])
        )
      ) {
        rejectionReasonsSet.add(
          uniqueKey([
            rejectionReasonSQL.descriptorId,
            rejectionReasonSQL.rejectedAt,
          ])
        );
        // eslint-disable-next-line functional/immutable-data
        rejectionReasonsSQL.push(rejectionReasonSQL);
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
    // templateBindingSQL: [],
  };
};

const uniqueKey = (ids: string[]): string => ids.join("#");
