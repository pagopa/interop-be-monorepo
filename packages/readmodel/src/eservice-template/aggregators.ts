import {
  AgreementApprovalPolicy,
  AttributeKind,
  attributeKind,
  EServiceMode,
  EServiceTemplate,
  EServiceTemplateId,
  EServiceTemplateRiskAnalysis,
  EServiceTemplateVersion,
  EServiceTemplateVersionState,
  stringToDate,
  Technology,
  TenantKind,
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
  aggregateRiskAnalysisForm,
  attributesSQLtoAttributes,
  documentSQLtoDocument,
} from "../catalog/aggregators.js";
import { makeUniqueKey, throwIfMultiple } from "../utils.js";

export const aggregateEServiceTemplateRiskAnalysis = (
  riskAnalysisSQL: EServiceTemplateRiskAnalysisSQL,
  answers: EServiceTemplateRiskAnalysisAnswerSQL[]
): EServiceTemplateRiskAnalysis => ({
  id: unsafeBrandId(riskAnalysisSQL.id),
  name: riskAnalysisSQL.name,
  createdAt: stringToDate(riskAnalysisSQL.createdAt),
  riskAnalysisForm: aggregateRiskAnalysisForm(riskAnalysisSQL, answers),
  tenantKind: TenantKind.parse(riskAnalysisSQL.tenantKind),
});

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
    certified: certifiedAttributesSQL,
    verified: verifiedAttributesSQL,
    declared: declaredAttributesSQL,
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
      certified: new Array<EServiceTemplateVersionAttributeSQL>(),
      declared: new Array<EServiceTemplateVersionAttributeSQL>(),
      verified: new Array<EServiceTemplateVersionAttributeSQL>(),
    }
  );
  const certifiedAttributes = attributesSQLtoAttributes(certifiedAttributesSQL);
  const declaredAttributes = attributesSQLtoAttributes(declaredAttributesSQL);
  const verifiedAttributes = attributesSQLtoAttributes(verifiedAttributesSQL);

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
  const interfacesSQLByVersionId = interfacesSQL.reduce((acc, i) => {
    const versionId = i.versionId;
    acc.set(versionId, i);
    return acc;
  }, new Map<string, EServiceTemplateVersionInterfaceSQL>());
  const documentsSQLByVersionId = documentsSQL.reduce((acc, doc) => {
    const versionId = doc.versionId;
    acc.set(versionId, [...(acc.get(versionId) || []), doc]);
    return acc;
  }, new Map<string, EServiceTemplateVersionDocumentSQL[]>());
  const attributesSQLByVersionId = attributesSQL.reduce((acc, attr) => {
    const versionId = attr.versionId;
    acc.set(versionId, [...(acc.get(versionId) || []), attr]);
    return acc;
  }, new Map<string, EServiceTemplateVersionAttributeSQL[]>());
  const versions = versionsSQL.map((versionSQL) =>
    aggregateEServiceTemplateVersion({
      versionSQL,
      interfaceSQL: interfacesSQLByVersionId.get(versionSQL.id),
      documentsSQL: documentsSQLByVersionId.get(versionSQL.id) || [],
      attributesSQL: attributesSQLByVersionId.get(versionSQL.id) || [],
    })
  );

  const riskAnalysisAnswersSQLByFormId = riskAnalysisAnswersSQL.reduce(
    (acc, answer) => {
      const formId = answer.riskAnalysisFormId;
      acc.set(formId, [...(acc.get(formId) || []), answer]);
      return acc;
    },
    new Map<string, EServiceTemplateRiskAnalysisAnswerSQL[]>()
  );
  const riskAnalysis = riskAnalysesSQL.map((ra) =>
    aggregateEServiceTemplateRiskAnalysis(
      ra,
      riskAnalysisAnswersSQLByFormId.get(ra.riskAnalysisFormId) || []
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
    ...(eserviceTemplateSQL.personalData !== null
      ? {
          personalData: eserviceTemplateSQL.personalData,
        }
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
}): Array<WithMetadata<EServiceTemplate>> => {
  const riskAnalysesSQLByEServiceTemplateId =
    createEServiceTemplateSQLPropertyMap(riskAnalysesSQL);
  const riskAnalysisAnswersSQLByEServiceTemplateId =
    createEServiceTemplateSQLPropertyMap(riskAnalysisAnswersSQL);
  const versionsSQLByEServiceTemplateId =
    createEServiceTemplateSQLPropertyMap(versionsSQL);
  const attributesSQLByEServiceTemplateId =
    createEServiceTemplateSQLPropertyMap(attributesSQL);
  const interfacesSQLByEServiceTemplateId =
    createEServiceTemplateSQLPropertyMap(interfacesSQL);
  const documentsSQLByEServiceTemplateId =
    createEServiceTemplateSQLPropertyMap(documentsSQL);

  return eserviceTemplatesSQL.map((eserviceTemplateSQL) => {
    const eserviceTemplateId = unsafeBrandId<EServiceTemplateId>(
      eserviceTemplateSQL.id
    );
    return aggregateEServiceTemplate({
      eserviceTemplateSQL,
      riskAnalysesSQL:
        riskAnalysesSQLByEServiceTemplateId.get(eserviceTemplateId) || [],
      riskAnalysisAnswersSQL:
        riskAnalysisAnswersSQLByEServiceTemplateId.get(eserviceTemplateId) ||
        [],
      versionsSQL:
        versionsSQLByEServiceTemplateId.get(eserviceTemplateId) || [],
      interfacesSQL:
        interfacesSQLByEServiceTemplateId.get(eserviceTemplateId) || [],
      documentsSQL:
        documentsSQLByEServiceTemplateId.get(eserviceTemplateId) || [],
      attributesSQL:
        attributesSQLByEServiceTemplateId.get(eserviceTemplateId) || [],
    });
  });
};

const createEServiceTemplateSQLPropertyMap = <
  T extends
    | EServiceTemplateVersionSQL
    | EServiceTemplateVersionInterfaceSQL
    | EServiceTemplateVersionDocumentSQL
    | EServiceTemplateVersionAttributeSQL
    | EServiceTemplateRiskAnalysisSQL
    | EServiceTemplateRiskAnalysisAnswerSQL
>(
  items: T[]
): Map<EServiceTemplateId, T[]> =>
  items.reduce((acc, item) => {
    const eserviceTemplateId = unsafeBrandId<EServiceTemplateId>(
      item.eserviceTemplateId
    );
    const values = acc.get(eserviceTemplateId) || [];
    // eslint-disable-next-line functional/immutable-data
    values.push(item);
    acc.set(eserviceTemplateId, values);

    return acc;
  }, new Map<EServiceTemplateId, T[]>());

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

  throwIfMultiple(eserviceTemplatesSQL, "e-service template");

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
      const attributePK = attributeSQL
        ? makeUniqueKey([
            attributeSQL.attributeId,
            attributeSQL.versionId,
            attributeSQL.groupId.toString(),
          ])
        : undefined;
      if (attributeSQL && attributePK && !attributeIdSet.has(attributePK)) {
        attributeIdSet.add(attributePK);
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
