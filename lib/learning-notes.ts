import type { TiptapNode } from "@/types/learning-path";

/**
 * Standard default empty Tiptap document.
 */
export const DEFAULT_EMPTY_NOTE_DOC: TiptapNode = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
};

export interface ValidateTiptapResult {
  isValid: boolean;
  error?: string;
  data?: TiptapNode;
}

/**
 * Validates that an input is a valid Tiptap JSON document structure,
 * checking root type, node structures, payload size, and maximum recursion depth.
 *
 * @param input The raw input to validate
 * @param maxDepth Maximum allowed AST nesting depth (default: 20)
 * @param maxSizeBytes Maximum serialized JSON size in bytes (default: 500,000)
 */
export function validateTiptapContent(
  input: unknown,
  maxDepth = 20,
  maxSizeBytes = 500_000
): ValidateTiptapResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      isValid: false,
      error: "Document content must be a JSON object.",
    };
  }

  // 1. Check serialized size
  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    return {
      isValid: false,
      error: "Document content contains circular references or cannot be serialized.",
    };
  }

  if (serialized.length > maxSizeBytes) {
    return {
      isValid: false,
      error: `Document content exceeds maximum allowed size of ${maxSizeBytes} bytes.`,
    };
  }

  const root = input as Record<string, unknown>;

  // 2. Validate root node type
  if (root.type !== "doc") {
    return {
      isValid: false,
      error: 'Root document must have type "doc".',
    };
  }

  // 3. Recursive validation of node tree and depth
  function checkNode(node: unknown, depth: number): { valid: boolean; error?: string } {
    if (depth > maxDepth) {
      return {
        valid: false,
        error: `Document exceeds maximum allowed nesting depth of ${maxDepth}.`,
      };
    }

    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return {
        valid: false,
        error: "Document node must be an object.",
      };
    }

    const n = node as Record<string, unknown>;
    if (typeof n.type !== "string" || n.type.trim().length === 0) {
      return {
        valid: false,
        error: "Document node must contain a non-empty string type.",
      };
    }

    if (n.text !== undefined && typeof n.text !== "string") {
      return {
        valid: false,
        error: "Text node text property must be a string.",
      };
    }

    if (n.marks !== undefined) {
      if (!Array.isArray(n.marks)) {
        return {
          valid: false,
          error: "Node marks must be an array.",
        };
      }
      for (const mark of n.marks) {
        if (!mark || typeof mark !== "object" || typeof (mark as Record<string, unknown>).type !== "string") {
          return {
            valid: false,
            error: "Each mark must be an object with a string type.",
          };
        }
      }
    }

    if (n.content !== undefined) {
      if (!Array.isArray(n.content)) {
        return {
          valid: false,
          error: "Node content must be an array.",
        };
      }
      for (const child of n.content) {
        const res = checkNode(child, depth + 1);
        if (!res.valid) return res;
      }
    }

    return { valid: true };
  }

  const nodeValidation = checkNode(root, 1);
  if (!nodeValidation.valid) {
    return {
      isValid: false,
      error: nodeValidation.error,
    };
  }

  return {
    isValid: true,
    data: root as unknown as TiptapNode,
  };
}
