/* eslint-disable functional/no-let */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeProtobufPayload,
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
} from "pagopa-interop-commons-test/index.js";
import { v4 as uuidv4 } from "uuid";
import {
  Agreement,
  AgreementUpdatedV1,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  EService,
  TenantId,
  VerifiedTenantAttribute,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { agreementSuspendableStates } from "../src/model/domain/validators.js";
import { toAgreementV1 } from "../src/model/domain/toEvent.js";
import {
  postgresDB,
  agreements,
  agreementService,
  eservices,
  tenants,
} from "./agreementService.integration.test.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readLastAgreementEvent,
} from "./utils.js";

export function testSuspendAgreement(): void {
  describe("suspend agreement", () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should succeed when requester is Consumer or Producer, Consumer has all attributes satisfied, and the Agreement is in an suspendable state", async () => {
      /* If the consumer has all the attributes satisfied,
      the agreement will be suspended with suspendedByPlatform flag set to false
      and suspendedByConsumer or suspendedByProducer flag set
      to true depending on the requester (consumer or producer) */
      const producerId = generateId<TenantId>();

      const tenantCertifiedAttribute: CertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: undefined,
      };

      const tenantDeclaredAttribute: DeclaredTenantAttribute = {
        ...getMockDeclaredTenantAttribute(),
        revocationTimestamp: undefined,
      };

      const tenantVerifiedAttribute: VerifiedTenantAttribute = {
        ...getMockVerifiedTenantAttribute(),
        verifiedBy: [
          {
            id: producerId,
            verificationDate: new Date(),
            extensionDate: new Date(new Date().getTime() + 3600 * 1000),
          },
        ],
      };

      const consumer = {
        ...getMockTenant(),
        attributes: [
          tenantCertifiedAttribute,
          tenantDeclaredAttribute,
          tenantVerifiedAttribute,
        ],
      };
      const descriptor: Descriptor = {
        ...getMockDescriptorPublished(),
        attributes: {
          certified: [[getMockEServiceAttribute(tenantCertifiedAttribute.id)]],
          declared: [[getMockEServiceAttribute(tenantDeclaredAttribute.id)]],
          verified: [[getMockEServiceAttribute(tenantVerifiedAttribute.id)]],
        },
      };
      const eservice: EService = {
        ...getMockEService(),
        producerId,
        descriptors: [descriptor],
      };

      const agreement: Agreement = {
        ...getMockAgreement(),
        consumerId: consumer.id,
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
        producerId: eservice.producerId,
        state: randomArrayItem(agreementSuspendableStates),
      };

      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);
      await addOneAgreement(agreement, postgresDB, agreements);

      const requesterId = randomArrayItem([
        agreement.consumerId,
        agreement.producerId,
      ]);
      const authData = getRandomAuthData(requesterId);

      await agreementService.suspendAgreement(agreement.id, authData, uuidv4());

      const agreementEvent = await readLastAgreementEvent(
        agreement.id,
        postgresDB
      );

      expect(agreementEvent).toMatchObject({
        type: "AgreementUpdated",
        event_version: 1,
        version: "0",
        stream_id: agreement.id,
      });

      const actualAgreementSuspended = decodeProtobufPayload({
        messageType: AgreementUpdatedV1,
        payload: agreementEvent.data,
      }).agreement;

      const expectedAgreementSuspended: Agreement = {
        ...agreement,
        state: agreementState.suspended,
        suspendedByPlatform: false,
        stamps: {
          ...agreement.stamps,
          suspensionByConsumer: {
            who: authData.userId,
            when: new Date(),
          },
        },
        [requesterId === agreement.consumerId
          ? "suspendedByConsumer"
          : "suspendedByProducer"]: true,
      };
      expect(actualAgreementSuspended).toMatchObject(
        toAgreementV1(expectedAgreementSuspended)
      );
    });
  });
}
