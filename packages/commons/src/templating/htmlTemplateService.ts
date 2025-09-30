import Handlebars from "handlebars";
import { htmlTemplateInterpolationError } from "pagopa-interop-models";

export type HtmlTemplateService = {
  compileHtml: (html: string, context: Record<string, unknown>) => string;
  registerPartial: (name: string, partial: string) => void;
};

export function buildHTMLTemplateService(): HtmlTemplateService {
  return {
    registerPartial: async (name: string, partial: string): Promise<void> => {
      Handlebars.registerPartial(name, partial);
    },
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
