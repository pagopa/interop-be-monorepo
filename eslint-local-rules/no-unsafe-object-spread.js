/**
 * ESLint rule that requires explicit type annotations on destination objects
 * when using the spread operator.
 *
 * This rule forces developers to explicitly type the object that contains
 * a spread operation, preventing silent type bugs and ensuring type safety.
 *
 * It is not possible to check the scope directly, because TS `getEnclosingDeclaration`
 * not available through `context.parserServices` in @typescript-eslint, so the logic
 * is based on the while-break loop checking the ancestors.
 *
 * A spread is allowed if:
 * - The destination object has an explicit type annotation (as or satisfies)
 * - The destination is typed through variable/parameter declaration
 * - The destination is a function return with explicit return type
 *
 * A spread is ignored if if it used in non-objects spreads, e.g., arrays.
 */

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require explicit type annotation on objects containing spread operators.",
      requiresTypeChecking: true,
    },
    schema: [],
    messages: {
      untypedDestination:
        "Object with spread operator must have explicit type annotation. Use 'as Type' or 'satisfies Type', or type the containing variable/parameter.",
    },
  },

  create(context) {
    // checks that TypeScript parser services are available
    const services = context.parserServices;
    if (!services || !services.program || !services.esTreeNodeToTSNodeMap) {
      throw new Error(
        "no-unsafe-object-spread requires type information. " +
          "Ensure you are using @typescript-eslint/parser and have configured parserOptions.project."
      );
    }

    const checker = services.program.getTypeChecker();
    const typeCache = new WeakMap();

    // optimisation attempt to reduce repeated calls to getTypeAtLocation
    function getCachedType(tsNode) {
      if (typeCache.has(tsNode)) {
        return typeCache.get(tsNode);
      }
      const type = checker.getTypeAtLocation(tsNode);
      typeCache.set(tsNode, type);
      return type;
    }

    function isFunctionNode(node) {
      return (
        node?.type === "FunctionDeclaration" ||
        node?.type === "FunctionExpression" ||
        node?.type === "ArrowFunctionExpression"
      );
    }

    function isSpreadSourceSafelyTyped(argNode) {
      try {
        const tsNode = services.esTreeNodeToTSNodeMap.get(argNode);
        const type = getCachedType(tsNode);

        // parameter or variable was explicitly typed
        const annotation = tsNode.type || tsNode.parent?.type;
        if (annotation) return true;

        // 'any', 'unknown', implicit object literal, empty object, etc are unsafe,
        // inferred object literals with no declared shape are unsafe
        if (
          type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown) ||
          checker.typeToString(type) === "{}"
        )
          return false;

        return true;
      } catch {
        return false;
      }
    }

    function isExplicitlyTyped(obj) {
      let node = obj;

      while (node?.parent) {
        const parent = node.parent;

        // type assertion: `{ ...spread } as Type` or `satisfies Type`
        // or variable declaration: `const x: Type = { ...spread }`
        if (
          parent.type === "TSAsExpression" ||
          parent.type === "TSSatisfiesExpression" ||
          (parent.type === "VariableDeclarator" && parent.id?.typeAnnotation)
        ) {
          return true;
        }

        // function parameter with type: `function f(param: Type = { ...spread })`
        if (
          parent.type === "AssignmentPattern" &&
          isFunctionNode(parent.parent)
        ) {
          const hasTypedParam = parent.parent.params.some(
            (param) => param === parent && param.left?.typeAnnotation
          );
          if (hasTypedParam) return true;
        }

        // checks the enclosing typed function of a return statement
        if (parent.type === "ReturnStatement") {
          let funcNode = parent.parent;
          while (funcNode) {
            if (isFunctionNode(funcNode)) {
              return !!funcNode.returnType;
            }
            funcNode = funcNode.parent;
          }
          return false;
        }

        // we hit a function boundary without being in a return,
        // i.e. `const f = () => ({ ...foo })` is not accepted
        if (
          isFunctionNode(parent) &&
          parent.body === node &&
          parent.returnType
        ) {
          return true;
        }

        // property in a typed object: `const obj: Type = { prop: { ...spread } }`
        // array element in typed array: `const arr: Type[] = [{ ...spread }]`
        if (
          (parent.type === "Property" && parent.value === node) ||
          parent.type === "ArrayExpression"
        ) {
          node = parent.type === "Property" ? parent.parent : parent;
          continue;
        }

        node = parent;
      }

      return false;
    }

    return {
      SpreadElement(node) {
        // only check spreads for object expressions (no arrays)
        const obj = node.parent;
        if (obj.type !== "ObjectExpression") return;
        if (isExplicitlyTyped(obj) || isSpreadSourceSafelyTyped(node)) return;

        context.report({
          node: obj,
          messageId: "untypedDestination",
        });
      },
    };
  },
};
