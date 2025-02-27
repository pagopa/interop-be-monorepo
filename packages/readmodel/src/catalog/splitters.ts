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
  EServiceRiskAnalysisAnswerSQL,
  EServiceRiskAnalysisSQL,
  EServiceSQL,
} from "pagopa-interop-readmodel-models";

export const splitEserviceIntoObjectsSQL = (
  eservice: EService,
  version: number
): {
  eserviceSQL: EServiceSQL;
  riskAnalysesSQL: EServiceRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
  descriptorsSQL: EServiceDescriptorSQL[];
  attributesSQL: EServiceDescriptorAttributeSQL[];
  documentsSQL: EServiceDescriptorDocumentSQL[];
  interfacesSQL: EServiceDescriptorInterfaceSQL[];
  rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
} => {
  const eserviceSQL: EServiceSQL = {
    id: eservice.id,
    metadataVersion: version,
    name: eservice.name,
    createdAt: dateToString(eservice.createdAt),
    producerId: eservice.producerId,
    description: eservice.description,
    technology: eservice.technology,
    mode: eservice.mode,
    isSignalHubEnabled: eservice.isSignalHubEnabled || null,
    isConsumerDelegable: eservice.isConsumerDelegable || null,
    isClientAccessDelegable: eservice.isClientAccessDelegable || null,
  };

  // const eserviceTemplateBindingSQL: EServiceTemplateBindingSQL = {
  //   eserviceId: eservice.id,
  //   metadataVersion: version,
  //   eserviceTemplateId: eservice.id, // TODO
  //   instanceId: eservice.id, // TODO
  //   name: "", // TODO,
  //   email: "", // TODO,
  //   url: "", // TODO,
  //   termsAndConditionsUrl: "", // TODO,
  //   serverUrl: "", // TODO
  // };

  const { riskAnalysesSQL, riskAnalysisAnswersSQL } =
    eservice.riskAnalysis.reduce(
      (
        acc: {
          riskAnalysesSQL: EServiceRiskAnalysisSQL[];
          riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
        },
        currentRiskAnalysis: RiskAnalysis
      ) => {
        const { eserviceRiskAnalysisSQL, riskAnalysisAnswersSQL } =
          splitRiskAnalysisIntoObjectsSQL(
            currentRiskAnalysis,
            eservice.id,
            version
          );
        return {
          riskAnalysesSQL: acc.riskAnalysesSQL.concat(eserviceRiskAnalysisSQL),
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
  } = eservice.descriptors.reduce(
    (
      acc: {
        descriptorsSQL: EServiceDescriptorSQL[];
        attributesSQL: EServiceDescriptorAttributeSQL[];
        interfacesSQL: EServiceDescriptorInterfaceSQL[];
        documentsSQL: EServiceDescriptorDocumentSQL[];
        rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
      },
      currentDescriptor: Descriptor
    ) => {
      const {
        descriptorSQL,
        attributesSQL,
        interfaceSQL,
        documentsSQL,
        rejectionReasonsSQL,
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
      };
    },
    {
      descriptorsSQL: [],
      attributesSQL: [],
      interfacesSQL: [],
      documentsSQL: [],
      rejectionReasonsSQL: [],
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
  explicitAttributeVerification: attribute.explicitAttributeVerification,
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

  return {
    descriptorSQL,
    attributesSQL,
    interfaceSQL,
    documentsSQL,
    rejectionReasonsSQL,
  };
};

export const splitRiskAnalysisIntoObjectsSQL = (
  riskAnalysis: RiskAnalysis,
  eserviceId: EServiceId,
  version: number
): {
  eserviceRiskAnalysisSQL: EServiceRiskAnalysisSQL;
  riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
} => {
  const eserviceRiskAnalysisSQL: EServiceRiskAnalysisSQL = {
    id: riskAnalysis.id,
    metadataVersion: version,
    eserviceId,
    name: riskAnalysis.name,
    createdAt: dateToString(riskAnalysis.createdAt),
    riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
    riskAnalysisFormVersion: riskAnalysis.riskAnalysisForm.version,
  };

  const riskAnalysisSingleAnwers: EServiceRiskAnalysisAnswerSQL[] =
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
  const riskAnalysisMultiAnwers: EServiceRiskAnalysisAnswerSQL[] =
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
    eserviceRiskAnalysisSQL,
    riskAnalysisAnswersSQL: [
      ...riskAnalysisSingleAnwers,
      ...riskAnalysisMultiAnwers,
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
  isSignalHubEnabled: eservice.isSignalHubEnabled || null,
  isConsumerDelegable: eservice.isConsumerDelegable || null,
  isClientAccessDelegable: eservice.isConsumerDelegable || null,
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
