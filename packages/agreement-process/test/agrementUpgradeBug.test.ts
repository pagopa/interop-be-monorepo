/* eslint-disable functional/immutable-data */
import { genericLogger } from "pagopa-interop-commons";
import {
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  getRandomAuthData,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import {
  Agreement,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  Tenant,
  VerifiedTenantAttribute,
  agreementState,
  attributeKind,
  generateId,
  toReadModelAgreement,
} from "pagopa-interop-models";
import { UserResponse } from "pagopa-interop-selfcare-v2-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addOneAttribute,
  addOneEService,
  addOneTenant,
  agreementService,
  agreements,
  selfcareV2ClientMock,
} from "./utils.js";

describe("Upgrade suspended agreement activation", () => {
  const mockSelfcareUserResponse: UserResponse = {
    email: "test@test.com",
    name: "Test Name",
    surname: "Test Surname",
    id: generateId(),
    taxCode: "TSTTSTTSTTSTTSTT",
  };
  beforeEach(async () => {
    selfcareV2ClientMock.getUserInfoUsingGET = vi.fn(
      async () => mockSelfcareUserResponse
    );
  });

  async function updateAgreementInReadModel(
    agreement: Agreement,
    currentVersion: number
  ): Promise<void> {
    await agreements.updateOne(
      {
        "data.id": agreement.id,
        "metadata.version": currentVersion,
      },
      {
        $set: {
          data: toReadModelAgreement(agreement),
          metadata: {
            version: currentVersion + 1,
          },
        },
      }
    );
  }

  it("should keep an agreement suspended if it was already suspended", async () => {
    const producer = getMockTenant();

    const validCertifiedTenantAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validCertifiedEserviceAttribute = getMockEServiceAttribute(
      validCertifiedTenantAttribute.id
    );

    const validDeclaredTenantAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validDeclaredEserviceAttribute = getMockEServiceAttribute(
      validDeclaredTenantAttribute.id
    );

    const validVerifiedTenantAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(new Date().getFullYear() - 1),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };
    const validVerifiedEserviceAttribute = getMockEServiceAttribute(
      validVerifiedTenantAttribute.id
    );

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        validCertifiedTenantAttribute,
        validDeclaredTenantAttribute,
        validVerifiedTenantAttribute,
      ],
      selfcareId: generateId(),
      mails: [
        {
          id: "521467f9-bdc7-41e3-abf1-49c8c174e1ac",
          kind: "CONTACT_EMAIL",
          address: "testerforAgreementimpossibile@testbug.pagopa.org",
          createdAt: new Date(),
        },
      ],
    };

    const descriptorId = generateId<DescriptorId>();
    const descriptorV1: Descriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[validCertifiedEserviceAttribute]],
        [[validDeclaredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      version: "1",
      agreementApprovalPolicy: "Automatic",
    };

    const eserviceId = generateId<EServiceId>();
    const eservice: EService = {
      ...getMockEService(eserviceId, producer.id, [descriptorV1]),
    };

    await addOneEService(eservice);
    await addOneTenant(producer);
    await addOneTenant(consumer);
    await addOneAttribute({
      id: validCertifiedEserviceAttribute.id,
      kind: attributeKind.certified,
      description: "A certified attribute",
      name: "A certified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    });
    await addOneAttribute({
      id: validDeclaredEserviceAttribute.id,
      kind: attributeKind.declared,
      description: "A declared attribute",
      name: "A declared attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    });
    await addOneAttribute({
      id: validVerifiedEserviceAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    });
    // 1) Consumer creates an Agreement
    const consumerAuthData = getRandomAuthData(consumer.id);
    const createdAgreement = await agreementService.createAgreement(
      {
        eserviceId,
        descriptorId,
      },
      {
        authData: consumerAuthData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );

    expect(createdAgreement.state).toEqual(agreementState.draft);
    await writeInReadmodel(toReadModelAgreement(createdAgreement), agreements);

    // 2) Consumer submits the agreement (making it Active)
    const submittedAgreement = await agreementService.submitAgreement(
      createdAgreement.id,
      {
        consumerNotes: "Some notes here!",
      },
      {
        authData: consumerAuthData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );

    expect(submittedAgreement.state).toEqual(agreementState.active);
    await updateAgreementInReadModel(submittedAgreement, 0);

    // 3) Consumer suspends agreement
    const suspendedAgreement = await agreementService.suspendAgreement(
      submittedAgreement.id,
      {
        authData: consumerAuthData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );

    expect(suspendedAgreement.state).toEqual(agreementState.suspended);
    expect(suspendedAgreement.suspendedByConsumer).toEqual(true);
    expect(suspendedAgreement.suspendedByProducer).toEqual(undefined);
    expect(suspendedAgreement.suspendedByPlatform).toEqual(false);
    await updateAgreementInReadModel(suspendedAgreement, 1);

    // 4) creazione nuovo descriptor V2
    // 5) upgrade da parte del fruitore
    // 6) attivazione da parte dell'erogatore
    // const producerAuthData = getRandomAuthData(producer.id);

    // ACTUAL
    // L'agreement viene attivato

    // EXPECTED
    // L'agreement dovrebbe essere sospeso dato che
    // era stato sospeso dal fruitore, e ad attivarlo è l'erogatore
  });
});
