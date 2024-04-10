/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable fp/no-delete */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */
import {
  getMockAgreement,
  getRandomAuthData,
  decodeProtobufPayload,
  randomArrayItem,
  getMockEService,
  getMockDescriptorPublished,
  getMockTenant,
  getMockCertifiedTenantAttribute,
  getMockEServiceAttribute,
  getMockVerifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementUpdatedV1,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  EService,
  Tenant,
  TenantId,
  VerifiedTenantAttribute,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { agreementRejectableStates } from "../src/model/domain/validators.js";
import { toAgreementV1 } from "../src/model/domain/toEvent.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readLastAgreementEvent,
} from "./utils.js";
import {
  postgresDB,
  agreements,
  agreementService,
  tenants,
  eservices,
} from "./agreementService.test.setup.js";

describe("reject agreement", () => {
  it("should succeed when requester is Producer and the Agreement is in a rejectable state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const producerId = generateId<TenantId>();
    const tenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const tenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const revokedTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: new Date(),
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
            id: producerId,
            verificationDate: new Date(),
            extensionDate: new Date(),
          },
        ],
      };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        tenantCertifiedAttribute,
        revokedTenantCertifiedAttribute,
        tenantDeclaredAttribute,
        revokedTenantDeclaredAttribute,
        tenantVerifiedAttribute,
        tenantVerifiedAttributeByAnotherProducer,
        tenantVerfiedAttributeWithExpiredExtension,
        // Adding some attributes not matching with descriptor attributes
        // to test that they are not kept in the agreement
        getMockVerifiedTenantAttribute(),
        getMockCertifiedTenantAttribute(),
        getMockDeclaredTenantAttribute(),
      ],
    };
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      attributes: {
        // I add also some attributes not matching with tenant attributes
        // to test that they are not kept in the agreement
        certified: [
          [
            getMockEServiceAttribute(tenantCertifiedAttribute.id),
            getMockEServiceAttribute(revokedTenantCertifiedAttribute.id),
            getMockEServiceAttribute(),
          ],
        ],
        verified: [
          [
            getMockEServiceAttribute(tenantVerifiedAttribute.id),
            getMockEServiceAttribute(
              tenantVerifiedAttributeByAnotherProducer.id
            ),
            getMockEServiceAttribute(
              tenantVerfiedAttributeWithExpiredExtension.id
            ),
            getMockEServiceAttribute(),
          ],
        ],
        declared: [
          [
            getMockEServiceAttribute(tenantDeclaredAttribute.id),
            getMockEServiceAttribute(revokedTenantDeclaredAttribute.id),
            getMockEServiceAttribute(),
          ],
        ],
      },
    };
    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const agreement = {
      ...getMockAgreement(),
      eserviceId: eservice.id,
      producerId: eservice.producerId,
      descriptorId: descriptor.id,
      consumerId: consumer.id,
      state: randomArrayItem(agreementRejectableStates),
    };
    await addOneTenant(consumer, tenants);
    await addOneEService(eservice, eservices);
    await addOneAgreement(agreement, postgresDB, agreements);

    const authData = getRandomAuthData(agreement.producerId);
    await agreementService.rejectAgreement(
      agreement.id,
      "Rejected by producer due to test reasons",
      authData,
      uuidv4()
    );

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

    const actualAgreementRejected = decodeProtobufPayload({
      messageType: AgreementUpdatedV1,
      payload: agreementEvent.data,
    }).agreement;

    /* We must delete some properties because the rejection
    sets them to undefined thus and the protobuf
    serialization strips them from the payload */
    delete agreement.suspendedByConsumer;
    delete agreement.suspendedByProducer;
    delete agreement.suspendedByPlatform;
    const expectedAgreemenentRejected: Agreement = {
      ...agreement,
      state: agreementState.rejected,
      rejectionReason: "Rejected by producer due to test reasons",
      // Keeps only not revoked attributes that are matching in descriptor and tenant
      verifiedAttributes: [{ id: tenantVerifiedAttribute.id }],
      declaredAttributes: [{ id: tenantDeclaredAttribute.id }],
      certifiedAttributes: [{ id: tenantCertifiedAttribute.id }],
      stamps: {
        ...agreement.stamps,
        rejection: {
          who: authData.userId,
          when: new Date(),
        },
      },
    };
    expect(actualAgreementRejected).toMatchObject(
      toAgreementV1(expectedAgreemenentRejected)
    );
    vi.useRealTimers();
  });
});
