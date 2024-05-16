import Handlebars from "handlebars";
import { templateInterpolationError } from "pagopa-interop-models";

export type TemplateService = {
  compileHtml: (html: string, context: Record<string, unknown>) => string;
};

export function buildTemplateService(): TemplateService {
  return {
    compileHtml: (
      htmlTemplate: string,
      context: Record<string, unknown>
    ): string => {
      try {
        const compileHtml = Handlebars.compile(htmlTemplate);

        return compileHtml(context);
      } catch (error) {
        throw templateInterpolationError(error);
      }
    },
  };
}
