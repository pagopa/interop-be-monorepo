import {
  attributeKind,
  documentKind,
  EServiceId,
  EServiceAttribute,
  DescriptorId,
  DocumentKind,
  riskAnalysisAnswerKind,
  AttributeKind,
  EServiceReadModel,
  RiskAnalysisReadModel,
  DocumentReadModel,
  DescriptorReadModel,
  DescriptorRejectionReasonReadModel,
} from "pagopa-interop-models";
import {
  EServiceDescriptorAttributeSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  EServiceRiskAnalysisAnswerSQL,
  EServiceRiskAnalysisSQL,
  EServiceSQL,
  EServiceTemplateBindingSQL,
} from "../types.js";

export const splitEserviceIntoObjectsSQL = (
  eservice: EServiceReadModel,
  version: number
): {
  eserviceSQL: EServiceSQL;
  riskAnalysisSQL: EServiceRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
  descriptorsSQL: EServiceDescriptorSQL[];
  attributesSQL: EServiceDescriptorAttributeSQL[];
  documentsSQL: EServiceDescriptorDocumentSQL[];
  rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
  eserviceTemplateBindingSQL?: EServiceTemplateBindingSQL;
} => {
  const eserviceSQL: EServiceSQL = {
    id: eservice.id,
    metadataVersion: version,
    name: eservice.name,
    createdAt: eservice.createdAt,
    producerId: eservice.producerId,
    description: eservice.description,
    technology: eservice.technology,
    mode: eservice.mode,
    isSignalHubEnabled: eservice.isSignalHubEnabled || null,
    isConsumerDelegable: eservice.isConsumerDelegable || null,
    isClientAccessDelegable: eservice.isClientAccessDelegable || null,
  };

  const eserviceTemplateBindingSQL: EServiceTemplateBindingSQL = {
    eserviceId: eservice.id,
    metadataVersion: version,
    eserviceTemplateId: eservice.id, // TODO
    instanceId: eservice.id, // TODO
    name: "", // TODO,
    email: "", // TODO,
    url: "", // TODO,
    termsAndConditionsUrl: "", // TODO,
    serverUrl: "", // TODO
  };

  const { riskAnalysisSQL, riskAnalysisAnswersSQL } =
    eservice.riskAnalysis.reduce(
      (
        acc: {
          riskAnalysisSQL: EServiceRiskAnalysisSQL[];
          riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
        },
        currentRiskAnalysis: RiskAnalysisReadModel
      ) => {
        const { eserviceRiskAnalysisSQL, riskAnalysisAnswersSQL } =
          splitRiskAnalysisIntoObjectsSQL(
            currentRiskAnalysis,
            eservice.id,
            version
          );
        return {
          riskAnalysisSQL: acc.riskAnalysisSQL.concat(eserviceRiskAnalysisSQL),
          riskAnalysisAnswersSQL: acc.riskAnalysisAnswersSQL.concat(
            riskAnalysisAnswersSQL
          ),
        };
      },
      {
        riskAnalysisSQL: [],
        riskAnalysisAnswersSQL: [],
      }
    );

  const { descriptorsSQL, attributesSQL, documentsSQL, rejectionReasonsSQL } =
    eservice.descriptors.reduce(
      (
        acc: {
          descriptorsSQL: EServiceDescriptorSQL[];
          attributesSQL: EServiceDescriptorAttributeSQL[];
          documentsSQL: EServiceDescriptorDocumentSQL[];
          rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
        },
        currentDescriptor: DescriptorReadModel
      ) => {
        const {
          descriptorSQL,
          attributesSQL,
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
          documentsSQL: acc.documentsSQL.concat(documentsSQL),
          rejectionReasonsSQL:
            acc.rejectionReasonsSQL.concat(rejectionReasonsSQL),
        };
      },
      {
        descriptorsSQL: [],
        attributesSQL: [],
        documentsSQL: [],
        rejectionReasonsSQL: [],
      }
    );

  return {
    eserviceSQL,
    eserviceTemplateBindingSQL,
    riskAnalysisSQL,
    riskAnalysisAnswersSQL,
    descriptorsSQL,
    attributesSQL,
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
  descriptor: DescriptorReadModel,
  version: number
): {
  descriptorSQL: EServiceDescriptorSQL;
  attributesSQL: EServiceDescriptorAttributeSQL[];
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
        documentKind.descriptorInterface,
        descriptor.id,
        eserviceId,
        version
      )
    : undefined;

  const documentsSQL = descriptor.docs.map((doc) =>
    documentToDocumentSQL(
      doc,
      documentKind.descriptorDocument,
      descriptor.id,
      eserviceId,
      version
    )
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
    documentsSQL: interfaceSQL ? [interfaceSQL, ...documentsSQL] : documentsSQL,
    rejectionReasonsSQL,
  };
};

export const splitRiskAnalysisIntoObjectsSQL = (
  riskAnalysis: RiskAnalysisReadModel,
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
    createdAt: riskAnalysis.createdAt,
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
  document: DocumentReadModel,
  documentKind: DocumentKind,
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
  uploadDate: document.uploadDate,
  kind: documentKind,
});

export const descriptorToDescriptorSQL = (
  eserviceId: EServiceId,
  descriptor: DescriptorReadModel,
  version: number
): EServiceDescriptorSQL => ({
  id: descriptor.id,
  eserviceId,
  metadataVersion: version,
  version: descriptor.version,
  description: descriptor.description || null,
  createdAt: descriptor.createdAt,
  state: descriptor.state,
  audience: descriptor.audience,
  voucherLifespan: descriptor.voucherLifespan,
  dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
  dailyCallsTotal: descriptor.dailyCallsTotal,
  serverUrls: descriptor.serverUrls,
  agreementApprovalPolicy: descriptor.agreementApprovalPolicy || null,
  publishedAt: descriptor.publishedAt || null,
  suspendedAt: descriptor.suspendedAt || null,
  deprecatedAt: descriptor.deprecatedAt || null,
  archivedAt: descriptor.archivedAt || null,
});

export const eserviceToEserviceSQL = (
  eservice: EServiceReadModel,
  version: number
): EServiceSQL => ({
  id: eservice.id,
  metadataVersion: version,
  name: eservice.name,
  createdAt: eservice.createdAt,
  producerId: eservice.producerId,
  description: eservice.description,
  technology: eservice.technology,
  mode: eservice.mode,
  isSignalHubEnabled: eservice.isSignalHubEnabled || null,
  isConsumerDelegable: eservice.isConsumerDelegable || null,
  isClientAccessDelegable: eservice.isConsumerDelegable || null,
});

export const rejectionReasonToRejectionReasonSQL = (
  rejectionReason: DescriptorRejectionReasonReadModel,
  descriptorId: DescriptorId,
  eserviceId: EServiceId,
  version: number
): EServiceDescriptorRejectionReasonSQL => ({
  eserviceId,
  metadataVersion: version,
  descriptorId,
  rejectionReason: rejectionReason.rejectionReason,
  rejectedAt: rejectionReason.rejectedAt,
});
