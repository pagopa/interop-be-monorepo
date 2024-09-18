module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow use of Express response object",
      category: "Best Practices",
      recommended: true,
    },
    messages: {
      noExpressResponse:
        "Avoid using the Express response object directly use handleResponse instead",
    },
    schema: [], // no options
  },
  create(context) {
    const parserServices = context.parserServices;

    // This function checks if a variable is of type 'Response' from 'express'
    function isExpressResponseType(node) {
      if (
        !parserServices ||
        !parserServices.program ||
        !parserServices.esTreeNodeToTSNodeMap
      ) {
        return false;
      }

      const typeChecker = parserServices.program.getTypeChecker();
      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
      const type = typeChecker.getTypeAtLocation(tsNode);

      if (!type) {
        return false;
      }

      const typeString = typeChecker.typeToString(type);
      const properties = typeChecker.getPropertiesOfType(type);

      const propNames = properties && properties.map((p) => p.escapedName);
      const hasResMethods =
        propNames &&
        (propNames.includes("send") ||
          propNames.includes("json") ||
          propNames.includes("status") ||
          propNames.includes("write") ||
          propNames.includes("end"));

      return typeString.includes("Response") && hasResMethods;
    }

    return {
      Identifier(node) {
        // We want to detect if this identifier is an Express Response object
        if (isExpressResponseType(node)) {
          const parent = node.parent;

          // Check if the object is part of an Express response usage, like `response.send()`
          if (parent.type === "MemberExpression" && parent.object === node) {
            context.report({
              node,
              messageId: "noExpressResponse",
            });
          }
        }
      },
    };
  },
};
