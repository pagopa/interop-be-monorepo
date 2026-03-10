import * as notifierApi from "./generated/notifierApi.js";

export type NotifierEventsClient = ReturnType<
  typeof notifierApi.createEventsApiClient
>;

export * from "./generated/notifierApi.js";
