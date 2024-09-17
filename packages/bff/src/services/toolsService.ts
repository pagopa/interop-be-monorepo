/* eslint-disable @typescript-eslint/explicit-function-return-type */

export function toolsServiceBuilder() {
  return {};
}

export type ToolsService = ReturnType<typeof toolsServiceBuilder>;
