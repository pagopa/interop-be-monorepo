import {
  Document,
  attributeKind,
  Descriptor,
  EServiceAttribute,
  EService,
  RiskAnalysis,
  riskAnalysisAnswerKind,
  RiskAnalysisSingleAnswer,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisMultiAnswer,
  RiskAnalysisMultiAnswerId,
  WithMetadata,
  EServiceId,
  unsafeBrandId,
  TenantId,
  Technology,
  EServiceMode,
  EServiceDocumentId,
  DescriptorId,
  DescriptorState,
  AgreementApprovalPolicy,
  RiskAnalysisId,
  RiskAnalysisFormId,
  AttributeId,
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
  EServiceTemplateRiskAnalysisAnswerSQL,
  EServiceTemplateRiskAnalysisSQL,
  EServiceTemplateVersionAttributeSQL,
  EServiceTemplateVersionDocumentSQL,
  // EServiceTemplateBindingSQL,
} from "pagopa-interop-readmodel-models";

export const documentSQLtoDocument = (
  documentSQL:
    | EServiceDescriptorDocumentSQL
    | EServiceTemplateVersionDocumentSQL
): Document => ({
  id: unsafeBrandId<EServiceDocumentId>(documentSQL.id),
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

  // const rejectionReasons = rejectionReasonsSQL.map((rejectionReason) => ({
  //   rejectionReason: rejectionReason.rejectionReason,
  //   rejectedAt: stringToDate(rejectionReason.rejectedAt),
  // }));
  return {
    id: unsafeBrandId<DescriptorId>(descriptorSQL.id),
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
    id: unsafeBrandId<EServiceId>(eserviceSQL.id),
    name: eserviceSQL.name,
    createdAt: stringToDate(eserviceSQL.createdAt),
    producerId: unsafeBrandId<TenantId>(eserviceSQL.producerId),
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
  eservicesSQL.map((eserviceSQL) => {
    const riskAnalysesSQLOfCurrentEservice = riskAnalysesSQL.filter(
      (ra) => ra.eserviceId === eserviceSQL.id
    );

    const riskAnalysisAnswersSQLOfCurrentEservice =
      riskAnalysisAnswersSQL.filter(
        (answer) => answer.eserviceId === eserviceSQL.id
      );

    const descriptorsSQLOfCurrentEservice = descriptorsSQL.filter(
      (d) => d.eserviceId === eserviceSQL.id
    );

    const interfacesSQLOfCurrentEservice = interfacesSQL.filter(
      (descriptorInterface) => descriptorInterface.eserviceId === eserviceSQL.id
    );

    const documentsSQLOfCurrentEservice = documentsSQL.filter(
      (doc) => doc.eserviceId === eserviceSQL.id
    );

    const attributesSQLOfCurrentEservice = attributesSQL.filter(
      (attr) => attr.eserviceId === eserviceSQL.id
    );

    const rejectionReasonsSQLOfCurrentEservice = rejectionReasonsSQL.filter(
      (rejectionReason) => rejectionReason.eserviceId === eserviceSQL.id
    );

    return aggregateEservice({
      eserviceSQL,
      riskAnalysesSQL: riskAnalysesSQLOfCurrentEservice,
      riskAnalysisAnswersSQL: riskAnalysisAnswersSQLOfCurrentEservice,
      descriptorsSQL: descriptorsSQLOfCurrentEservice,
      interfacesSQL: interfacesSQLOfCurrentEservice,
      documentsSQL: documentsSQLOfCurrentEservice,
      attributesSQL: attributesSQLOfCurrentEservice,
      rejectionReasonsSQL: rejectionReasonsSQLOfCurrentEservice,
      // templateBindingSQL: [],
    });
  });

export const aggregateRiskAnalysis = (
  riskAnalysisSQL: EServiceRiskAnalysisSQL | EServiceTemplateRiskAnalysisSQL,
  answers:
    | EServiceRiskAnalysisAnswerSQL[]
    | EServiceTemplateRiskAnalysisAnswerSQL[]
): RiskAnalysis => {
  const singleAnswers = answers
    .filter((a) => a.kind === riskAnalysisAnswerKind.single)
    .map(
      (a) =>
        ({
          id: unsafeBrandId<RiskAnalysisSingleAnswerId>(a.id),
          key: a.key,
          value: a.value.length > 0 ? a.value[0] : undefined,
        } satisfies RiskAnalysisSingleAnswer)
    );

  const multiAnswers = answers
    .filter((a) => a.kind === riskAnalysisAnswerKind.multi)
    .map(
      (a) =>
        ({
          id: a.id as RiskAnalysisMultiAnswerId,
          key: a.key,
          values: a.value,
        } satisfies RiskAnalysisMultiAnswer)
    );

  const riskAnalysis: RiskAnalysis = {
    id: unsafeBrandId<RiskAnalysisId>(riskAnalysisSQL.id),
    name: riskAnalysisSQL.name,
    createdAt: stringToDate(riskAnalysisSQL.createdAt),
    riskAnalysisForm: {
      version: riskAnalysisSQL.riskAnalysisFormVersion,
      id: unsafeBrandId<RiskAnalysisFormId>(riskAnalysisSQL.riskAnalysisFormId),
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
      id: unsafeBrandId<AttributeId>(current.attributeId),
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
