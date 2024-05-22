import { ClientV1, KeyV1 } from "pagopa-interop-models";

export type KeyV1Notification = Omit<KeyV1, "use"> & {
  use: string;
};

export type ClientV1Notification = Omit<ClientV1, "createdAt" | "kind"> & {
  createdAt: string;
  kind: string;
};

export type KeysAddedNotification = {
  clientId: string;
  keys: KeyV1Notification[];
};

export type KeyDeletedNotification = {
  clientId: string;
  keyId: string;
  deactivationTimestamp: string;
};

export type AuthorizationEventNotification =
  | KeysAddedNotification
  | KeyDeletedNotification;
