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
} from "pagopa-interop-readmodel-models";
import { match } from "ts-pattern";

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
  const interfaceDoc = interfaceSQL
    ? documentSQLtoDocument(interfaceSQL)
    : undefined;

  const {
    Certified: certifiedAttributesSQL,
    Verified: declaredAttributesSQL,
    Declared: verifiedAttributesSQL,
  } = attributesSQL.reduce(
    (
      acc: { [key in AttributeKind]?: EServiceDescriptorAttributeSQL[] },
      attributeSQL
    ) =>
      match(AttributeKind.parse(attributeSQL.kind))
        .with(attributeKind.certified, () => ({
          ...acc,
          Certified: [...(acc.Certified || []), attributeSQL],
        }))
        .with(attributeKind.declared, () => ({
          ...acc,
          Declared: [...(acc.Declared || []), attributeSQL],
        }))
        .with(attributeKind.verified, () => ({
          ...acc,
          Verified: [...(acc.Verified || []), attributeSQL],
        }))
        .exhaustive(),
    {}
  );
  const certifiedAttributes = certifiedAttributesSQL
    ? attributesSQLtoAttributes(certifiedAttributesSQL)
    : [];
  const declaredAttributes = declaredAttributesSQL
    ? attributesSQLtoAttributes(declaredAttributesSQL)
    : [];
  const verifiedAttributes = verifiedAttributesSQL
    ? attributesSQLtoAttributes(verifiedAttributesSQL)
    : [];

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
  riskAnalysisSQL: EServiceRiskAnalysisSQL,
  answers: EServiceRiskAnalysisAnswerSQL[]
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
