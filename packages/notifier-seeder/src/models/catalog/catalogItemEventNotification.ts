import {
  CatalogAttributeValueV1,
  CatalogDescriptorV1,
  CatalogDocumentV1,
  CatalogItemRiskAnalysisV1,
  CatalogItemV1,
} from "../../protobuf-models/v1/events.js";

/* 
The notification catalog event types was implemented to allow compatibility with old notifier consumers,
infact in the rest of the platform the old service expect the message with the same old format of event V1.
Furthermore some properties require different field-type mapping, because the old scala codebase 
applies some conversion on a specific fields before sending to queue:
- Date fields are converted to ISOstring
- Enum fields are converted using keys name and not its values

NOTE: this implementation is temporary and will be removed when all old services 
will be updated to digest a message with new format of V2 events.
*/

export type CatalogDocumentV1Notification = Omit<
  CatalogDocumentV1,
  "uploadDate"
> & {
  uploadDate: string;
};

type CatalogAttributesV1Notification = {
  certified: CatalogAttributeValueV1[][];
  verified: CatalogAttributeValueV1[][];
  declared: CatalogAttributeValueV1[][];
};

export type CatalogDescriptorV1Notification = Omit<
  CatalogDescriptorV1,
  | "docs"
  | "state"
  | "interface"
  | "createdAt"
  | "publishedAt"
  | "suspendedAt"
  | "deprecatedAt"
  | "archivedAt"
  | "agreementApprovalPolicy"
  | "attributes"
> & {
  docs: CatalogDocumentV1Notification[];
  state: string;
  interface?: CatalogDocumentV1Notification;
  createdAt: string;
  publishedAt?: string;
  suspendedAt?: string;
  deprecatedAt?: string;
  archivedAt?: string;
  agreementApprovalPolicy?: string;
  attributes: CatalogAttributesV1Notification;
};

export type CatalogItemRiskAnalysisV1Notification = Omit<
  CatalogItemRiskAnalysisV1,
  "createdAt"
> & {
  createdAt: string;
};

export type CatalogItemV1Notification = Omit<
  CatalogItemV1,
  | "technology"
  | "descriptors"
  | "createdAt"
  | "riskAnalysis"
  | "mode"
  | "attributes"
> & {
  technology: string;
  descriptors: CatalogDescriptorV1Notification[];
  createdAt: string;
  riskAnalysis: CatalogItemRiskAnalysisV1Notification[];
  mode: string;
  attributes?: CatalogAttributesV1Notification;
};

// CatalogItemV1AddedV1 | ClonedCatalogItemV1AddedV1 | CatalogItemV1UpdatedV1 | MovedAttributesFromEserviceToDescriptorsV1
export type CatalogItemNotification = {
  catalogItem: CatalogItemV1Notification;
};

// CatalogItemWithDescriptorsDeletedV1
export type CatalogItemDescriptorDeletedNotification = {
  catalogItem: CatalogItemV1Notification;
  descriptorId: string;
};

export type CatalogItemDocumentUpdateNotification = {
  eServiceId: string;
  descriptorId: string;
  documentId: string;
  updatedDocument: CatalogDocumentV1Notification;
  serverUrls: string[];
};

// CatalogItemDocumentAddedV1
export type CatalogItemDocumentAddedNotification = {
  eServiceId: string;
  descriptorId: string;
  document: CatalogDocumentV1Notification;
  isInterface: boolean;
  serverUrls: string[];
};

// CatalogItemDescriptorAddedV1 | CatalogItemDescriptorUpdatedV1
export type CatalogDescriptorNotification = {
  eServiceId: string;
  catalogDescriptor: CatalogDescriptorV1Notification;
};

// CatalogItemRiskAnalysisAddedV1 | CatalogItemRiskAnalysisUpdatedV1 | CatalogItemRiskAnalysisDeletedV1;
export type CatalogItemRiskAnalysisNotification = {
  catalogItem: CatalogItemV1Notification;
  catalogRiskAnalysisId: string;
};

// CatalogItemDeletedV1 | CatalogItemDocumentUpdatedV1
export type CatalogItemIdNotification = {
  catalogItemId: string;
};

// CatalogItemDocumentDeletedV1
export type CatalogItemDocumentDeletedNotification = {
  eServiceId: string;
  descriptorId: string;
  documentId: string;
};

export type CatalogItemEventNotification =
  | CatalogItemNotification
  | CatalogItemIdNotification
  | CatalogItemDocumentDeletedNotification
  | CatalogItemDocumentUpdateNotification
  | CatalogItemDocumentAddedNotification
  | CatalogDescriptorNotification
  | CatalogItemDescriptorDeletedNotification
  | CatalogItemRiskAnalysisNotification;
