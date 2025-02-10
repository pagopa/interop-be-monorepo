import {
  EService,
  EServiceSQL,
  DescriptorSQL,
  DescriptorAttributeSQL,
  DocumentSQL,
  Descriptor,
  attributeKind,
  documentKind,
  EServiceId,
  EServiceAttribute,
  DescriptorId,
  Document,
  DocumentKind,
  RiskAnalysis,
  EserviceRiskAnalysisSQL,
  RiskAnalysisAnswerSQL,
  riskAnalysisAnswerKind,
  AttributeKind,
  EServiceTemplateBindingSQL,
  DescriptorRejectionReasonSQL,
  DescriptorRejectionReason,
} from "pagopa-interop-models";

export const splitEserviceIntoObjectsSQL = (
  eservice: EService,
  version: number
): {
  eserviceSQL: EServiceSQL;
  riskAnalysisSQL: EserviceRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: RiskAnalysisAnswerSQL[];
  descriptorsSQL: DescriptorSQL[];
  attributesSQL: DescriptorAttributeSQL[];
  documentsSQL: DocumentSQL[];
  rejectionReasonsSQL: DescriptorRejectionReasonSQL[];
  eserviceTemplateBindingSQL?: EServiceTemplateBindingSQL;
} => {
  const eserviceSQL: EServiceSQL = {
    id: eservice.id,
    metadata_version: version,
    name: eservice.name,
    created_at: eservice.createdAt,
    producer_id: eservice.producerId,
    description: eservice.description,
    technology: eservice.technology,
    mode: eservice.mode,
    is_signal_hub_enabled: eservice.isSignalHubEnabled,
    is_consumer_delegable: eservice.isConsumerDelegable,
    is_client_access_delegable: eservice.isClientAccessDelegable,
  };

  const eserviceTemplateBindingSQL: EServiceTemplateBindingSQL = {
    eservice_id: eservice.id,
    metadata_version: version,
    eservice_template_id: eservice.id, // TODO
    instance_id: eservice.id, // TODO
    name: "", // TODO,
    email: "", // TODO,
    url: "", // TODO,
    terms_and_conditions_url: "", // TODO,
    server_url: "", // TODO
  };

  const { riskAnalysisSQL, riskAnalysisAnswersSQL } =
    eservice.riskAnalysis.reduce(
      (
        acc: {
          riskAnalysisSQL: EserviceRiskAnalysisSQL[];
          riskAnalysisAnswersSQL: RiskAnalysisAnswerSQL[];
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
          descriptorsSQL: DescriptorSQL[];
          attributesSQL: DescriptorAttributeSQL[];
          documentsSQL: DocumentSQL[];
          rejectionReasonsSQL: DescriptorRejectionReasonSQL[];
        },
        currentDescriptor: Descriptor
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
  group_id,
  kind,
  eserviceId,
  version,
}: {
  attribute: EServiceAttribute;
  descriptorId: DescriptorId;
  group_id: number;
  kind: AttributeKind;
  eserviceId: EServiceId;
  version: number;
}): DescriptorAttributeSQL => ({
  eservice_id: eserviceId,
  metadata_version: version,
  attribute_id: attribute.id,
  descriptor_id: descriptorId,
  explicit_attribute_verification: attribute.explicitAttributeVerification,
  kind,
  group_id,
});

const attributesNestedArrayToAttributeSQLarray = (
  descriptorId: DescriptorId,
  attributes: EServiceAttribute[][],
  kind: AttributeKind,
  eserviceId: EServiceId,
  version: number
): DescriptorAttributeSQL[] =>
  attributes.flatMap((group, index) =>
    group.map((attribute) =>
      attributeToAttributeSQL({
        attribute,
        descriptorId,
        group_id: index,
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
  descriptorSQL: DescriptorSQL;
  attributesSQL: DescriptorAttributeSQL[];
  documentsSQL: DocumentSQL[];
  rejectionReasonsSQL: DescriptorRejectionReasonSQL[];
} => {
  const descriptorSQL = descriptorToDescriptorSQL(
    eserviceId,
    descriptor,
    version
  );

  const attributesSQL: DescriptorAttributeSQL[] = [
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

  const rejectionReasonsSQL: DescriptorRejectionReasonSQL[] =
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
  riskAnalysis: RiskAnalysis,
  eserviceId: EServiceId,
  version: number
): {
  eserviceRiskAnalysisSQL: EserviceRiskAnalysisSQL;
  riskAnalysisAnswersSQL: RiskAnalysisAnswerSQL[];
} => {
  const eserviceRiskAnalysisSQL: EserviceRiskAnalysisSQL = {
    id: riskAnalysis.id,
    metadata_version: version,
    eservice_id: eserviceId,
    name: riskAnalysis.name,
    created_at: riskAnalysis.createdAt,
    risk_analysis_form_id: riskAnalysis.riskAnalysisForm.id,
    risk_analysis_form_version: riskAnalysis.riskAnalysisForm.version,
  };

  const riskAnalysisSingleAnwers: RiskAnalysisAnswerSQL[] =
    riskAnalysis.riskAnalysisForm.singleAnswers.map(
      (a) =>
        ({
          id: a.id,
          eservice_id: eserviceId,
          metadata_version: version,
          key: a.key,
          value: a.value ? [a.value] : [],
          risk_analysis_form_id: riskAnalysis.riskAnalysisForm.id,
          kind: riskAnalysisAnswerKind.single,
        } satisfies RiskAnalysisAnswerSQL)
    );
  const riskAnalysisMultiAnwers: RiskAnalysisAnswerSQL[] =
    riskAnalysis.riskAnalysisForm.multiAnswers.map(
      (a) =>
        ({
          id: a.id,
          eservice_id: eserviceId,
          metadata_version: version,
          key: a.key,
          value: a.values,
          risk_analysis_form_id: riskAnalysis.riskAnalysisForm.id,
          kind: riskAnalysisAnswerKind.multi,
        } satisfies RiskAnalysisAnswerSQL)
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
  documentKind: DocumentKind,
  descriptorId: DescriptorId,
  eserviceId: EServiceId,
  version: number
): DocumentSQL => ({
  id: document.id,
  eservice_id: eserviceId,
  metadata_version: version,
  descriptor_id: descriptorId,
  name: document.name,
  content_type: document.contentType,
  pretty_name: document.prettyName,
  path: document.path,
  checksum: document.checksum,
  upload_date: document.uploadDate,
  kind: documentKind,
});

export const descriptorToDescriptorSQL = (
  eserviceId: EServiceId,
  descriptor: Descriptor,
  version: number
): DescriptorSQL => ({
  id: descriptor.id,
  eservice_id: eserviceId,
  metadata_version: version,
  version: descriptor.version,
  description: descriptor.description,
  created_at: descriptor.createdAt,
  state: descriptor.state,
  audience: descriptor.audience,
  voucher_lifespan: descriptor.voucherLifespan,
  daily_calls_per_consumer: descriptor.dailyCallsPerConsumer,
  daily_calls_total: descriptor.dailyCallsTotal,
  server_urls: descriptor.serverUrls,
  agreement_approval_policy: descriptor.agreementApprovalPolicy,
  published_at: descriptor.publishedAt,
  suspended_at: descriptor.suspendedAt,
  deprecated_at: descriptor.deprecatedAt,
  archived_at: descriptor.archivedAt,
});

export const eserviceToEserviceSQL = (
  eservice: EService,
  version: number
): EServiceSQL => ({
  id: eservice.id,
  metadata_version: version,
  name: eservice.name,
  created_at: eservice.createdAt,
  producer_id: eservice.producerId,
  description: eservice.description,
  technology: eservice.technology,
  mode: eservice.mode,
});

export const rejectionReasonToRejectionReasonSQL = (
  rejectionReason: DescriptorRejectionReason,
  descriptorId: DescriptorId,
  eserviceId: EServiceId,
  version: number
): DescriptorRejectionReasonSQL => ({
  eservice_id: eserviceId,
  metadata_version: version,
  descriptor_id: descriptorId,
  rejection_reason: rejectionReason.rejectionReason,
  rejected_at: rejectionReason.rejectedAt,
});
