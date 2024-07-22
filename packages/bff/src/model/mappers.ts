import { catalogApi } from "pagopa-interop-api-clients";
import { descriptorApiState } from "./api/catalogTypes.js";

/* 
  This file contains commons utility functions 
  used to pick or transform data from model to another.
*/

const ACTIVE_DESCRIPTOR_STATES_FILTER = [
  descriptorApiState.PUBLISHED,
  descriptorApiState.SUSPENDED,
  descriptorApiState.DEPRECATED,
];


export function getLatestAcriveDescriptor(
  eservice: catalogApi.EService
): catalogApi.EServiceDescriptor | undefined {
  return eservice.descriptors
    .filter((d) => ACTIVE_DESCRIPTOR_STATES_FILTER.includes(d.state))
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
}