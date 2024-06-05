import Handlebars from "handlebars";
import { htmlTemplateInterpolationError } from "pagopa-interop-models";

export type HtmlTemplateService = {
  compileHtml: (html: string, context: Record<string, unknown>) => string;
};

export function buildHTMLTemplateService(): HtmlTemplateService {
  return {
    compileHtml: (
      htmlTemplate: string,
      context: Record<string, unknown>
    ): string => {
      try {
        const compileHtml = Handlebars.compile(htmlTemplate);

        return compileHtml(context);
      } catch (error) {
        throw htmlTemplateInterpolationError(error);
      }
    },
  };
}
