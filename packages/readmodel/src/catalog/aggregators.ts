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
  EServiceTemplateVersionRef,
  EServiceTemplateRef,
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
    docs: documentsSQL.map(documentSQLtoDocument),
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
    ...(parsedInterface ? { interface: parsedInterface } : {}),
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
      templateVersionRefSQL: templateVersionRefsSQL.find(
        (t) => t.descriptorId === descriptorSQL.id
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
