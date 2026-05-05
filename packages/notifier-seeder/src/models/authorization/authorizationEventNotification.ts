import { KeyV1 } from "pagopa-interop-models";

export type KeyV1Notification = Omit<KeyV1, "use"> & {
  use: string;
};

type KeyPayloadNotification = Record<string, KeyV1Notification>;

export type KeysAddedNotification = {
  clientId: string;
  keys: KeyPayloadNotification;
};

export type KeyDeletedNotification = {
  clientId: string;
  keyId: string;
  deactivationTimestamp: string;
};

export type AuthorizationEventNotification =
  | KeysAddedNotification
  | KeyDeletedNotification;
