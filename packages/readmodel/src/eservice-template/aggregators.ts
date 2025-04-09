import {
  AgreementApprovalPolicy,
  AttributeKind,
  attributeKind,
  EServiceMode,
  EServiceTemplate,
  EServiceTemplateVersion,
  EServiceTemplateVersionState,
  stringToDate,
  Technology,
  unsafeBrandId,
  WithMetadata,
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
import { match } from "ts-pattern";
import {
  aggregateRiskAnalysis,
  attributesSQLtoAttributes,
  documentSQLtoDocument,
} from "../catalog/aggregators.js";
import { makeUniqueKey } from "../utils.js";

export const aggregateEServiceTemplateVersion = ({
  versionSQL,
  interfaceSQL,
  documentsSQL,
  attributesSQL,
}: {
  versionSQL: EServiceTemplateVersionSQL;
  interfaceSQL: EServiceTemplateVersionInterfaceSQL | undefined;
  documentsSQL: EServiceTemplateVersionDocumentSQL[];
  attributesSQL: EServiceTemplateVersionAttributeSQL[];
}): EServiceTemplateVersion => {
  const parsedInterface = interfaceSQL
    ? documentSQLtoDocument(interfaceSQL)
    : undefined;

  const {
    Certified: certifiedAttributesSQL,
    Verified: declaredAttributesSQL,
    Declared: verifiedAttributesSQL,
  } = attributesSQL.reduce(
    (
      acc: { [key in AttributeKind]?: EServiceTemplateVersionAttributeSQL[] },
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

  return {
    id: unsafeBrandId(versionSQL.id),
    version: versionSQL.version,
    docs: documentsSQL.map(documentSQLtoDocument),
    state: EServiceTemplateVersionState.parse(versionSQL.state),
    voucherLifespan: versionSQL.voucherLifespan,
    ...(versionSQL.dailyCallsPerConsumer
      ? { dailyCallsPerConsumer: versionSQL.dailyCallsPerConsumer }
      : {}),
    ...(versionSQL.dailyCallsTotal
      ? { dailyCallsTotal: versionSQL.dailyCallsTotal }
      : {}),
    createdAt: stringToDate(versionSQL.createdAt),
    attributes: {
      certified: certifiedAttributes,
      declared: declaredAttributes,
      verified: verifiedAttributes,
    },
    ...(parsedInterface ? { interface: parsedInterface } : {}),
    ...(versionSQL.description ? { description: versionSQL.description } : {}),
    ...(versionSQL.agreementApprovalPolicy
      ? {
          agreementApprovalPolicy: AgreementApprovalPolicy.parse(
            versionSQL.agreementApprovalPolicy
          ),
        }
      : {}),
    ...(versionSQL.publishedAt
      ? { publishedAt: stringToDate(versionSQL.publishedAt) }
      : {}),
    ...(versionSQL.suspendedAt
      ? { suspendedAt: stringToDate(versionSQL.suspendedAt) }
      : {}),
    ...(versionSQL.deprecatedAt
      ? { deprecatedAt: stringToDate(versionSQL.deprecatedAt) }
      : {}),
  };
};

export const aggregateEServiceTemplate = ({
  eserviceTemplateSQL,
  riskAnalysesSQL,
  riskAnalysisAnswersSQL,
  versionsSQL,
  interfacesSQL,
  attributesSQL,
  documentsSQL,
}: EServiceTemplateItemsSQL): WithMetadata<EServiceTemplate> => {
  const versions = versionsSQL.map((versionSQL) =>
    aggregateEServiceTemplateVersion({
      versionSQL,
      interfaceSQL: interfacesSQL.find((i) => i.versionId === versionSQL.id),
      documentsSQL: documentsSQL.filter((d) => d.versionId === versionSQL.id),
      attributesSQL: attributesSQL.filter((a) => a.versionId === versionSQL.id),
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
  const eserviceTemplate: EServiceTemplate = {
    id: unsafeBrandId(eserviceTemplateSQL.id),
    name: eserviceTemplateSQL.name,
    intendedTarget: eserviceTemplateSQL.intendedTarget,
    createdAt: stringToDate(eserviceTemplateSQL.createdAt),
    creatorId: unsafeBrandId(eserviceTemplateSQL.creatorId),
    description: eserviceTemplateSQL.description,
    technology: Technology.parse(eserviceTemplateSQL.technology),
    versions,
    riskAnalysis,
    mode: EServiceMode.parse(eserviceTemplateSQL.mode),
    ...(eserviceTemplateSQL.isSignalHubEnabled !== null
      ? { isSignalHubEnabled: eserviceTemplateSQL.isSignalHubEnabled }
      : {}),
  };
  return {
    data: eserviceTemplate,
    metadata: { version: eserviceTemplateSQL.metadataVersion },
  };
};

export const aggregateEServiceTemplateArray = ({
  eserviceTemplatesSQL,
  riskAnalysesSQL,
  riskAnalysisAnswersSQL,
  versionsSQL,
  attributesSQL,
  interfacesSQL,
  documentsSQL,
}: {
  eserviceTemplatesSQL: EServiceTemplateSQL[];
  riskAnalysesSQL: EServiceTemplateRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: EServiceTemplateRiskAnalysisAnswerSQL[];
  versionsSQL: EServiceTemplateVersionSQL[];
  attributesSQL: EServiceTemplateVersionAttributeSQL[];
  interfacesSQL: EServiceTemplateVersionInterfaceSQL[];
  documentsSQL: EServiceTemplateVersionDocumentSQL[];
  // templateBindingSQL: EServiceTemplateBindingSQL[];
}): Array<WithMetadata<EServiceTemplate>> =>
  eserviceTemplatesSQL.map((eserviceTemplateSQL) =>
    aggregateEServiceTemplate({
      eserviceTemplateSQL,
      riskAnalysesSQL: riskAnalysesSQL.filter(
        (ra) => ra.eserviceTemplateId === eserviceTemplateSQL.id
      ),
      riskAnalysisAnswersSQL: riskAnalysisAnswersSQL.filter(
        (answer) => answer.eserviceTemplateId === eserviceTemplateSQL.id
      ),
      versionsSQL: versionsSQL.filter(
        (d) => d.eserviceTemplateId === eserviceTemplateSQL.id
      ),
      interfacesSQL: interfacesSQL.filter(
        (descriptorInterface) =>
          descriptorInterface.eserviceTemplateId === eserviceTemplateSQL.id
      ),
      documentsSQL: documentsSQL.filter(
        (doc) => doc.eserviceTemplateId === eserviceTemplateSQL.id
      ),
      attributesSQL: attributesSQL.filter(
        (attr) => attr.eserviceTemplateId === eserviceTemplateSQL.id
      ),
    })
  );

export const toEServiceTemplateAggregator = (
  queryRes: Array<{
    eserviceTemplate: EServiceTemplateSQL;
    version: EServiceTemplateVersionSQL | null;
    interface: EServiceTemplateVersionInterfaceSQL | null;
    document: EServiceTemplateVersionDocumentSQL | null;
    attribute: EServiceTemplateVersionAttributeSQL | null;
    riskAnalysis: EServiceTemplateRiskAnalysisSQL | null;
    riskAnalysisAnswer: EServiceTemplateRiskAnalysisAnswerSQL | null;
  }>
): EServiceTemplateItemsSQL => {
  const {
    eserviceTemplatesSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
    versionsSQL,
    interfacesSQL,
    documentsSQL,
    attributesSQL,
  } = toEServiceTemplateAggregatorArray(queryRes);

  return {
    eserviceTemplateSQL: eserviceTemplatesSQL[0],
    versionsSQL,
    interfacesSQL,
    documentsSQL,
    attributesSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
  };
};

export const toEServiceTemplateAggregatorArray = (
  queryRes: Array<{
    eserviceTemplate: EServiceTemplateSQL;
    version: EServiceTemplateVersionSQL | null;
    interface: EServiceTemplateVersionInterfaceSQL | null;
    document: EServiceTemplateVersionDocumentSQL | null;
    attribute: EServiceTemplateVersionAttributeSQL | null;
    riskAnalysis: EServiceTemplateRiskAnalysisSQL | null;
    riskAnalysisAnswer: EServiceTemplateRiskAnalysisAnswerSQL | null;
  }>
): {
  eserviceTemplatesSQL: EServiceTemplateSQL[];
  riskAnalysesSQL: EServiceTemplateRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: EServiceTemplateRiskAnalysisAnswerSQL[];
  versionsSQL: EServiceTemplateVersionSQL[];
  attributesSQL: EServiceTemplateVersionAttributeSQL[];
  interfacesSQL: EServiceTemplateVersionInterfaceSQL[];
  documentsSQL: EServiceTemplateVersionDocumentSQL[];
} => {
  const eserviceIdSet = new Set<string>();
  const eserviceTemplatesSQL: EServiceTemplateSQL[] = [];

  const versionIdSet = new Set<string>();
  const versionsSQL: EServiceTemplateVersionSQL[] = [];

  const interfaceIdSet = new Set<string>();
  const interfacesSQL: EServiceTemplateVersionDocumentSQL[] = [];

  const documentIdSet = new Set<string>();
  const documentsSQL: EServiceTemplateVersionDocumentSQL[] = [];

  const attributeIdSet = new Set<string>();
  const attributesSQL: EServiceTemplateVersionAttributeSQL[] = [];

  const riskAnalysisIdSet = new Set<string>();
  const riskAnalysesSQL: EServiceTemplateRiskAnalysisSQL[] = [];

  const riskAnalysisAnswerIdSet = new Set<string>();
  const riskAnalysisAnswersSQL: EServiceTemplateRiskAnalysisAnswerSQL[] = [];

  // eslint-disable-next-line sonarjs/cognitive-complexity
  queryRes.forEach((row) => {
    const eserviceTemplateSQL = row.eserviceTemplate;

    if (!eserviceIdSet.has(eserviceTemplateSQL.id)) {
      eserviceIdSet.add(eserviceTemplateSQL.id);
      // eslint-disable-next-line functional/immutable-data
      eserviceTemplatesSQL.push(eserviceTemplateSQL);
    }

    const versionSQL = row.version;
    if (versionSQL) {
      if (!versionIdSet.has(versionSQL.id)) {
        versionIdSet.add(versionSQL.id);
        // eslint-disable-next-line functional/immutable-data
        versionsSQL.push(versionSQL);
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
            attributeSQL.versionId,
            attributeSQL.groupId.toString(),
          ])
        )
      ) {
        attributeIdSet.add(
          makeUniqueKey([
            attributeSQL.attributeId,
            attributeSQL.versionId,
            attributeSQL.groupId.toString(),
          ])
        );
        // eslint-disable-next-line functional/immutable-data
        attributesSQL.push(attributeSQL);
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
    eserviceTemplatesSQL,
    versionsSQL,
    interfacesSQL,
    documentsSQL,
    attributesSQL,
    riskAnalysesSQL,
    riskAnalysisAnswersSQL,
  };
};
