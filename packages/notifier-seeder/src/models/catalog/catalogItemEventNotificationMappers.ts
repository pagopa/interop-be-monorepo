import {
  AgreementApprovalPolicy,
  Descriptor,
  DescriptorState,
  Document,
  EService,
  EServiceAttribute,
  EServiceMode,
  RiskAnalysis,
  Technology,
  agreementApprovalPolicy,
  descriptorState,
  eserviceMode,
  technology,
} from "pagopa-interop-models";
import { CatalogAttributeValueV1 } from "../../protobuf-models/v1/events.js";
import {
  CatalogDescriptorV1Notification,
  CatalogDocumentV1Notification,
  CatalogItemRiskAnalysisV1Notification,
  CatalogItemV1Notification,
} from "./catalogItemEventNotification.js";

const toCatalogItemTechnologyV1 = (input: Technology): string => {
  switch (input) {
    case technology.rest:
      return "Rest";
    case technology.soap:
      return "Soap";
  }
};

const toCatalogDescriptorStateV1 = (input: DescriptorState): string => {
  switch (input) {
    case descriptorState.draft:
      return "Draft";
    case descriptorState.published:
      return "Published";
    case descriptorState.deprecated:
      return "Deprecated";
    case descriptorState.suspended:
      return "Suspended";
    case descriptorState.archived:
      return "Archived";
    case descriptorState.waitingForApproval:
      return "WaitingForApproval";
  }
};

const toAgreementApprovalPolicyV1 = (
  input: AgreementApprovalPolicy
): string => {
  switch (input) {
    case agreementApprovalPolicy.manual:
      return "Manual";
    case agreementApprovalPolicy.automatic:
      return "Automatic";
  }
};

const toCatalogItemModeV1 = (input: EServiceMode): string => {
  switch (input) {
    case eserviceMode.receive:
      return "Receive";
    case eserviceMode.deliver:
      return "Deliver";
  }
};

const toCatalogAttributeValueV1 = (
  input: EServiceAttribute[][] | undefined
): CatalogAttributeValueV1[][] => {
  const toCatalogAttributeValue = (
    a: EServiceAttribute
  ): CatalogAttributeValueV1 => ({
    id: a.id,
    explicitAttributeVerification: false,
  });

  return input ? input.map((a) => a.map(toCatalogAttributeValue)) : [];
};

const toCatalogDocumentV1 = (doc: Document): CatalogDocumentV1Notification => ({
  id: doc.id,
  name: doc.name,
  contentType: doc.contentType,
  path: doc.path,
  checksum: doc.checksum,
  uploadDate: doc.uploadDate.toISOString(),
  prettyName: doc.prettyName,
});

const toCatalogDescriptorV1 = (
  descriptors: Descriptor[]
): CatalogDescriptorV1Notification[] =>
  descriptors.map((d) => ({
    id: d.id,
    version: d.version,
    description: d.description,
    docs: d.docs.map(toCatalogDocumentV1),
    state: toCatalogDescriptorStateV1(d.state),
    interface: d.interface && toCatalogDocumentV1(d.interface),
    audience: d.audience,
    voucherLifespan: d.voucherLifespan,
    dailyCallsPerConsumer: d.dailyCallsPerConsumer,
    dailyCallsTotal: d.dailyCallsTotal,
    agreementApprovalPolicy: d.agreementApprovalPolicy
      ? toAgreementApprovalPolicyV1(d.agreementApprovalPolicy)
      : undefined,
    createdAt: d.createdAt.toISOString(),
    publishedAt: d.publishedAt?.toISOString(),
    serverUrls: d.serverUrls,
    suspendedAt: d.suspendedAt?.toISOString(),
    deprecatedAt: d.deprecatedAt?.toISOString(),
    archivedAt: d.archivedAt?.toISOString(),
    attributes: {
      certified: toCatalogAttributeValueV1(d.attributes.certified),
      declared: toCatalogAttributeValueV1(d.attributes.declared),
      verified: toCatalogAttributeValueV1(d.attributes.verified),
    },
  }));

const toCatalogItemRiskAnalysisV1 = (
  riskAnalysis: RiskAnalysis[]
): CatalogItemRiskAnalysisV1Notification[] =>
  riskAnalysis.map((riskAnalysis) => ({
    id: riskAnalysis.id,
    name: riskAnalysis.name,
    riskAnalysisForm: {
      id: riskAnalysis.riskAnalysisForm.id,
      version: riskAnalysis.riskAnalysisForm.version,
      singleAnswers: riskAnalysis.riskAnalysisForm.singleAnswers,
      multiAnswers: riskAnalysis.riskAnalysisForm.multiAnswers,
    },
    createdAt: riskAnalysis.createdAt.toISOString(),
  }));

export const toCatalogItemV1 = (
  event: EService
): CatalogItemV1Notification => ({
  id: event.id,
  producerId: event.producerId,
  name: event.name,
  description: event.description,
  technology: toCatalogItemTechnologyV1(event.technology),
  attributes: {
    certified: toCatalogAttributeValueV1(event?.attributes?.certified),
    declared: toCatalogAttributeValueV1(event?.attributes?.declared),
    verified: toCatalogAttributeValueV1(event?.attributes?.verified),
  },
  descriptors: toCatalogDescriptorV1(event.descriptors),
  createdAt: event.createdAt.toISOString(),
  riskAnalysis: toCatalogItemRiskAnalysisV1(event.riskAnalysis),
  mode: toCatalogItemModeV1(event.mode),
});
