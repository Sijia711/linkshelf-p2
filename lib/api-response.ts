import { NextResponse } from "next/server";
import type { ApiResponse, ApiErrorResponse } from "@/types/bookmark";

/**
 * Creates a standardized JSON success response.
 */
export function jsonSuccess<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data, error: null }, { status });
}

/**
 * Creates a standardized JSON error response.
 */
export function jsonError(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, string[]>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      data: null,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}
