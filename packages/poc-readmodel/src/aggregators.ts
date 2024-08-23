import {
  DocumentSQL,
  Document,
  attributeKind,
  Descriptor,
  DescriptorAttributeSQL,
  DescriptorSQL,
  documentKind,
  EServiceAttribute,
} from "pagopa-interop-models";

export const documentSQLtoDocument = (input: DocumentSQL): Document => {
  const d: Document = {
    id: input.id,
    path: input.path,
    name: input.name,
    prettyName: input.pretty_name,
    contentType: input.content_type,
    checksum: input.checksum,
    uploadDate: input.upload_date || undefined,
  };
  // console.log(d);

  return d;
};

export const descriptorSQLtoDescriptor = (
  input: DescriptorSQL,
  documentsSQL: DocumentSQL[],
  attributesSQL: DescriptorAttributeSQL[]
): Descriptor => {
  const interfaceSQL = documentsSQL.find(
    (d) => d.document_kind === documentKind.descriptorInterface
  );

  const docsSQL = documentsSQL.filter(
    (d) => d.document_kind === documentKind.descriptorDocument
  );
  const parsedInterface = interfaceSQL
    ? documentSQLtoDocument(interfaceSQL)
    : undefined;

  const certifiedAttributesSQL = attributesSQL.filter(
    (a) => a.kind === attributeKind.certified
  );
  // const declaredAttributesSQL = attributesSQL.filter(
  //   (a) => a.kind === attributeKind.declared
  // );
  // const verifiedAttributesSQL = attributesSQL.filter(
  //   (a) => a.kind === attributeKind.verified
  // );

  const certifiedAttrMap = new Map<number, EServiceAttribute[]>();
  certifiedAttributesSQL.forEach((current) => {
    const currentAttribute: EServiceAttribute = {
      id: current.id,
      explicitAttributeVerification: current.explicit_attribute_verification,
    };
    const group = certifiedAttrMap.get(current.group_set);
    if (group) {
      certifiedAttrMap.set(current.group_set, [...group, currentAttribute]);
    } else {
      certifiedAttrMap.set(current.group_set, [currentAttribute]);
    }
  });

  const certifiedAttributes = Array.from(certifiedAttrMap.values());

  // console.log(certifiedAttrMap);
  const d: Descriptor = {
    id: input.id,
    version: input.version,
    description: input.version,
    interface: parsedInterface,
    docs: docsSQL.map(documentSQLtoDocument),
    state: input.state,
    audience: input.audience,
    voucherLifespan: input.voucher_lifespan,
    dailyCallsPerConsumer: input.daily_calls_per_consumer,
    dailyCallsTotal: input.daily_calls_total,
    agreementApprovalPolicy: input.agreement_approval_policy,
    createdAt: input.created_at,
    serverUrls: input.server_urls,
    publishedAt: input.published_at || undefined,
    suspendedAt: input.suspended_at || undefined,
    deprecatedAt: input.deprecated_at || undefined,
    archivedAt: input.archived_at || undefined,
    attributes: {
      certified: certifiedAttributes,
      verified: [],
      declared: [],
    },
  };
  // console.log(d);
  return d;
};
