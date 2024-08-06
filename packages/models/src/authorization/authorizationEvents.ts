import { match } from "ts-pattern";
import { z } from "zod";
import { EventEnvelope } from "../events/events.js";
import { protobufDecoder } from "../protobuf/protobuf.js";
import {
  ClientAddedV1,
  ClientDeletedV1,
  ClientPurposeAddedV1,
  ClientPurposeRemovedV1,
  KeyDeletedV1,
  KeyRelationshipToUserMigratedV1,
  KeysAddedV1,
  RelationshipAddedV1,
  RelationshipRemovedV1,
  UserAddedV1,
  UserRemovedV1,
} from "../gen/v1/authorization/events.js";
import {
  ClientAddedV2,
  ClientDeletedV2,
  ClientKeyAddedV2,
  ClientKeyDeletedV2,
  ClientPurposeAddedV2,
  ClientPurposeRemovedV2,
  ClientUserAddedV2,
  ClientUserDeletedV2,
  ProducerKeychainAddedV2,
  ProducerKeychainDeletedV2,
  ProducerKeychainEServiceAddedV2,
  ProducerKeychainEServiceRemovedV2,
  ProducerKeychainKeyAddedV2,
  ProducerKeychainKeyDeletedV2,
  ProducerKeychainUserAddedV2,
  ProducerKeychainUserDeletedV2,
} from "../gen/v2/authorization/events.js";

export function authorizationEventToBinaryData(
  event: AuthorizationEvent
): Uint8Array {
  return match(event)
    .with({ event_version: 1 }, authorizationEventToBinaryDataV1)
    .with({ event_version: 2 }, authorizationEventToBinaryDataV2)
    .exhaustive();
}

export function authorizationEventToBinaryDataV1(
  event: AuthorizationEventV1
): Uint8Array {
  return match(event)
    .with({ type: "KeysAdded" }, ({ data }) => KeysAddedV1.toBinary(data))
    .with({ type: "KeyDeleted" }, ({ data }) => KeyDeletedV1.toBinary(data))
    .with({ type: "KeyRelationshipToUserMigrated" }, ({ data }) =>
      KeyRelationshipToUserMigratedV1.toBinary(data)
    )
    .with({ type: "ClientAdded" }, ({ data }) => ClientAddedV1.toBinary(data))
    .with({ type: "ClientDeleted" }, ({ data }) =>
      ClientDeletedV1.toBinary(data)
    )
    .with({ type: "RelationshipAdded" }, ({ data }) =>
      RelationshipAddedV1.toBinary(data)
    )
    .with({ type: "RelationshipRemoved" }, ({ data }) =>
      RelationshipRemovedV1.toBinary(data)
    )
    .with({ type: "UserAdded" }, ({ data }) => UserAddedV1.toBinary(data))
    .with({ type: "UserRemoved" }, ({ data }) => UserRemovedV1.toBinary(data))
    .with({ type: "ClientPurposeAdded" }, ({ data }) =>
      ClientPurposeAddedV1.toBinary(data)
    )
    .with({ type: "ClientPurposeRemoved" }, ({ data }) =>
      ClientPurposeRemovedV1.toBinary(data)
    )
    .exhaustive();
}

export function authorizationEventToBinaryDataV2(
  event: AuthorizationEventV2
): Uint8Array {
  return match(event)
    .with({ type: "ClientAdded" }, ({ data }) => ClientAddedV2.toBinary(data))
    .with({ type: "ClientDeleted" }, ({ data }) =>
      ClientDeletedV2.toBinary(data)
    )
    .with({ type: "ClientKeyAdded" }, ({ data }) =>
      ClientKeyAddedV2.toBinary(data)
    )
    .with({ type: "ClientKeyDeleted" }, ({ data }) =>
      ClientKeyDeletedV2.toBinary(data)
    )
    .with({ type: "ClientUserAdded" }, ({ data }) =>
      ClientUserAddedV2.toBinary(data)
    )
    .with({ type: "ClientUserDeleted" }, ({ data }) =>
      ClientUserDeletedV2.toBinary(data)
    )
    .with({ type: "ClientPurposeAdded" }, ({ data }) =>
      ClientPurposeAddedV2.toBinary(data)
    )
    .with({ type: "ClientPurposeRemoved" }, ({ data }) =>
      ClientPurposeRemovedV2.toBinary(data)
    )
    .with({ type: "ProducerKeychainAdded" }, ({ data }) =>
      ProducerKeychainAddedV2.toBinary(data)
    )
    .with({ type: "ProducerKeychainDeleted" }, ({ data }) =>
      ProducerKeychainDeletedV2.toBinary(data)
    )
    .with({ type: "ProducerKeychainKeyAdded" }, ({ data }) =>
      ProducerKeychainKeyAddedV2.toBinary(data)
    )
    .with({ type: "ProducerKeychainKeyDeleted" }, ({ data }) =>
      ProducerKeychainKeyDeletedV2.toBinary(data)
    )
    .with({ type: "ProducerKeychainUserAdded" }, ({ data }) =>
      ProducerKeychainUserAddedV2.toBinary(data)
    )
    .with({ type: "ProducerKeychainUserDeleted" }, ({ data }) =>
      ProducerKeychainUserDeletedV2.toBinary(data)
    )
    .with({ type: "ProducerKeychainEServiceAdded" }, ({ data }) =>
      ProducerKeychainEServiceAddedV2.toBinary(data)
    )
    .with({ type: "ProducerKeychainEServiceRemoved" }, ({ data }) =>
      ProducerKeychainEServiceRemovedV2.toBinary(data)
    )
    .exhaustive();
}

export const AuthorizationEventV1 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(1),
    type: z.literal("KeysAdded"),
    data: protobufDecoder(KeysAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("KeyDeleted"),
    data: protobufDecoder(KeyDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("KeyRelationshipToUserMigrated"),
    data: protobufDecoder(KeyRelationshipToUserMigratedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("ClientAdded"),
    data: protobufDecoder(ClientAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("ClientDeleted"),
    data: protobufDecoder(ClientDeletedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("RelationshipAdded"),
    data: protobufDecoder(RelationshipAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("RelationshipRemoved"),
    data: protobufDecoder(RelationshipRemovedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("UserAdded"),
    data: protobufDecoder(UserAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("UserRemoved"),
    data: protobufDecoder(UserRemovedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("ClientPurposeAdded"),
    data: protobufDecoder(ClientPurposeAddedV1),
  }),
  z.object({
    event_version: z.literal(1),
    type: z.literal("ClientPurposeRemoved"),
    data: protobufDecoder(ClientPurposeRemovedV1),
  }),
]);
export type AuthorizationEventV1 = z.infer<typeof AuthorizationEventV1>;

export const AuthorizationEventV2 = z.discriminatedUnion("type", [
  z.object({
    event_version: z.literal(2),
    type: z.literal("ClientAdded"),
    data: protobufDecoder(ClientAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ClientDeleted"),
    data: protobufDecoder(ClientDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ClientKeyAdded"),
    data: protobufDecoder(ClientKeyAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ClientKeyDeleted"),
    data: protobufDecoder(ClientKeyDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ClientUserAdded"),
    data: protobufDecoder(ClientUserAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ClientUserDeleted"),
    data: protobufDecoder(ClientUserDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ClientPurposeAdded"),
    data: protobufDecoder(ClientPurposeAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ClientPurposeRemoved"),
    data: protobufDecoder(ClientPurposeRemovedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ProducerKeychainAdded"),
    data: protobufDecoder(ProducerKeychainAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ProducerKeychainDeleted"),
    data: protobufDecoder(ProducerKeychainDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ProducerKeychainKeyAdded"),
    data: protobufDecoder(ProducerKeychainKeyAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ProducerKeychainKeyDeleted"),
    data: protobufDecoder(ProducerKeychainKeyDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ProducerKeychainUserAdded"),
    data: protobufDecoder(ProducerKeychainUserAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ProducerKeychainUserDeleted"),
    data: protobufDecoder(ProducerKeychainUserDeletedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ProducerKeychainEServiceAdded"),
    data: protobufDecoder(ProducerKeychainEServiceAddedV2),
  }),
  z.object({
    event_version: z.literal(2),
    type: z.literal("ProducerKeychainEServiceRemoved"),
    data: protobufDecoder(ProducerKeychainEServiceRemovedV2),
  }),
]);
export type AuthorizationEventV2 = z.infer<typeof AuthorizationEventV2>;

const eventV1 = z
  .object({
    event_version: z.literal(1),
  })
  .passthrough();

const eventV2 = z
  .object({
    event_version: z.literal(2),
  })
  .passthrough();

export const AuthorizationEvent = z
  .discriminatedUnion("event_version", [eventV1, eventV2])
  .transform((obj, ctx) => {
    const res = match(obj)
      .with({ event_version: 1 }, () => AuthorizationEventV1.safeParse(obj))
      .with({ event_version: 2 }, () => AuthorizationEventV2.safeParse(obj))
      .exhaustive();

    if (!res.success) {
      res.error.issues.forEach(ctx.addIssue);
      return z.NEVER;
    }
    return res.data;
  });
export type AuthorizationEvent = z.infer<typeof AuthorizationEvent>;

export const AuthorizationEventEnvelopeV1 = EventEnvelope(AuthorizationEventV1);
export type AuthorizationEventEnvelopeV1 = z.infer<
  typeof AuthorizationEventEnvelopeV1
>;

export const AuthorizationEventEnvelopeV2 = EventEnvelope(AuthorizationEventV2);
export type AuthorizationEventEnvelopeV2 = z.infer<
  typeof AuthorizationEventEnvelopeV2
>;

export const AuthorizationEventEnvelope = EventEnvelope(AuthorizationEvent);
export type AuthorizationEventEnvelope = z.infer<
  typeof AuthorizationEventEnvelope
>;
