import {
  Agreement,
  AgreementState,
  AgreementDocument,
  agreementState,
  unsafeBrandId,
  TenantAttribute,
  tenantAttributeType,
  AttributeId,
  TenantVerifier,
  TenantRevoker,
  badRequestError,
  CompactTenant,
  AgreementAttribute,
  UserId,
  AgreementStamps,
  TenantId,
} from "pagopa-interop-models";
import { agreementApi } from "pagopa-interop-api-clients";
import { P, match } from "ts-pattern";

export function agreementStateToApiAgreementState(
  input: AgreementState
): agreementApi.AgreementState {
  return match<AgreementState, agreementApi.AgreementState>(input)
    .with(agreementState.pending, () => "PENDING")
    .with(agreementState.rejected, () => "REJECTED")
    .with(agreementState.active, () => "ACTIVE")
    .with(agreementState.suspended, () => "SUSPENDED")
    .with(agreementState.archived, () => "ARCHIVED")
    .with(agreementState.draft, () => "DRAFT")
    .with(
      agreementState.missingCertifiedAttributes,
      () => "MISSING_CERTIFIED_ATTRIBUTES"
    )
    .exhaustive();
}

export function apiAgreementStateToAgreementState(
  input: agreementApi.AgreementState
): AgreementState {
  return match<agreementApi.AgreementState, AgreementState>(input)
    .with("PENDING", () => agreementState.pending)
    .with("REJECTED", () => agreementState.rejected)
    .with("ACTIVE", () => agreementState.active)
    .with("SUSPENDED", () => agreementState.suspended)
    .with("ARCHIVED", () => agreementState.archived)
    .with("DRAFT", () => agreementState.draft)
    .with(
      "MISSING_CERTIFIED_ATTRIBUTES",
      () => agreementState.missingCertifiedAttributes
    )
    .exhaustive();
}

export const agreementDocumentToApiAgreementDocument = (
  input: AgreementDocument
): agreementApi.Document => ({
  id: input.id,
  name: input.name,
  prettyName: input.prettyName,
  contentType: input.contentType,
  path: input.path,
  createdAt: input.createdAt?.toJSON(),
});

export const apiContractToContract = (
  input: agreementApi.Document
): AgreementDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: new Date(input.createdAt),
});

export const agreementToApiAgreement = (
  agreement: Agreement
): agreementApi.Agreement => ({
  id: agreement.id,
  eserviceId: agreement.eserviceId,
  descriptorId: agreement.descriptorId,
  producerId: agreement.producerId,
  consumerId: agreement.consumerId,
  state: agreementStateToApiAgreementState(agreement.state),
  verifiedAttributes: agreement.verifiedAttributes,
  certifiedAttributes: agreement.certifiedAttributes,
  declaredAttributes: agreement.declaredAttributes,
  suspendedByConsumer: agreement.suspendedByConsumer,
  suspendedByProducer: agreement.suspendedByProducer,
  suspendedByPlatform: agreement.suspendedByPlatform,
  consumerNotes: agreement.consumerNotes,
  rejectionReason: agreement.rejectionReason,
  consumerDocuments: agreement.consumerDocuments.map(
    agreementDocumentToApiAgreementDocument
  ),
  createdAt: agreement.createdAt?.toJSON(),
  updatedAt: agreement.updatedAt?.toJSON(),
  contract: agreement.contract
    ? agreementDocumentToApiAgreementDocument(agreement.contract)
    : undefined,
  suspendedAt: agreement.suspendedAt?.toJSON(),
});

export const apiAgreementDocumentToAgreementDocument = (
  input: agreementApi.DocumentSeed
): AgreementDocument => ({
  ...input,
  id: unsafeBrandId(input.id),
  createdAt: new Date(),
});

function fromApiTenantVerifier(
  verifier: agreementApi.TenantVerifier
): TenantVerifier {
  return {
    id: unsafeBrandId(verifier.id),
    verificationDate: new Date(verifier.verificationDate),
    expirationDate: verifier.expirationDate
      ? new Date(verifier.expirationDate)
      : undefined,
    extensionDate: verifier.extensionDate
      ? new Date(verifier.extensionDate)
      : undefined,
  };
}

function fromApiTenantRevoker(
  revoker: agreementApi.TenantRevoker
): TenantRevoker {
  return {
    id: unsafeBrandId(revoker.id),
    verificationDate: new Date(revoker.verificationDate),
    expirationDate: revoker.expirationDate
      ? new Date(revoker.expirationDate)
      : undefined,
    extensionDate: revoker.extensionDate
      ? new Date(revoker.extensionDate)
      : undefined,
    revocationDate: new Date(revoker.revocationDate),
  };
}

export const fromApiTenantAttribute = (
  input: agreementApi.TenantAttribute
): TenantAttribute =>
  match(input)
    .with(
      {
        certified: P.not(P.nullish),
        verified: P.optional(P.nullish),
        declared: P.optional(P.nullish),
      },
      ({ certified }) => ({
        type: tenantAttributeType.CERTIFIED,
        id: unsafeBrandId<AttributeId>(certified.id),
        assignmentTimestamp: new Date(certified.assignmentTimestamp),
        revocationTimestamp: certified.revocationTimestamp
          ? new Date(certified.revocationTimestamp)
          : undefined,
      })
    )
    .with(
      {
        verified: P.not(P.nullish),
        certified: P.optional(P.nullish),
        declared: P.optional(P.nullish),
      },
      ({ verified }) => ({
        type: tenantAttributeType.VERIFIED,
        id: unsafeBrandId<AttributeId>(verified.id),
        assignmentTimestamp: new Date(verified.assignmentTimestamp),
        verifiedBy: verified.verifiedBy.map(fromApiTenantVerifier),
        revokedBy: verified.revokedBy.map(fromApiTenantRevoker),
      })
    )
    .with(
      {
        declared: P.not(P.nullish),
        certified: P.optional(P.nullish),
        verified: P.optional(P.nullish),
      },
      ({ declared }) => ({
        type: tenantAttributeType.DECLARED,
        id: unsafeBrandId<AttributeId>(declared.id),
        assignmentTimestamp: new Date(declared.assignmentTimestamp),
        revocationTimestamp: declared.revocationTimestamp
          ? new Date(declared.revocationTimestamp)
          : undefined,
      })
    )
    .otherwise(() => {
      throw badRequestError(
        `Invalid tenant attribute in API request: ${JSON.stringify(input)}`
      );
    });

export const fromApiCompactTenant = (
  input: agreementApi.CompactTenant
): CompactTenant => ({
  id: unsafeBrandId(input.id),
  attributes: input.attributes.map(fromApiTenantAttribute),
});

const apiAttributeToAgreementAttribute = (
  apiAttribute:
    | agreementApi.VerifiedAttribute
    | agreementApi.DeclaredAttribute
    | agreementApi.CertifiedAttribute
): AgreementAttribute => ({
  ...apiAttribute,
  id: unsafeBrandId(apiAttribute.id),
});

export const apiAgreementToAgreement = (
  apiAgreement: agreementApi.Agreement,
  userId?: UserId
): Agreement => ({
  id: unsafeBrandId(apiAgreement.id),
  createdAt: new Date(apiAgreement.createdAt),
  eserviceId: unsafeBrandId(apiAgreement.eserviceId),
  descriptorId: unsafeBrandId(apiAgreement.descriptorId),
  producerId: unsafeBrandId(apiAgreement.producerId),
  consumerId: unsafeBrandId(apiAgreement.consumerId),
  state: apiAgreementStateToAgreementState(apiAgreement.state),
  verifiedAttributes: apiAgreement.verifiedAttributes.map((attr) =>
    apiAttributeToAgreementAttribute(attr)
  ),
  certifiedAttributes: apiAgreement.certifiedAttributes.map((attr) =>
    apiAttributeToAgreementAttribute(attr)
  ),
  declaredAttributes: apiAgreement.declaredAttributes.map((attr) =>
    apiAttributeToAgreementAttribute(attr)
  ),
  consumerDocuments: apiAgreement.consumerDocuments.map((doc) =>
    apiAgreementDocumentToAgreementDocument(doc)
  ),
  suspendedByConsumer: apiAgreement.suspendedByConsumer,
  suspendedByProducer: apiAgreement.suspendedByProducer,
  suspendedByPlatform: apiAgreement.suspendedByPlatform,
  consumerNotes: apiAgreement.consumerNotes,
  contract: apiAgreement.contract
    ? apiContractToContract(apiAgreement.contract)
    : undefined,
  stamps: userId
    ? agreementStamps(
        apiAgreement,
        userId,
        unsafeBrandId(apiAgreement.consumerId),
        unsafeBrandId(apiAgreement.producerId)
      )
    : {},
});

const draftStatement = (
  apiAgreement: agreementApi.Agreement,
  consumerId: TenantId,
  producerId: TenantId
): AgreementStamps => {
  if (apiAgreement.suspendedByConsumer) {
    return {
      suspensionByConsumer: {
        who: unsafeBrandId(consumerId),
        when: new Date(),
      },
    };
  } else if (apiAgreement.suspendedByProducer) {
    return {
      suspensionByProducer: {
        who: unsafeBrandId(producerId),
        when: new Date(),
      },
    };
  } else {
    return {};
  }
};

const suspendedStatement = (
  apiAgreement: agreementApi.Agreement,
  userId: UserId,
  consumerId: TenantId,
  producerId: TenantId
): AgreementStamps => {
  if (apiAgreement.suspendedByConsumer) {
    return {
      submission: {
        who: userId,
        when: new Date(),
      },
      activation: {
        who: userId,
        when: new Date(),
      },
      suspensionByConsumer: {
        who: unsafeBrandId(consumerId),
        when: new Date(),
      },
    };
  } else if (apiAgreement.suspendedByProducer) {
    return {
      submission: {
        who: userId,
        when: new Date(),
      },
      activation: {
        who: userId,
        when: new Date(),
      },
      suspensionByProducer: {
        who: unsafeBrandId(producerId),
        when: new Date(),
      },
    };
  } else {
    return {};
  }
};

const pendingStatement = (
  apiAgreement: agreementApi.Agreement,
  userId: UserId,
  consumerId: TenantId,
  producerId: TenantId
): AgreementStamps => {
  if (apiAgreement.suspendedByConsumer) {
    return {
      suspensionByConsumer: {
        who: unsafeBrandId(consumerId),
        when: new Date(),
      },
      submission: {
        who: userId,
        when: new Date(),
      },
    };
  } else if (apiAgreement.suspendedByProducer) {
    return {
      suspensionByProducer: {
        who: unsafeBrandId(producerId),
        when: new Date(),
      },
      submission: {
        who: userId,
        when: new Date(),
      },
    };
  } else {
    return {
      submission: {
        who: userId,
        when: new Date(),
      },
    };
  }
};

export const agreementStamps = (
  apiAgreement: agreementApi.Agreement,
  userId: UserId,
  consumerId: TenantId,
  producerId: TenantId
): AgreementStamps =>
  match(apiAgreement.state)
    .with("DRAFT", () => draftStatement(apiAgreement, consumerId, producerId))
    .with("ACTIVE", () => ({
      submission: {
        who: userId,
        when: new Date(),
      },
      activation: {
        who: userId,
        when: new Date(),
      },
    }))
    .with("REJECTED", () => ({
      submission: {
        who: userId,
        when: new Date(),
      },
      rejection: {
        who: userId,
        when: new Date(),
      },
    }))
    .with("ARCHIVED", () => ({
      submission: {
        who: userId,
        when: new Date(),
      },
      archiving: {
        who: userId,
        when: new Date(),
      },
    }))
    .with("SUSPENDED", () =>
      suspendedStatement(apiAgreement, userId, consumerId, producerId)
    )
    .with("PENDING", () =>
      pendingStatement(apiAgreement, userId, consumerId, producerId)
    )
    .otherwise(() => ({}));
