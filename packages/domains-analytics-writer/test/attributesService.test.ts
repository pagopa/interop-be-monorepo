/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, beforeEach } from "vitest";
import { getMockAttribute } from "pagopa-interop-commons-test";
import {
  Attribute,
  AttributeAddedV1,
  AttributeEventEnvelope,
  attributeKind,
  toAttributeV1,
  generateId,
} from "pagopa-interop-models";
import { handleAttributeMessageV1 } from "../src/handlers/attribute/consumerServiceV1.js";
import { AttributeDbTable } from "../src/model/db/index.js";
import {
  attributeTables,
  dbContext,
  getManyFromDb,
  getOneFromDb,
  resetTargetTables,
} from "./utils.js";

describe("SQL Attribute Service - Events V1", () => {
  beforeEach(async () => {
    await resetTargetTables(attributeTables);
  });

  it("AttributeAdded - certified", async () => {
    const certifiedAttribute: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.certified,
      code: "123456",
      origin: "certifier-id",
    };
    const payload: AttributeAddedV1 = {
      attribute: toAttributeV1(certifiedAttribute),
    };
    const message: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: certifiedAttribute.id,
      version: 5,
      type: "AttributeAdded",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    await handleAttributeMessageV1([message], dbContext);

    const stored = await getManyFromDb(dbContext, AttributeDbTable.attribute, {
      id: certifiedAttribute.id,
    });
    expect(stored.length).toBe(1);
    expect(stored[0]?.id).toBe(payload.attribute?.id);
    expect(stored[0]?.kind).toBe(attributeKind.certified);
    expect(stored[0]?.metadataVersion).toBe(5);
  });

  it("AttributeAdded - declared", async () => {
    const declaredAttribute: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.declared,
    };
    const payload: AttributeAddedV1 = {
      attribute: toAttributeV1(declaredAttribute),
    };
    const message: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: declaredAttribute.id,
      version: 2,
      type: "AttributeAdded",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    await handleAttributeMessageV1([message], dbContext);

    const stored = await getManyFromDb(dbContext, AttributeDbTable.attribute, {
      id: declaredAttribute.id,
    });
    expect(stored.length).toBe(1);
    expect(stored[0]?.id).toBe(payload.attribute?.id);
    expect(stored[0]?.kind).toBe(attributeKind.declared);
    expect(stored[0]?.metadataVersion).toBe(2);
  });

  it("AttributeAdded - verified", async () => {
    const verifiedAttribute: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.verified,
    };
    const payload: AttributeAddedV1 = {
      attribute: toAttributeV1(verifiedAttribute),
    };
    const message: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: verifiedAttribute.id,
      version: 3,
      type: "AttributeAdded",
      event_version: 1,
      data: payload,
      log_date: new Date(),
    };

    await handleAttributeMessageV1([message], dbContext);

    const stored = await getManyFromDb(dbContext, AttributeDbTable.attribute, {
      id: verifiedAttribute.id,
    });
    expect(stored.length).toBe(1);
    expect(stored[0]?.kind).toBe(attributeKind.verified);
    expect(stored[0]?.metadataVersion).toBe(3);
  });

  it("AttributeAdded - deduplicates batch by attribute ID, keeps only record with highest metadataVersion", async () => {
    const attr: Attribute = {
      ...getMockAttribute(),
      kind: attributeKind.verified,
    };
    const older: AttributeEventEnvelope = {
      sequence_num: 1,
      stream_id: attr.id,
      version: 10,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: toAttributeV1(attr) },
      log_date: new Date(),
    };
    const newer: AttributeEventEnvelope = {
      sequence_num: 2,
      stream_id: attr.id,
      version: 1,
      type: "AttributeAdded",
      event_version: 1,
      data: { attribute: toAttributeV1(attr) },
      log_date: new Date(),
    };

    await handleAttributeMessageV1([older, newer], dbContext);

    const stored = await getManyFromDb(dbContext, AttributeDbTable.attribute, {
      id: attr.id,
    });
    expect(stored.length).toBe(1);
    expect(stored[0]?.metadataVersion).toBe(10);
  });

  it("AttributeAdded - batch with different attribute IDs inserts all records", async () => {
    const attr1: Attribute = {
      ...getMockAttribute(),
      id: generateId(),
      kind: attributeKind.certified,
    };
    const attr2: Attribute = {
      ...getMockAttribute(),
      id: generateId(),
      kind: attributeKind.declared,
    };
    const attr3: Attribute = {
      ...getMockAttribute(),
      id: generateId(),
      kind: attributeKind.verified,
    };
    const messages: AttributeEventEnvelope[] = [
      {
        sequence_num: 1,
        stream_id: attr1.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: toAttributeV1(attr1) },
        log_date: new Date(),
      },
      {
        sequence_num: 2,
        stream_id: attr2.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: toAttributeV1(attr2) },
        log_date: new Date(),
      },
      {
        sequence_num: 3,
        stream_id: attr3.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: toAttributeV1(attr3) },
        log_date: new Date(),
      },
    ];

    await handleAttributeMessageV1(messages, dbContext);

    const stored1 = await getManyFromDb(dbContext, AttributeDbTable.attribute, {
      id: attr1.id,
    });
    const stored2 = await getManyFromDb(dbContext, AttributeDbTable.attribute, {
      id: attr2.id,
    });
    const stored3 = await getManyFromDb(dbContext, AttributeDbTable.attribute, {
      id: attr3.id,
    });
    const allStored = [stored1, stored2, stored3].flat();
    expect(allStored.length).toBe(3);
    expect(stored1[0]?.id).toBe(attr1.id);
    expect(stored2[0]?.id).toBe(attr2.id);
    expect(stored3[0]?.id).toBe(attr3.id);
  });

  describe("Merge and check on metadataVersion", () => {
    it("should skip insert/update when incoming metadataVersion is lower or equal", async () => {
      const attr: Attribute = {
        ...getMockAttribute(),
        kind: attributeKind.declared,
        code: "AAA",
      };
      const first: AttributeEventEnvelope = {
        sequence_num: 1,
        stream_id: attr.id,
        version: 5,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: toAttributeV1(attr) },
        log_date: new Date(),
      };
      await handleAttributeMessageV1([first], dbContext);

      let stored = await getOneFromDb(dbContext, AttributeDbTable.attribute, {
        id: attr.id,
      });
      expect(stored?.metadataVersion).toBe(5);

      const equal: AttributeEventEnvelope = {
        sequence_num: 2,
        stream_id: attr.id,
        version: 5,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: toAttributeV1(attr) },
        log_date: new Date(),
      };
      await handleAttributeMessageV1([equal], dbContext);

      stored = await getOneFromDb(dbContext, AttributeDbTable.attribute, {
        id: attr.id,
      });
      expect(stored?.metadataVersion).toBe(5);

      const lower: AttributeEventEnvelope = {
        sequence_num: 3,
        stream_id: attr.id,
        version: 4,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: toAttributeV1(attr) },
        log_date: new Date(),
      };
      await handleAttributeMessageV1([lower], dbContext);

      stored = await getOneFromDb(dbContext, AttributeDbTable.attribute, {
        id: attr.id,
      });
      expect(stored?.metadataVersion).toBe(5);
    });

    it("should overwrite when incoming metadataVersion is greater", async () => {
      const attr: Attribute = {
        ...getMockAttribute(),
        kind: attributeKind.verified,
        code: "code",
      };
      const initial: AttributeEventEnvelope = {
        sequence_num: 1,
        stream_id: attr.id,
        version: 1,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: toAttributeV1(attr) },
        log_date: new Date(),
      };

      const higherAttr: Attribute = { ...attr, code: "updated code" };
      const higher: AttributeEventEnvelope = {
        sequence_num: 2,
        stream_id: attr.id,
        version: 10,
        type: "AttributeAdded",
        event_version: 1,
        data: { attribute: toAttributeV1(higherAttr) },
        log_date: new Date(),
      };
      await handleAttributeMessageV1([higher, initial], dbContext);

      const stored = await getOneFromDb(dbContext, AttributeDbTable.attribute, {
        id: attr.id,
      });
      expect(stored?.metadataVersion).toBe(10);
      expect(stored?.code).toBe("updated code");
    });
  });
});
