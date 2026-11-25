import * as contactDataApi from "./generated/contactDataApi.js";

export type ContactDataManagerClient = ReturnType<
  typeof contactDataApi.createContactApiClient
>;

export * from "./generated/contactDataApi.js";
