import {
  EService,
  EServiceSQL,
  DescriptorSQL,
  DescriptorAttributeSQL,
  DocumentSQL,
  Descriptor,
  attributeKind,
  documentKind,
} from "pagopa-interop-models";

export const splitEserviceIntoObjectsSQL = (
  eservice: EService
): {
  eserviceSQL: EServiceSQL;
  descriptorsSQL: DescriptorSQL[];
  attributesSQL: DescriptorAttributeSQL[];
  documentsSQL: DocumentSQL[];
} => {
  const eserviceSQL: EServiceSQL = {
    name: eservice.name,
    id: eservice.id,
    created_at: eservice.createdAt,
    producer_id: eservice.producerId,
    description: eservice.description,
    technology: eservice.technology,
    mode: eservice.mode,
  };

  const { descriptorsSQL, attributesSQL, documentsSQL } =
    eservice.descriptors.reduce(
      (
        acc: {
          descriptorsSQL: DescriptorSQL[];
          attributesSQL: DescriptorAttributeSQL[];
          documentsSQL: DocumentSQL[];
        },
        currentDescriptor: Descriptor
      ) => {
        const descriptorSQL: DescriptorSQL = {
          version: currentDescriptor.version,
          id: currentDescriptor.id,
          description: currentDescriptor.description,
          created_at: currentDescriptor.createdAt,
          eservice_id: eservice.id,
          state: currentDescriptor.state,
          audience: currentDescriptor.audience,
          voucher_lifespan: currentDescriptor.voucherLifespan,
          daily_calls_per_consumer: currentDescriptor.dailyCallsPerConsumer,
          daily_calls_total: currentDescriptor.dailyCallsTotal,
          server_urls: currentDescriptor.serverUrls,
          agreement_approval_policy: currentDescriptor.agreementApprovalPolicy,
          published_at: currentDescriptor.publishedAt,
          suspended_at: currentDescriptor.suspendedAt,
          deprecated_at: currentDescriptor.deprecatedAt,
          archived_at: currentDescriptor.archivedAt,
        };

        const attributesSQL = [
          ...currentDescriptor.attributes.certified.flatMap((group, index) =>
            group.map(
              (attribute) =>
                ({
                  attribute_id: attribute.id,
                  descriptor_id: currentDescriptor.id,
                  explicit_attribute_verification:
                    attribute.explicitAttributeVerification,
                  kind: attributeKind.certified,
                  group_set: index,
                } satisfies DescriptorAttributeSQL)
            )
          ),
          ...currentDescriptor.attributes.declared.flatMap((group, index) =>
            group.map(
              (attribute) =>
                ({
                  attribute_id: attribute.id,
                  descriptor_id: currentDescriptor.id,
                  explicit_attribute_verification:
                    attribute.explicitAttributeVerification,
                  kind: attributeKind.declared,
                  group_set: index,
                } satisfies DescriptorAttributeSQL)
            )
          ),
          ...currentDescriptor.attributes.verified.flatMap((group, index) =>
            group.map(
              (attribute) =>
                ({
                  attribute_id: attribute.id,
                  descriptor_id: currentDescriptor.id,
                  explicit_attribute_verification:
                    attribute.explicitAttributeVerification,
                  kind: attributeKind.verified,
                  group_set: index,
                } satisfies DescriptorAttributeSQL)
            )
          ),
        ];
        const interfaceSQL = currentDescriptor.interface
          ? ({
              id: currentDescriptor.interface.id,
              descriptor_id: currentDescriptor.id,
              name: currentDescriptor.interface.name,
              content_type: currentDescriptor.interface.contentType,
              pretty_name: currentDescriptor.interface.prettyName,
              path: currentDescriptor.interface.path,
              checksum: currentDescriptor.interface.checksum,
              upload_date: currentDescriptor.interface.uploadDate,
              document_kind: documentKind.descriptorInterface,
            } satisfies DocumentSQL)
          : undefined;
        const documentsSQL = currentDescriptor.docs.map((doc) => {
          const documentSQL: DocumentSQL = {
            path: doc.path,
            name: doc.name,
            id: doc.id,
            pretty_name: doc.prettyName,
            content_type: doc.contentType,
            descriptor_id: currentDescriptor.id,
            checksum: doc.checksum,
            upload_date: doc.uploadDate,
            document_kind: documentKind.descriptorDocument,
          };
          return documentSQL;
        });

        // console.log(acc);
        return {
          descriptorsSQL: acc.descriptorsSQL.concat([descriptorSQL]),
          attributesSQL: acc.attributesSQL.concat(attributesSQL),
          documentsSQL: interfaceSQL
            ? acc.documentsSQL.concat([interfaceSQL, ...documentsSQL])
            : acc.documentsSQL.concat(documentsSQL),
        };
      },
      { descriptorsSQL: [], attributesSQL: [], documentsSQL: [] }
    );

  return { eserviceSQL, descriptorsSQL, attributesSQL, documentsSQL };
};
