/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { randomInt } from "crypto";
import {
  randomArrayItem,
  getMockDelegation,
  getMockTenant,
  getMockAuthData,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementId,
  Tenant,
  AgreementDocumentId,
  generateId,
  AgreementDocument,
  TenantId,
  Delegation,
  AgreementStamp,
  UserId,
  delegationKind,
  delegationState,
  AgreementSignedContract,
} from "pagopa-interop-models";
import { agreementApi } from "pagopa-interop-api-clients";
import { UIAuthData, formatDateyyyyMMddHHmmss } from "pagopa-interop-commons";
import { subDays } from "date-fns";
import { match } from "ts-pattern";
import { z } from "zod";
import { config } from "../src/config/config.js";

export function getMockConsumerDocument(
  agreementId: AgreementId,
  name: string = "mockDocument"
): AgreementDocument {
  const id = generateId<AgreementDocumentId>();
  return {
    id,
    name,
    path: `${config.consumerDocumentsPath}/${agreementId}/${id}/${name}`,
    prettyName: "pretty name",
    contentType: "application/pdf",
    createdAt: new Date(),
  };
}

export function getMockDocumentSeed(
  document: AgreementDocument
): agreementApi.DocumentSeed {
  return {
    id: document.id,
    name: document.name,
    prettyName: document.prettyName,
    contentType: document.contentType,
    path: document.path,
  };
}

export function getMockContract(
  agreementId: AgreementId,
  consumerId: TenantId,
  producerId: TenantId
): AgreementDocument {
  const id = generateId<AgreementDocumentId>();
  const createdAt = new Date();
  const contractDocumentName = `${consumerId}_${producerId}_${formatDateyyyyMMddHHmmss(
    createdAt
  )}_agreement_contract.pdf`;
  return {
    id,
    contentType: "application/pdf",
    createdAt,
    path: `${config.agreementContractsPath}/${agreementId}/${id}/${contractDocumentName}`,
    prettyName: "Richiesta di fruizione",
    name: contractDocumentName,
  };
}
export function getMockSignedContract(
  agreementId: AgreementId,
  consumerId: TenantId,
  producerId: TenantId
): AgreementSignedContract {
  const id = generateId<AgreementDocumentId>();
  const createdAt = new Date();
  const signedAt = new Date();
  const contractDocumentName = `${consumerId}_${producerId}_${formatDateyyyyMMddHHmmss(
    createdAt
  )}_agreement_signed_contract.pdf`;
  return {
    id,
    contentType: "application/pdf",
    createdAt,
    path: `${config.agreementContractsPath}/${agreementId}/${id}/${contractDocumentName}`,
    prettyName: "Richiesta di fruizione",
    name: contractDocumentName,
    signedAt,
  };
}

export function getMockApiTenantCertifiedAttribute(): agreementApi.TenantAttribute {
  return {
    certified: {
      id: generateId(),
      assignmentTimestamp: new Date().toISOString(),
      revocationTimestamp: randomArrayItem([
        new Date().toISOString(),
        undefined,
      ]),
    },
  };
}

export function getMockApiTenantDeclaredAttribute(): agreementApi.TenantAttribute {
  return {
    declared: {
      id: generateId(),
      assignmentTimestamp: new Date().toISOString(),
      revocationTimestamp: randomArrayItem([
        new Date().toISOString(),
        undefined,
      ]),
    },
  };
}

export function getMockApiTenantVerifiedAttribute(): agreementApi.TenantAttribute {
  return {
    verified: {
      id: generateId(),
      assignmentTimestamp: new Date().toISOString(),
      verifiedBy: [
        {
          id: generateId(),
          verificationDate: new Date().toISOString(),
          expirationDate: randomArrayItem([
            new Date().toISOString(),
            undefined,
          ]),
          extensionDate: randomArrayItem([new Date().toISOString(), undefined]),
        },
      ],
      revokedBy: [
        {
          id: generateId(),
          verificationDate: new Date().toISOString(),
          revocationDate: new Date().toISOString(),
          expirationDate: randomArrayItem([
            new Date().toISOString(),
            undefined,
          ]),
          extensionDate: randomArrayItem([new Date().toISOString(), undefined]),
        },
      ],
    },
  };
}

export const getRandomPastStamp = (
  userId: UserId = generateId<UserId>()
): AgreementStamp => ({
  who: userId,
  when: subDays(new Date(), randomInt(10)),
});

export const requesterIs = {
  producer: "Producer",
  consumer: "Consumer",
  delegateProducer: "DelegateProducer",
  delegateConsumer: "DelegateConsumer",
} as const;
export const RequesterIs = z.enum([
  Object.values(requesterIs)[0],
  ...Object.values(requesterIs).slice(1),
]);
export type RequesterIs = z.infer<typeof RequesterIs>;

export const authDataAndDelegationsFromRequesterIs = (
  requesterIs: RequesterIs,
  agreement: Agreement
): {
  authData: UIAuthData;
  producerDelegation: Delegation | undefined;
  delegateProducer: Tenant | undefined;
  consumerDelegation: Delegation | undefined;
  delegateConsumer: Tenant | undefined;
} =>
  match(requesterIs)
    .with("Producer", () => ({
      authData: getMockAuthData(agreement.producerId),
      producerDelegation: undefined,
      delegateProducer: undefined,
      consumerDelegation: undefined,
      delegateConsumer: undefined,
    }))
    .with("Consumer", () => ({
      authData: getMockAuthData(agreement.consumerId),
      producerDelegation: undefined,
      delegateProducer: undefined,
      consumerDelegation: undefined,
      delegateConsumer: undefined,
    }))
    .with("DelegateProducer", () => {
      const delegateProducer = getMockTenant();
      const producerDelegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegatorId: agreement.producerId,
        delegateId: delegateProducer.id,
        state: delegationState.active,
        eserviceId: agreement.eserviceId,
      });

      return {
        authData: getMockAuthData(delegateProducer.id),
        producerDelegation,
        delegateProducer,
        consumerDelegation: undefined,
        delegateConsumer: undefined,
      };
    })
    .with("DelegateConsumer", () => {
      const delegateConsumer = getMockTenant();
      const consumerDelegation = getMockDelegation({
        kind: delegationKind.delegatedConsumer,
        delegatorId: agreement.consumerId,
        delegateId: delegateConsumer.id,
        state: delegationState.active,
        eserviceId: agreement.eserviceId,
      });
      return {
        authData: getMockAuthData(delegateConsumer.id),
        consumerDelegation,
        delegateConsumer,
        producerDelegation: undefined,
        delegateProducer: undefined,
      };
    })
    .exhaustive();
