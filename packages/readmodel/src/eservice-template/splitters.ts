import {
  AttributeKind,
  attributeKind,
  dateToString,
  Document,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateRiskAnalysis,
  EServiceTemplateVersion,
  EServiceTemplateVersionId,
  riskAnalysisAnswerKind,
  type EServiceTemplateAttribute,
} from "pagopa-interop-models";
import {
  EServiceTemplateItemsSQL,
  EServiceTemplateRiskAnalysisAnswerSQL,
  EServiceTemplateRiskAnalysisSQL,
  EServiceTemplateSQL,
  EServiceTemplateVersionAttributeSQL,
  EServiceTemplateVersionDocumentSQL,
  EServiceTemplateVersionInterfaceSQL,
  EServiceTemplateVersionSQL,
} from "pagopa-interop-readmodel-models";

export const splitEServiceTemplateIntoObjectsSQL = (
  eserviceTemplate: EServiceTemplate,
  metadataVersion: number
): EServiceTemplateItemsSQL => {
  const eserviceTemplateSQL = eserviceTemplateToEServiceTemplateSQL(
    eserviceTemplate,
    metadataVersion
  );

  const { riskAnalysesSQL, riskAnalysisAnswersSQL } =
    eserviceTemplate.riskAnalysis.reduce(
      (
        acc: {
          riskAnalysesSQL: EServiceTemplateRiskAnalysisSQL[];
          riskAnalysisAnswersSQL: EServiceTemplateRiskAnalysisAnswerSQL[];
        },
        currentRiskAnalysis: EServiceTemplateRiskAnalysis
      ) => {
        const { riskAnalysisSQL, riskAnalysisAnswersSQL } =
          splitEServiceTemplateRiskAnalysisIntoObjectsSQL(
            currentRiskAnalysis,
            eserviceTemplate.id,
            metadataVersion
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

  const { versionsSQL, attributesSQL, interfacesSQL, documentsSQL } =
    eserviceTemplate.versions.reduce(
      (
        acc: {
          versionsSQL: EServiceTemplateVersionSQL[];
          attributesSQL: EServiceTemplateVersionAttributeSQL[];
          interfacesSQL: EServiceTemplateVersionInterfaceSQL[];
          documentsSQL: EServiceTemplateVersionDocumentSQL[];
        },
        currentVersion: EServiceTemplateVersion
      ) => {
        const {
          eserviceTemplateVersionSQL,
          attributesSQL,
          interfaceSQL,
          documentsSQL,
        } = splitEServiceTemplateVersionIntoObjectsSQL(
          eserviceTemplate.id,
          currentVersion,
          metadataVersion
        );

        return {
          versionsSQL: acc.versionsSQL.concat([eserviceTemplateVersionSQL]),
          attributesSQL: acc.attributesSQL.concat(attributesSQL),
          interfacesSQL: interfaceSQL
            ? acc.interfacesSQL.concat([interfaceSQL])
            : acc.interfacesSQL,
          documentsSQL: acc.documentsSQL.concat(documentsSQL),
        };
      },
      {
        versionsSQL: [],
        attributesSQL: [],
        interfacesSQL: [],
        documentsSQL: [],
      }
    );

  return {
    eserviceTemplateSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
    versionsSQL,
    attributesSQL,
    interfacesSQL,
    documentsSQL,
  };
};

const templateAttributeToTemplateAttributeSQL = ({
  attribute,
  eserviceTemplateVersionId,
  groupId,
  kind,
  eserviceTemplateId,
  metadataVersion,
}: {
  attribute: EServiceTemplateAttribute;
  eserviceTemplateVersionId: EServiceTemplateVersionId;
  groupId: number;
  kind: AttributeKind;
  eserviceTemplateId: EServiceTemplateId;
  metadataVersion: number;
}): EServiceTemplateVersionAttributeSQL => ({
  eserviceTemplateId,
  metadataVersion,
  attributeId: attribute.id,
  versionId: eserviceTemplateVersionId,
  explicitAttributeVerification: attribute.explicitAttributeVerification,
  kind,
  groupId,
  dailyCalls: attribute.dailyCalls ?? null,
});

const templateAttributesNestedArrayToTemplateAttributeSQLarray = (
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  attributes: EServiceTemplateAttribute[][],
  kind: AttributeKind,
  eserviceTemplateId: EServiceTemplateId,
  metadataVersion: number
): EServiceTemplateVersionAttributeSQL[] =>
  attributes.flatMap((group, index) =>
    group.map((attribute) =>
      templateAttributeToTemplateAttributeSQL({
        attribute,
        eserviceTemplateVersionId,
        groupId: index,
        kind,
        eserviceTemplateId,
        metadataVersion,
      })
    )
  );

const splitEServiceTemplateVersionIntoObjectsSQL = (
  eserviceTemplateId: EServiceTemplateId,
  eserviceTemplateVersion: EServiceTemplateVersion,
  metadataVersion: number
): {
  eserviceTemplateVersionSQL: EServiceTemplateVersionSQL;
  attributesSQL: EServiceTemplateVersionAttributeSQL[];
  interfaceSQL: EServiceTemplateVersionInterfaceSQL | undefined;
  documentsSQL: EServiceTemplateVersionDocumentSQL[];
} => {
  const versionSQL = eserviceTemplateVersionToEServiceTemplateVersionSQL(
    eserviceTemplateId,
    eserviceTemplateVersion,
    metadataVersion
  );

  const attributesSQL: EServiceTemplateVersionAttributeSQL[] = [
    ...templateAttributesNestedArrayToTemplateAttributeSQLarray(
      eserviceTemplateVersion.id,
      eserviceTemplateVersion.attributes.certified,
      attributeKind.certified,
      eserviceTemplateId,
      metadataVersion
    ),
    ...templateAttributesNestedArrayToTemplateAttributeSQLarray(
      eserviceTemplateVersion.id,
      eserviceTemplateVersion.attributes.declared,
      attributeKind.declared,
      eserviceTemplateId,
      metadataVersion
    ),
    ...templateAttributesNestedArrayToTemplateAttributeSQLarray(
      eserviceTemplateVersion.id,
      eserviceTemplateVersion.attributes.verified,
      attributeKind.verified,
      eserviceTemplateId,
      metadataVersion
    ),
  ];
  const interfaceSQL = eserviceTemplateVersion.interface
    ? documentToDocumentSQL(
        eserviceTemplateVersion.interface,
        eserviceTemplateVersion.id,
        eserviceTemplateId,
        metadataVersion
      )
    : undefined;

  const documentsSQL = eserviceTemplateVersion.docs.map((doc) =>
    documentToDocumentSQL(
      doc,
      eserviceTemplateVersion.id,
      eserviceTemplateId,
      metadataVersion
    )
  );

  return {
    eserviceTemplateVersionSQL: versionSQL,
    attributesSQL,
    interfaceSQL,
    documentsSQL,
  };
};

const splitEServiceTemplateRiskAnalysisIntoObjectsSQL = (
  riskAnalysis: EServiceTemplateRiskAnalysis,
  eserviceTemplateId: EServiceTemplateId,
  metadataVersion: number
): {
  riskAnalysisSQL: EServiceTemplateRiskAnalysisSQL;
  riskAnalysisAnswersSQL: EServiceTemplateRiskAnalysisAnswerSQL[];
} => {
  const riskAnalysisSQL: EServiceTemplateRiskAnalysisSQL = {
    id: riskAnalysis.id,
    metadataVersion,
    eserviceTemplateId,
    name: riskAnalysis.name,
    createdAt: dateToString(riskAnalysis.createdAt),
    riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
    riskAnalysisFormVersion: riskAnalysis.riskAnalysisForm.version,
    tenantKind: riskAnalysis.tenantKind,
  };

  const riskAnalysisSingleAnswers: EServiceTemplateRiskAnalysisAnswerSQL[] =
    riskAnalysis.riskAnalysisForm.singleAnswers.map(
      (a): EServiceTemplateRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceTemplateId,
        metadataVersion,
        key: a.key,
        value: a.value ? [a.value] : [],
        riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.single,
      })
    );
  const riskAnalysisMultiAnswers: EServiceTemplateRiskAnalysisAnswerSQL[] =
    riskAnalysis.riskAnalysisForm.multiAnswers.map(
      (a): EServiceTemplateRiskAnalysisAnswerSQL => ({
        id: a.id,
        eserviceTemplateId,
        metadataVersion,
        key: a.key,
        value: a.values,
        riskAnalysisFormId: riskAnalysis.riskAnalysisForm.id,
        kind: riskAnalysisAnswerKind.multi,
      })
    );

  return {
    riskAnalysisSQL,
    riskAnalysisAnswersSQL: [
      ...riskAnalysisSingleAnswers,
      ...riskAnalysisMultiAnswers,
    ],
  };
};

const documentToDocumentSQL = (
  document: Document,
  eserviceTemplateVersionId: EServiceTemplateVersionId,
  eserviceTemplateId: EServiceTemplateId,
  metadataVersion: number
): EServiceTemplateVersionDocumentSQL => ({
  id: document.id,
  eserviceTemplateId,
  metadataVersion,
  versionId: eserviceTemplateVersionId,
  name: document.name,
  contentType: document.contentType,
  prettyName: document.prettyName,
  path: document.path,
  checksum: document.checksum,
  uploadDate: dateToString(document.uploadDate),
});

const eserviceTemplateVersionToEServiceTemplateVersionSQL = (
  eserviceTemplateId: EServiceTemplateId,
  eserviceTemplateVersion: EServiceTemplateVersion,
  metadataVersion: number
): EServiceTemplateVersionSQL => ({
  id: eserviceTemplateVersion.id,
  eserviceTemplateId,
  metadataVersion,
  version: eserviceTemplateVersion.version,
  description: eserviceTemplateVersion.description || null,
  createdAt: dateToString(eserviceTemplateVersion.createdAt),
  state: eserviceTemplateVersion.state,
  voucherLifespan: eserviceTemplateVersion.voucherLifespan,
  dailyCallsPerConsumer: eserviceTemplateVersion.dailyCallsPerConsumer ?? null,
  dailyCallsTotal: eserviceTemplateVersion.dailyCallsTotal ?? null,
  agreementApprovalPolicy:
    eserviceTemplateVersion.agreementApprovalPolicy ?? null,
  publishedAt: dateToString(eserviceTemplateVersion.publishedAt),
  suspendedAt: dateToString(eserviceTemplateVersion.suspendedAt),
  deprecatedAt: dateToString(eserviceTemplateVersion.deprecatedAt),
});

const eserviceTemplateToEServiceTemplateSQL = (
  eserviceTemplate: EServiceTemplate,
  metadataVersion: number
): EServiceTemplateSQL => ({
  id: eserviceTemplate.id,
  metadataVersion,
  name: eserviceTemplate.name,
  createdAt: dateToString(eserviceTemplate.createdAt),
  creatorId: eserviceTemplate.creatorId,
  intendedTarget: eserviceTemplate.intendedTarget,
  description: eserviceTemplate.description,
  technology: eserviceTemplate.technology,
  mode: eserviceTemplate.mode,
  isSignalHubEnabled: eserviceTemplate.isSignalHubEnabled ?? null,
  personalData: eserviceTemplate.personalData ?? null,
});
