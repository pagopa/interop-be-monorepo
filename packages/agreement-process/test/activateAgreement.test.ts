import { describe, expect, it } from "vitest";
import {
  getMockAgreement,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import {
  generateId,
  AgreementId,
  agreementState,
  EService,
  Agreement,
  Descriptor,
  descriptorState,
  TenantId,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  VerifiedTenantAttribute,
  Tenant,
  TenantAttribute,
} from "pagopa-interop-models";
import {
  agreementActivationFailed,
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotFound,
  descriptorNotInExpectedState,
  eServiceNotFound,
  operationNotAllowed,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  agreementActivableStates,
  agreementActivationAllowedDescriptorStates,
} from "../src/model/domain/validators.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  agreementService,
} from "./utils.js";

describe("activate agreement", () => {
  // TODO success case with requester === producer and state Pending >>> Active
  // TODO success case with requester === producer and satate Suspended >>> Active
  // TODO success case with requester === consumer and state Suspended >>> Active
  // TODO success case with requester === consumer and state Suspended >>> Suspended
  // TODO CHECK THAT THERE IS NO success case with requester === producer and state Suspended >>> Suspended
  // TODO CHECK THAT THERE IS NO success case with requester === consumer and state Pending >>> Active
  // TODO remember to test archiviation of other relating agreements in each success case
  // TODO remember to test the firstActivation VS non firstActivation case

  it("should throw an agreementNotFound error when the Agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());
    const authData = getRandomAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.activateAgreement(agreementId, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw an operationNotAllowed error when the requester is not the Consumer or Producer", async () => {
    const authData = getRandomAuthData();
    const agreement: Agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw an operationNotAllowed error when the requester is the Consumer and the Agreement is Pending", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
      consumerId,
    };
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should NOT throw an operationNotAllowed error when the requester is the Producer and the Agreement is Pending", async () => {
    const producerId = generateId<TenantId>();
    const authData = getRandomAuthData(producerId);

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
      producerId,
    };
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.not.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw an agreementNotInExpectedState error when the Agreement is not in an activable state", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (state) => !agreementActivableStates.includes(state)
        )
      ),
      consumerId,
    };
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should throw an eServiceNotFound error when the EService does not exist", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        agreementActivableStates.filter((s) => s !== agreementState.pending)
      ),
      consumerId,
    };
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw a descriptorNotFound error when the Descriptor does not exist", async () => {
    const consumerId = generateId<TenantId>();
    const producerId = generateId<TenantId>();
    const authData = getRandomAuthData(producerId);

    const eservice: EService = {
      ...getMockEService(),
      producerId,
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: eservice.id,
      consumerId,
      state: randomArrayItem(agreementActivableStates),
      producerId,
    };

    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      descriptorNotFound(agreement.eserviceId, agreement.descriptorId)
    );
  });

  it("should throw a descriptorNotInExpectedState error when the Descriptor is not in an expected state", async () => {
    const consumerId = generateId<TenantId>();
    const producerId = generateId<TenantId>();
    const authData = getRandomAuthData(producerId);

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(
        Object.values(descriptorState).filter(
          (state) => !agreementActivationAllowedDescriptorStates.includes(state)
        )
      ),
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementActivableStates),
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId,
      consumerId,
    };

    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      descriptorNotInExpectedState(
        eservice.id,
        descriptor.id,
        agreementActivationAllowedDescriptorStates
      )
    );
  });

  it("should throw a tenantNotFound error when the Consumer does not exist", async () => {
    const consumerId = generateId<TenantId>();
    const producerId = generateId<TenantId>();
    const authData = getRandomAuthData(producerId);

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementActivableStates),
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId,
      consumerId,
    };

    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(consumerId));
  });

  it("should throw a tenantNotFound error when the Producer does not exist", async () => {
    const producerId = generateId<TenantId>();
    const consumer = getMockTenant();
    const authData = getRandomAuthData(producerId);

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementActivableStates),
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId,
      consumerId: consumer.id,
    };

    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(producerId));
  });

  it("should throw an agreementActivationFailed when the agreement is Pending and there are invalid attributes", async () => {
    const producer = getMockTenant();

    const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const revokedTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const tenantVerifiedAttributeByAnotherProducer: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        { id: generateId<TenantId>(), verificationDate: new Date() },
      ],
    };

    const tenantVerfiedAttributeWithExpiredExtension: VerifiedTenantAttribute =
      {
        ...getMockVerifiedTenantAttribute(),
        verifiedBy: [
          {
            id: producer.id,
            verificationDate: new Date(),
            extensionDate: new Date(),
          },
        ],
      };

    const consumerInvalidAttribute: TenantAttribute = randomArrayItem([
      revokedTenantCertifiedAttribute,
      revokedTenantDeclaredAttribute,
      tenantVerifiedAttributeByAnotherProducer,
      tenantVerfiedAttributeWithExpiredExtension,
    ]);

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [consumerInvalidAttribute],
    };

    const authData = getRandomAuthData(producer.id);
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified:
          consumerInvalidAttribute.type === "PersistentCertifiedAttribute"
            ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
            : [[]],

        declared:
          consumerInvalidAttribute.type === "PersistentDeclaredAttribute"
            ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
            : [],
        verified:
          consumerInvalidAttribute.type === "PersistentVerifiedAttribute"
            ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
            : [],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementActivationFailed(agreement.id));
  });
});
