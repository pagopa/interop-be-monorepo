const requireTypeForObject = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      missingTypeAnnotation:
        "Object literal initializers must have a type annotation.",
    },
  },
  create: (context) => ({
    VariableDeclarator(node) {
      if (
        node.id.type === "Identifier" &&
        node.id.typeAnnotation == null &&
        node.init?.type === "ObjectExpression"
      ) {
        context.report({
          node: node.id,
          messageId: "missingTypeAnnotation",
        });
      }
    },
  }),
};

export default requireTypeForObject;
