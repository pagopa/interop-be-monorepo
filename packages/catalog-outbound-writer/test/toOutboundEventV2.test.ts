import {
  decodeOutboundEServiceEvent,
  encodeOutboundEServiceEvent,
  EServiceTemplateVersionRefV2 as OutboundEServiceTemplateVersionRefV2,
} from "@pagopa/interop-outbound-models";
import {
  getMockDescriptor,
  getMockEService,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceEventEnvelopeV2,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  EServiceTemplateVersionRef,
  generateId,
  toEServiceV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { toOutboundEventV2 } from "../src/converters/toOutboundEventV2.js";

const contactName = "Template contact name";
const contactEmail = "template.contact@example.com";
const contactUrl = "https://contact.example.com";
const termsAndConditionsUrl = "https://terms.example.com";

const buildTemplateInstance = (
  templateVersionRef: EServiceTemplateVersionRef
): { eservice: EService; descriptor: Descriptor } => {
  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
    templateVersionRef,
  };
  const eservice = getMockEService(
    undefined,
    undefined,
    [descriptor],
    generateId<EServiceTemplateId>()
  );
  return { eservice, descriptor };
};

const buildDescriptorPublishedMessage = (
  eservice: EService,
  descriptor: Descriptor
): EServiceEventEnvelopeV2 => ({
  sequence_num: 1,
  stream_id: eservice.id,
  version: 1,
  event_version: 2,
  type: "EServiceDescriptorPublished",
  data: {
    eservice: toEServiceV2(eservice),
    descriptorId: descriptor.id,
  },
  log_date: new Date(),
});

const encodeToOutbound = (message: EServiceEventEnvelopeV2): string => {
  const outboundEvent = toOutboundEventV2(message);
  if (!outboundEvent) {
    throw new Error(`${message.type} is not published to the outbound topic`);
  }
  return encodeOutboundEServiceEvent(outboundEvent);
};

const getEmittedPayload = (encodedEvent: string): Buffer =>
  Buffer.from(
    z.object({ data: z.string() }).parse(JSON.parse(encodedEvent)).data,
    "hex"
  );

const getDecodedTemplateVersionRef = (
  encodedEvent: string
): OutboundEServiceTemplateVersionRefV2 | undefined =>
  match(decodeOutboundEServiceEvent(encodedEvent))
    .with(
      { type: "EServiceDescriptorPublished" },
      (event) => event.data.eservice?.descriptors.at(0)?.templateVersionRef
    )
    .otherwise((event) => {
      throw new Error(`Unexpected outbound event ${event.type}`);
    });

describe("toOutboundEventV2 - template interface metadata", () => {
  it("should not emit template interface contacts, keeping the remaining metadata and domain data", () => {
    const templateVersionRef: EServiceTemplateVersionRef = {
      id: generateId<EServiceTemplateVersionId>(),
      interfaceMetadata: {
        contactName,
        contactEmail,
        contactUrl,
        termsAndConditionsUrl,
      },
    };
    const { eservice, descriptor } = buildTemplateInstance(templateVersionRef);

    const encodedEvent = encodeToOutbound(
      buildDescriptorPublishedMessage(eservice, descriptor)
    );

    const payload = getEmittedPayload(encodedEvent);
    expect(payload.includes(contactName)).toBe(false);
    expect(payload.includes(contactEmail)).toBe(false);
    expect(payload.includes(contactUrl)).toBe(true);
    expect(payload.includes(termsAndConditionsUrl)).toBe(true);

    expect(getDecodedTemplateVersionRef(encodedEvent)).toEqual({
      id: templateVersionRef.id,
      interfaceMetadata: { contactUrl, termsAndConditionsUrl },
    });
    expect(decodeOutboundEServiceEvent(encodedEvent)).toMatchObject({
      type: "EServiceDescriptorPublished",
      stream_id: eservice.id,
      data: {
        descriptorId: descriptor.id,
        eservice: {
          id: eservice.id,
          name: eservice.name,
          producerId: eservice.producerId,
          templateId: eservice.templateId,
          descriptors: [
            {
              id: descriptor.id,
              audience: descriptor.audience,
              serverUrls: descriptor.serverUrls,
              voucherLifespan: descriptor.voucherLifespan,
            },
          ],
        },
      },
    });
  });

  it("should emit empty interface metadata when only the contacts are set", () => {
    const templateVersionRef: EServiceTemplateVersionRef = {
      id: generateId<EServiceTemplateVersionId>(),
      interfaceMetadata: { contactName, contactEmail },
    };
    const { eservice, descriptor } = buildTemplateInstance(templateVersionRef);

    const encodedEvent = encodeToOutbound(
      buildDescriptorPublishedMessage(eservice, descriptor)
    );

    const payload = getEmittedPayload(encodedEvent);
    expect(payload.includes(contactName)).toBe(false);
    expect(payload.includes(contactEmail)).toBe(false);
    expect(getDecodedTemplateVersionRef(encodedEvent)).toEqual({
      id: templateVersionRef.id,
      interfaceMetadata: {},
    });
  });

  it("should keep the template version ref when the interface metadata is absent", () => {
    const templateVersionRef: EServiceTemplateVersionRef = {
      id: generateId<EServiceTemplateVersionId>(),
    };
    const { eservice, descriptor } = buildTemplateInstance(templateVersionRef);

    const encodedEvent = encodeToOutbound(
      buildDescriptorPublishedMessage(eservice, descriptor)
    );

    expect(getDecodedTemplateVersionRef(encodedEvent)).toEqual({
      id: templateVersionRef.id,
    });
  });
});
