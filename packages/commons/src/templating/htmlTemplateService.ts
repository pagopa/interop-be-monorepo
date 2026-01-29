import Handlebars from "handlebars";
import { htmlTemplateInterpolationError } from "pagopa-interop-models";

export type HtmlTemplateService = {
  compileHtml: (html: string, context: Record<string, unknown>) => string;
  registerPartial: (name: string, partial: string) => void;
};

export function buildHTMLTemplateService(): HtmlTemplateService {
  Handlebars.registerHelper(
    "preservePlaceholderIfMissing",
    function (variableName, options) {
      const value = options.lookupProperty(options.data.root, variableName);

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
      return `{{ ${variableName} }}`;
    }
  );

  Handlebars.registerHelper("encodeURIComponent", function (value) {
    if (value === undefined || value === null) {
      return "";
    }
    return encodeURIComponent(String(value));
  });

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
