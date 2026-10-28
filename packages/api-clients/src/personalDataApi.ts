import * as personalDataApi from "./generated/personalDataApi.js";

export type PersonalDataManagerClient = ReturnType<
  typeof personalDataApi.createContactApiClient
>;

export * from "./generated/personalDataApi.js";
