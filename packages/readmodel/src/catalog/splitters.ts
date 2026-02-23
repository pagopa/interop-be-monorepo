import {
  attributeKind,
  EServiceId,
  EServiceAttribute,
  DescriptorId,
  riskAnalysisAnswerKind,
  AttributeKind,
  EService,
  RiskAnalysis,
  Document,
  Descriptor,
  DescriptorRejectionReason,
  dateToString,
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
} from "pagopa-interop-readmodel-models";

export const splitEserviceIntoObjectsSQL = (
  eservice: EService,
  version: number
): EServiceItemsSQL => {
  const eserviceSQL = eserviceToEserviceSQL(eservice, version);

  const { riskAnalysesSQL, riskAnalysisAnswersSQL } =
    eservice.riskAnalysis.reduce(
      (
        acc: {
          riskAnalysesSQL: EServiceRiskAnalysisSQL[];
          riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
        },
        currentRiskAnalysis: RiskAnalysis
      ) => {
        const { riskAnalysisSQL, riskAnalysisAnswersSQL } =
          splitRiskAnalysisIntoObjectsSQL(
            currentRiskAnalysis,
            eservice.id,
            version
          );
        return {
          riskAnalysesSQL: acc.riskAnalysesSQL.concat(riskAnalysisSQL),
          riskAnalysisAnswersSQL: acc.riskAnalysisAnswersSQL.concat(
            riskAnalysisAnswersSQL
          ),
        };
      },
      {
        riskAnalysesSQL: [],
        riskAnalysisAnswersSQL: [],
      }
    );

  const {
    descriptorsSQL,
    attributesSQL,
    interfacesSQL,
    documentsSQL,
    rejectionReasonsSQL,
    templateVersionRefsSQL,
  } = eservice.descriptors.reduce(
    (
      acc: {
        descriptorsSQL: EServiceDescriptorSQL[];
        attributesSQL: EServiceDescriptorAttributeSQL[];
        interfacesSQL: EServiceDescriptorInterfaceSQL[];
        documentsSQL: EServiceDescriptorDocumentSQL[];
        rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
        templateVersionRefsSQL: EServiceDescriptorTemplateVersionRefSQL[];
      },
      currentDescriptor: Descriptor
    ) => {
      const {
        descriptorSQL,
        attributesSQL,
        interfaceSQL,
        documentsSQL,
        rejectionReasonsSQL,
        templateVersionRefSQL,
      } = splitDescriptorIntoObjectsSQL(
        eservice.id,
        currentDescriptor,
        version
      );

      return {
        descriptorsSQL: acc.descriptorsSQL.concat([descriptorSQL]),
        attributesSQL: acc.attributesSQL.concat(attributesSQL),
        interfacesSQL: interfaceSQL
          ? acc.interfacesSQL.concat([interfaceSQL])
          : acc.interfacesSQL,
        documentsSQL: acc.documentsSQL.concat(documentsSQL),
        rejectionReasonsSQL:
          acc.rejectionReasonsSQL.concat(rejectionReasonsSQL),
        templateVersionRefsSQL: templateVersionRefSQL
          ? acc.templateVersionRefsSQL.concat(templateVersionRefSQL)
          : acc.templateVersionRefsSQL,
      };
    },
    {
      descriptorsSQL: [],
      attributesSQL: [],
      interfacesSQL: [],
      documentsSQL: [],
      rejectionReasonsSQL: [],
      templateVersionRefsSQL: [],
    }
  );

  return {
    eserviceSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
    descriptorsSQL,
    attributesSQL,
    interfacesSQL,
    documentsSQL,
    rejectionReasonsSQL,
    templateVersionRefsSQL,
  };
};

const attributeToAttributeSQL = ({
  attribute,
  descriptorId,
  groupId,
  kind,
  eserviceId,
  version,
}: {
  attribute: EServiceAttribute;
  descriptorId: DescriptorId;
  groupId: number;
  kind: AttributeKind;
  eserviceId: EServiceId;
  version: number;
}): EServiceDescriptorAttributeSQL => ({
  eserviceId,
  metadataVersion: version,
  attributeId: attribute.id,
  descriptorId,
  kind,
  groupId,
});

const attributesNestedArrayToAttributeSQLarray = (
  descriptorId: DescriptorId,
  attributes: EServiceAttribute[][],
  kind: AttributeKind,
  eserviceId: EServiceId,
  version: number
): EServiceDescriptorAttributeSQL[] =>
  attributes.flatMap((group, index) =>
    group.map((attribute) =>
      attributeToAttributeSQL({
        attribute,
        descriptorId,
        groupId: index,
        kind,
        eserviceId,
        version,
      })
    )
  );

export const splitDescriptorIntoObjectsSQL = (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  version: number
): {
  descriptorSQL: EServiceDescriptorSQL;
  attributesSQL: EServiceDescriptorAttributeSQL[];
  interfaceSQL: EServiceDescriptorInterfaceSQL | undefined;
  documentsSQL: EServiceDescriptorDocumentSQL[];
  rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
  templateVersionRefSQL: EServiceDescriptorTemplateVersionRefSQL | undefined;
} => {
  const descriptorSQL = descriptorToDescriptorSQL(
    eserviceId,
    descriptor,
    version
  );

  const attributesSQL: EServiceDescriptorAttributeSQL[] = [
    ...attributesNestedArrayToAttributeSQLarray(
      descriptor.id,
      descriptor.attributes.certified,
      attributeKind.certified,
      eserviceId,
      version
    ),
    ...attributesNestedArrayToAttributeSQLarray(
      descriptor.id,
      descriptor.attributes.declared,
      attributeKind.declared,
      eserviceId,
      version
    ),
    ...attributesNestedArrayToAttributeSQLarray(
      descriptor.id,
      descriptor.attributes.verified,
      attributeKind.verified,
      eserviceId,
      version
    ),
  ];
  const interfaceSQL = descriptor.interface
    ? documentToDocumentSQL(
        descriptor.interface,
        descriptor.id,
        eserviceId,
        version
      )
    : undefined;

  const documentsSQL = descriptor.docs.map((doc) =>
    documentToDocumentSQL(doc, descriptor.id, eserviceId, version)
  );

  const rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[] =
    descriptor.rejectionReasons
      ? descriptor.rejectionReasons.map((rejectionReason) =>
          rejectionReasonToRejectionReasonSQL(
            rejectionReason,
            descriptor.id,
            eserviceId,
            version
          )
        )
      : [];

  const templateVersionRefSQL:
    | EServiceDescriptorTemplateVersionRefSQL
    | undefined = descriptor.templateVersionRef
    ? {
        eserviceTemplateVersionId: descriptor.templateVersionRef.id,
        eserviceId,
        metadataVersion: version,
        descriptorId: descriptor.id,
        contactName:
          descriptor.templateVersionRef.interfaceMetadata?.contactName ?? null,
        contactEmail:
          descriptor.templateVersionRef.interfaceMetadata?.contactEmail ?? null,
        contactUrl:
          descriptor.templateVersionRef.interfaceMetadata?.contactUrl ?? null,
        termsAndConditionsUrl:
          descriptor.templateVersionRef.interfaceMetadata
            ?.termsAndConditionsUrl ?? null,
      }
    : undefined;

  return {
    descriptorSQL,
    attributesSQL,
    interfaceSQL,
    documentsSQL,
    rejectionReasonsSQL,
    templateVersionRefSQL,
  };
};

export const splitRiskAnalysisIntoObjectsSQL = (
  riskAnalysis: RiskAnalysis,
  eserviceId: EServiceId,
  version: number
): {
  riskAnalysisSQL: EServiceRiskAnalysisSQL;
  riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
} => {
  const riskAnalysisSQL: EServiceRiskAnalysisSQL = {
    id: riskAnalysis.id,
    metadataVersion: version,
    eserviceId,
    name: riskAnalysis.name,
    createdAt: dateToString(riskAnalysis.createdAt),
    riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
    riskAnalysisFormVersion: riskAnalysis.riskAnalysisForm.version,
  };

  const riskAnalysisSingleAnswers: EServiceRiskAnalysisAnswerSQL[] =
    riskAnalysis.riskAnalysisForm.singleAnswers.map(
      (a) =>
        ({
          id: a.id,
          eserviceId,
          metadataVersion: version,
          key: a.key,
          value: a.value ? [a.value] : [],
          riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
          kind: riskAnalysisAnswerKind.single,
        } satisfies EServiceRiskAnalysisAnswerSQL)
    );
  const riskAnalysisMultiAnswers: EServiceRiskAnalysisAnswerSQL[] =
    riskAnalysis.riskAnalysisForm.multiAnswers.map(
      (a) =>
        ({
          id: a.id,
          eserviceId,
          metadataVersion: version,
          key: a.key,
          value: a.values,
          riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
          kind: riskAnalysisAnswerKind.multi,
        } satisfies EServiceRiskAnalysisAnswerSQL)
    );

  return {
    riskAnalysisSQL,
    riskAnalysisAnswersSQL: [
      ...riskAnalysisSingleAnswers,
      ...riskAnalysisMultiAnswers,
    ],
  };
};

export const documentToDocumentSQL = (
  document: Document,
  descriptorId: DescriptorId,
  eserviceId: EServiceId,
  version: number
): EServiceDescriptorDocumentSQL => ({
  id: document.id,
  eserviceId,
  metadataVersion: version,
  descriptorId,
  name: document.name,
  contentType: document.contentType,
  prettyName: document.prettyName,
  path: document.path,
  checksum: document.checksum,
  uploadDate: dateToString(document.uploadDate),
});

export const descriptorToDescriptorSQL = (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  version: number
): EServiceDescriptorSQL => ({
  id: descriptor.id,
  eserviceId,
  metadataVersion: version,
  version: descriptor.version,
  description: descriptor.description || null,
  createdAt: dateToString(descriptor.createdAt),
  state: descriptor.state,
  audience: descriptor.audience,
  voucherLifespan: descriptor.voucherLifespan,
  dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
  dailyCallsTotal: descriptor.dailyCallsTotal,
  serverUrls: descriptor.serverUrls,
  agreementApprovalPolicy: descriptor.agreementApprovalPolicy || null,
  publishedAt: dateToString(descriptor.publishedAt),
  suspendedAt: dateToString(descriptor.suspendedAt),
  deprecatedAt: dateToString(descriptor.deprecatedAt),
  archivedAt: dateToString(descriptor.archivedAt),
});

export const eserviceToEserviceSQL = (
  eservice: EService,
  version: number
): EServiceSQL => ({
  id: eservice.id,
  metadataVersion: version,
  name: eservice.name,
  createdAt: dateToString(eservice.createdAt),
  producerId: eservice.producerId,
  description: eservice.description,
  technology: eservice.technology,
  mode: eservice.mode,
  isSignalHubEnabled: eservice.isSignalHubEnabled ?? null,
  isConsumerDelegable: eservice.isConsumerDelegable ?? null,
  isClientAccessDelegable: eservice.isClientAccessDelegable ?? null,
  templateId: eservice.templateId ?? null,
  personalData: eservice.personalData ?? null,
});

export const rejectionReasonToRejectionReasonSQL = (
  rejectionReason: DescriptorRejectionReason,
  descriptorId: DescriptorId,
  eserviceId: EServiceId,
  version: number
): EServiceDescriptorRejectionReasonSQL => ({
  eserviceId,
  metadataVersion: version,
  descriptorId,
  rejectionReason: rejectionReason.rejectionReason,
  rejectedAt: dateToString(rejectionReason.rejectedAt),
});
