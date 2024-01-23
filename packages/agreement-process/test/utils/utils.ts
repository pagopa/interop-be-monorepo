import { descriptorState } from "pagopa-interop-models";

export function expectPastTimestamp(timestamp: bigint): boolean {
  return (
    new Date(Number(timestamp)) && new Date(Number(timestamp)) <= new Date()
  );
}

export function randomArrayItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export const notDraftDescriptorStates = Object.values(descriptorState).filter(
  (state) => state !== descriptorState.draft
);

export const notPublishedDescriptorStates = Object.values(
  descriptorState
).filter((state) => state !== descriptorState.published);
