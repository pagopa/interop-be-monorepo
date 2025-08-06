// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function purposeTemplateWriterServiceBuilder() {
  return {
    async sample(): Promise<void> {
      await Promise.resolve();
    },
  };
}
export type PurposeTemplateWriterService = ReturnType<
  typeof purposeTemplateWriterServiceBuilder
>;
