/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  DescriptorAttributeSQL,
  DescriptorId,
  DescriptorSQL,
  DocumentSQL,
  EServiceId,
  EServiceSQL,
} from "pagopa-interop-models";
import pgPromise from "pg-promise";

export const prepareInsertEservice = (
  eserviceSQL: EServiceSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "insert-eservice",
    text: "INSERT INTO readmodel.eservice(id, producer_id, name, description, technology, created_at, mode) VALUES($1, $2, $3, $4, $5, $6, $7)",
    values: [
      eserviceSQL.id,
      eserviceSQL.producer_id,
      eserviceSQL.name,
      eserviceSQL.description,
      eserviceSQL.technology,
      eserviceSQL.created_at,
      eserviceSQL.mode,
    ],
  });

export const prepareReadEservice = (id: EServiceId): any =>
  new pgPromise.PreparedStatement({
    name: "read-eservice",
    text: "SELECT * FROM readmodel.eservice WHERE id = $1",
    values: [id],
  });

export const prepareInsertDescriptor = (
  descriptorSQL: DescriptorSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "insert-descriptor",
    text: "INSERT INTO readmodel.descriptor(id, eservice_id, version, description, state, audience, voucher_lifespan, daily_calls_per_consumer, daily_calls_total, agreement_approval_policy, created_at, server_urls, published_at, suspended_at, deprecated_at, archived_at) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)",
    values: [
      descriptorSQL.id,
      descriptorSQL.eservice_id,
      descriptorSQL.version,
      descriptorSQL.description,
      descriptorSQL.state,
      descriptorSQL.audience,
      descriptorSQL.voucher_lifespan,
      descriptorSQL.daily_calls_per_consumer,
      descriptorSQL.daily_calls_total,
      descriptorSQL.agreement_approval_policy,
      descriptorSQL.created_at,
      descriptorSQL.server_urls,
      descriptorSQL.published_at,
      descriptorSQL.suspended_at,
      descriptorSQL.deprecated_at,
      descriptorSQL.archived_at,
    ],
  });

export const prepareReadDescriptorsByEserviceId = (id: EServiceId): any =>
  new pgPromise.PreparedStatement({
    name: "read-descriptors-by-eservice-id",
    text: "SELECT * FROM readmodel.descriptor WHERE eservice_id = $1",
    values: [id],
  });

export const prepareInsertDescriptorDocument = (
  documentSQL: DocumentSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "insert-document",
    text: "INSERT INTO readmodel.document(id, descriptor_id, name, content_type, pretty_name, path, checksum, upload_date, document_kind) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    values: [
      documentSQL.id,
      documentSQL.descriptor_id,
      documentSQL.name,
      documentSQL.content_type,
      documentSQL.pretty_name,
      documentSQL.path,
      documentSQL.checksum,
      documentSQL.upload_date,
      documentSQL.document_kind,
    ],
  });

export const prepareReadDocumentsByDescriptorId = (id: DescriptorId): any =>
  new pgPromise.PreparedStatement({
    name: "read-descriptor-documents-by-descriptor-id",
    text: "SELECT * FROM readmodel.document WHERE descriptor_id = $1",
    values: [id],
  });

export const prepareReadDocumentsByEserviceId = (id: EServiceId): any =>
  new pgPromise.PreparedStatement({
    name: "read-documents-by-eservice-id",
    text: "SELECT * FROM readmodel.document WHERE document.descriptor_id IN (SELECT id FROM readmodel.descriptor WHERE descriptor.eservice_id = $1)",
    values: [id],
  });

export const prepareInsertDescriptorAttribute = (
  attributeSQL: DescriptorAttributeSQL
): pgPromise.PreparedStatement =>
  new pgPromise.PreparedStatement({
    name: "insert-descriptor-attribute",
    text: "INSERT INTO readmodel.descriptor_attribute(attribute_id, descriptor_id, explicit_attribute_verification, kind, group_set) VALUES($1, $2, $3, $4, $5)",
    values: [
      attributeSQL.attribute_id,
      attributeSQL.descriptor_id,
      attributeSQL.explicit_attribute_verification,
      attributeSQL.kind,
      attributeSQL.group_set,
    ],
  });

export const prepareReadDescriptorAttributesByDescriptorId = (
  id: DescriptorId
): any =>
  new pgPromise.PreparedStatement({
    name: "read-descriptor-attributes",
    text: "SELECT * FROM readmodel.descriptor_attribute WHERE descriptor_id = $1",
    values: [id],
  });

export const prepareReadDescriptorAttributesByEserviceId = (
  id: EServiceId
): any =>
  new pgPromise.PreparedStatement({
    name: "read-descriptor-attributes-by-eservice-id",
    text: "SELECT * FROM readmodel.descriptor_attribute as attribute WHERE attribute.descriptor_id IN (SELECT id FROM readmodel.descriptor WHERE descriptor.eservice_id = $1)",
    values: [id],
  });

export const prepareReadDescriptorsByEserviceIds = (ids: EServiceId[]): any =>
  new pgPromise.PreparedStatement({
    name: "read-descriptors-by-eservices-ids",
    text: "SELECT * FROM readmodel.descriptor WHERE eservice_id IN ($1:list)",
    values: [ids],
  });

export const prepareReadDescriptorAttributesByDescriptorIds = (
  ids: DescriptorId[]
): any =>
  new pgPromise.PreparedStatement({
    name: "read-descriptor-attributes",
    text: "SELECT * FROM readmodel.descriptor_attribute WHERE descriptor_id IN ($1:list)",
    values: [ids],
  });

export const prepareReadDocumentsByDescriptorIds = (ids: DescriptorId[]): any =>
  new pgPromise.PreparedStatement({
    name: "read-descriptor-documents-by-descriptors-ids",
    text: "SELECT * FROM readmodel.document WHERE descriptor_id IN ($1:list)",
    values: [ids],
  });
