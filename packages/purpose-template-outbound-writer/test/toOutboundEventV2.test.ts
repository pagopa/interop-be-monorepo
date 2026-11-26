import {
  decodeOutboundPurposeTemplateEvent,
  encodeOutboundPurposeTemplateEvent,
  EServiceTemplateVersionRefV2 as OutboundEServiceTemplateVersionRefV2,
} from "@pagopa/interop-outbound-models";
import {
  getMockDescriptor,
  getMockEService,
  getMockPurposeTemplate,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  descriptorState,
  EService,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  EServiceTemplateVersionRef,
  generateId,
  PurposeTemplate,
  PurposeTemplateEventEnvelopeV2,
  toEServiceV2,
  toPurposeTemplateV2,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { toOutboundEventV2 } from "../src/converters/toOutboundEventV2.js";

type EServiceLinkEventType =
  | "PurposeTemplateEServiceLinked"
  | "PurposeTemplateEServiceUnlinked";

const eserviceLinkEventTypes: EServiceLinkEventType[] = [
  "PurposeTemplateEServiceLinked",
  "PurposeTemplateEServiceUnlinked",
];

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

const buildEServiceLinkMessage = (
  type: EServiceLinkEventType,
  purposeTemplate: PurposeTemplate,
  eservice: EService,
  descriptor: Descriptor
): PurposeTemplateEventEnvelopeV2 =>
  match(type)
    .returnType<PurposeTemplateEventEnvelopeV2>()
    .with("PurposeTemplateEServiceLinked", (linkedType) => ({
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: 1,
      event_version: 2,
      type: linkedType,
      data: {
        purposeTemplate: toPurposeTemplateV2(purposeTemplate),
        eservice: toEServiceV2(eservice),
        descriptorId: descriptor.id,
        createdAt: BigInt(Date.now()),
      },
      log_date: new Date(),
    }))
    .with("PurposeTemplateEServiceUnlinked", (unlinkedType) => ({
      sequence_num: 1,
      stream_id: purposeTemplate.id,
      version: 1,
      event_version: 2,
      type: unlinkedType,
      data: {
        purposeTemplate: toPurposeTemplateV2(purposeTemplate),
        eservice: toEServiceV2(eservice),
        descriptorId: descriptor.id,
      },
      log_date: new Date(),
    }))
    .exhaustive();

const encodeToOutbound = (message: PurposeTemplateEventEnvelopeV2): string => {
  const outboundEvent = toOutboundEventV2(message);
  if (!outboundEvent) {
    throw new Error(`${message.type} is not published to the outbound topic`);
  }
  return encodeOutboundPurposeTemplateEvent(outboundEvent);
};

const getEmittedPayload = (encodedEvent: string): Buffer =>
  Buffer.from(
    z.object({ data: z.string() }).parse(JSON.parse(encodedEvent)).data,
    "hex"
  );

const getDecodedTemplateVersionRef = (
  encodedEvent: string
): OutboundEServiceTemplateVersionRefV2 | undefined =>
  match(decodeOutboundPurposeTemplateEvent(encodedEvent))
    .with(
      { type: "PurposeTemplateEServiceLinked" },
      { type: "PurposeTemplateEServiceUnlinked" },
      (event) => event.data.eservice?.descriptors.at(0)?.templateVersionRef
    )
    .otherwise((event) => {
      throw new Error(`Unexpected outbound event ${event.type}`);
    });

describe("toOutboundEventV2 - template interface metadata", () => {
  it.each(eserviceLinkEventTypes)(
    "%s: should not emit template interface contacts, keeping the remaining metadata and domain data",
    (type) => {
      const purposeTemplate = getMockPurposeTemplate();
      const templateVersionRef: EServiceTemplateVersionRef = {
        id: generateId<EServiceTemplateVersionId>(),
        interfaceMetadata: {
          contactName,
          contactEmail,
          contactUrl,
          termsAndConditionsUrl,
        },
      };
      const { eservice, descriptor } =
        buildTemplateInstance(templateVersionRef);

      const encodedEvent = encodeToOutbound(
        buildEServiceLinkMessage(type, purposeTemplate, eservice, descriptor)
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
      expect(decodeOutboundPurposeTemplateEvent(encodedEvent)).toMatchObject({
        type,
        stream_id: purposeTemplate.id,
        data: {
          purposeTemplate: { id: purposeTemplate.id },
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
    }
  );

  it.each(eserviceLinkEventTypes)(
    "%s: should emit empty interface metadata when only the contacts are set",
    (type) => {
      const templateVersionRef: EServiceTemplateVersionRef = {
        id: generateId<EServiceTemplateVersionId>(),
        interfaceMetadata: { contactName, contactEmail },
      };
      const { eservice, descriptor } =
        buildTemplateInstance(templateVersionRef);

      const encodedEvent = encodeToOutbound(
        buildEServiceLinkMessage(
          type,
          getMockPurposeTemplate(),
          eservice,
          descriptor
        )
      );

      const payload = getEmittedPayload(encodedEvent);
      expect(payload.includes(contactName)).toBe(false);
      expect(payload.includes(contactEmail)).toBe(false);
      expect(getDecodedTemplateVersionRef(encodedEvent)).toEqual({
        id: templateVersionRef.id,
        interfaceMetadata: {},
      });
    }
  );

  it.each(eserviceLinkEventTypes)(
    "%s: should keep the template version ref when the interface metadata is absent",
    (type) => {
      const templateVersionRef: EServiceTemplateVersionRef = {
        id: generateId<EServiceTemplateVersionId>(),
      };
      const { eservice, descriptor } =
        buildTemplateInstance(templateVersionRef);

      const encodedEvent = encodeToOutbound(
        buildEServiceLinkMessage(
          type,
          getMockPurposeTemplate(),
          eservice,
          descriptor
        )
      );

      expect(getDecodedTemplateVersionRef(encodedEvent)).toEqual({
        id: templateVersionRef.id,
      });
    }
  );
});
