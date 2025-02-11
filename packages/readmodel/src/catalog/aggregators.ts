import {
  Document,
  attributeKind,
  Descriptor,
  documentKind,
  EServiceAttribute,
  EService,
  RiskAnalysis,
  riskAnalysisAnswerKind,
  RiskAnalysisSingleAnswer,
  RiskAnalysisSingleAnswerId,
  RiskAnalysisMultiAnswer,
  RiskAnalysisMultiAnswerId,
  WithMetadata,
  EServiceTemplateBindingSQL,
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
} from "pagopa-interop-models";
import {
  EServiceDescriptorAttributeSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceDescriptorSQL,
  EServiceRiskAnalysisAnswerSQL,
  EServiceRiskAnalysisSQL,
  EServiceSQL,
} from "../types.js";

export const documentSQLtoDocument = (
  input: EServiceDescriptorDocumentSQL
): Document => ({
  id: unsafeBrandId<EServiceDocumentId>(input.id),
  path: input.path,
  name: input.name
  prettyName: input.prettyName,
  contentType: input.contentType,
  checksum: input.checksum,
  uploadDate: new Date(input.uploadDate),
});

export const descriptorSQLtoDescriptor = (
  input: EServiceDescriptorSQL,
  documentsSQL: EServiceDescriptorDocumentSQL[],
  attributesSQL: EServiceDescriptorAttributeSQL[]
): Descriptor => {
  const interfaceSQL = documentsSQL.find(
    (d) => d.kind === documentKind.descriptorInterface
  );

  const docsSQL = documentsSQL.filter(
    (d) => d.kind === documentKind.descriptorDocument
  );
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

  return {
    id: unsafeBrandId<DescriptorId>(input.id),
    version: input.version,
    description: input.description || undefined,
    interface: parsedInterface,
    docs: docsSQL.map(documentSQLtoDocument),
    state: DescriptorState.parse(input.state),
    audience: input.audience,
    voucherLifespan: input.voucherLifespan,
    dailyCallsPerConsumer: input.dailyCallsPerConsumer,
    dailyCallsTotal: input.dailyCallsTotal,
    agreementApprovalPolicy: AgreementApprovalPolicy.parse(
      input.agreementApprovalPolicy
    ),
    createdAt: new Date(input.createdAt),
    serverUrls: input.serverUrls,
    publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined,
    suspendedAt: input.suspendedAt ? new Date(input.suspendedAt) : undefined,
    deprecatedAt: input.deprecatedAt ? new Date(input.deprecatedAt) : undefined,
    archivedAt: input.archivedAt ? new Date(input.archivedAt) : undefined,
    attributes: {
      certified: certifiedAttributes,
      declared: declaredAttributes,
      verified: verifiedAttributes,
    },
  };
};

export const eserviceSQLtoEservice = ({
  eserviceSQL,
  riskAnalysesSQL,
  riskAnalysisAnswersSQL,
  descriptorsSQL,
  attributesSQL,
  documentsSQL,
  rejectionReasonToRejectionReasonSQL,
  eserviceTemplateBindingSQL,
}: {
  eserviceSQL: EServiceSQL;
  riskAnalysesSQL: EServiceRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
  descriptorsSQL: EServiceDescriptorSQL[];
  attributesSQL: EServiceDescriptorAttributeSQL[];
  documentsSQL: EServiceDescriptorDocumentSQL[];
  rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
  eserviceTemplateBindingSQL?: EServiceTemplateBindingSQL;
}): WithMetadata<EService> => {
  const descriptors = descriptorsSQL.map((descriptor) =>
    descriptorSQLtoDescriptor(
      descriptor,
      documentsSQL.filter((d) => d.descriptorId === descriptor.id),
      attributesSQL.filter((a) => a.descriptorId === descriptor.id)
    )
  );

  const riskAnalysis = riskAnalysesSQL.map((ra) =>
    riskAnalysisSQLtoRiskAnalysis(
      ra,
      riskAnalysisAnswersSQL.filter(
        (answer) => answer.riskAnalysisFormId === ra.riskAnalysisFormId
      )
    )
  );
  const eservice: EService = {
    id: unsafeBrandId<EServiceId>(eserviceSQL.id),
    name: eserviceSQL.name,
    createdAt: new Date(eserviceSQL.createdAt),
    producerId: unsafeBrandId<TenantId>(eserviceSQL.producerId),
    description: eserviceSQL.description,
    technology: Technology.parse(eserviceSQL.technology),
    descriptors,
    riskAnalysis,
    mode: EServiceMode.parse(eserviceSQL.mode),
  };
  return {
    data: eservice,
    metadata: { version: eserviceSQL.metadataVersion },
  };
};

/*
export const eserviceSQLArraytoEserviceArray = (
  eservicesSQL: EServiceSQL[],
  riskAnalysisSQL: EserviceRiskAnalysisSQL[],
  riskAnalysisAnswers: RiskAnalysisAnswerSQL[],
  descriptorsSQL: DescriptorSQL[],
  documentsSQL: DocumentSQL[],
  attributesSQL: DescriptorAttributeSQL[]
  // eslint-disable-next-line max-params
): Array<WithMetadata<EService>> =>
  eservicesSQL.map((eservice) => {
    const riskAnalysisSQLOfCurrentEservice = riskAnalysisSQL.filter(
      (ra) => ra.eservice_id === eservice.id
    );

    const formIds = riskAnalysisSQLOfCurrentEservice.map(
      (ra) => ra.risk_analysis_form_id
    );

    const riskAnalysisAnswersSQLOfCurrentEservice = riskAnalysisAnswers.filter(
      (ra) => formIds.includes(ra.risk_analysis_form_id)
    );

    const descriptorsSQLOfCurrentEservice = descriptorsSQL.filter(
      (d) => d.eservice_id === eservice.id
    );
    const descriptorsIds = descriptorsSQL.map((d) => d.id);

    const documentsSQLOfCurrentEservice = documentsSQL.filter((doc) =>
      descriptorsIds.includes(doc.descriptor_id)
    );

    const attributesSQLOfCurrentEservice = attributesSQL.filter((attr) =>
      descriptorsIds.includes(attr.descriptor_id)
    );

    return eserviceSQLtoEservice(
      eservice,
      riskAnalysisSQLOfCurrentEservice,
      riskAnalysisAnswersSQLOfCurrentEservice,
      descriptorsSQLOfCurrentEservice,
      documentsSQLOfCurrentEservice,
      attributesSQLOfCurrentEservice
    );
  });

  */

export const riskAnalysisSQLtoRiskAnalysis = (
  riskAnalysisSQL: EServiceRiskAnalysisSQL,
  answers: EServiceRiskAnalysisAnswerSQL[]
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
    createdAt: new Date(riskAnalysisSQL.createdAt),
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
  attributesSQL: EServiceDescriptorAttributeSQL[]
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
