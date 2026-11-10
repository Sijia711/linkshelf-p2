# LinkShelf — REST API Contract

This document defines the formal API contract between the LinkShelf backend (Developer A) and frontend UI (Developer B). All endpoints are implemented as Next.js Route Handlers under `/api/bookmarks/`.

---

## 1. General Principles

### 1.1 Authentication & Authorization
- Every endpoint requires an authenticated user session managed via Supabase Auth cookies (`@supabase/ssr`) or a `Bearer <token>` in the `Authorization` header.
- Unauthenticated requests receive `401 Unauthorized`.
- Users can access, modify, or delete **only their own** bookmarks. Row Level Security (RLS) and server handlers enforce `auth.uid() = user_id`.

### 1.2 Request & Response Formats
- **Content-Type:** `application/json` for request bodies and responses.
- **Envelope Convention:** All JSON responses use a standard two-key envelope:
  - **Success:**
    ```json
    {
      "data": { ... },
      "error": null
    }
    ```
  - **Error:**
    ```json
    {
      "data": null,
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Human-readable summary",
        "details": {
          "field": ["Field specific error message"]
        }
      }
    }
    ```

### 1.3 Data Types
- **UUID:** Canonical RFC 4122 v4 lowercase strings (e.g., `"f47ac10b-58cc-4372-a567-0e02b2c3d479"`).
- **Timestamps:** ISO 8601 UTC strings (e.g., `"2026-11-09T08:00:00.000Z"`).
- **Tags:** Array of non-empty, trimmed, lowercase string tokens (e.g., `["nextjs", "react"]`).

### 1.4 Soft-Delete & Undo Semantics
- Bulk deletions mark records with `deleted_at = NOW()` rather than destroying them immediately.
- Standard queries (`GET /api/bookmarks`) exclude records where `deleted_at IS NOT NULL`.
- Restoring a batch (`POST /api/bookmarks/bulk-restore`) resets `deleted_at = NULL`, enabling Developer B's one-step **Undo** action.

---

## 2. Endpoints

### 2.1 `GET /api/bookmarks`
Retrieve active bookmarks belonging to the authenticated user.

#### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `q` | `string` | No | Case-insensitive title search. |
| `tag` | `string` | No | Exact tag filter (case-insensitive match). |
| `include_deleted` | `boolean` | No | If `"true"`, includes soft-deleted items (default: `false`). |

#### Response (200 OK)
```json
{
  "data": {
    "bookmarks": [
      {
        "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "user_id": "u1v2w3x4-y5z6-7a8b-9c0d-1e2f3a4b5c6d",
        "title": "Next.js Documentation",
        "url": "https://nextjs.org/docs",
        "tags": ["react", "nextjs", "docs"],
        "created_at": "2026-11-09T08:00:00.000Z",
        "updated_at": "2026-11-09T08:00:00.000Z",
        "deleted_at": null
      }
    ],
    "total": 1
  },
  "error": null
}
```

#### Error Response (401 Unauthorized)
```json
{
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required. Please sign in."
  }
}
```

---

### 2.2 `POST /api/bookmarks`
Create a new bookmark for the authenticated user.

#### Request Body
```json
{
  "title": "Tailwind CSS v4 Documentation",
  "url": "https://tailwindcss.com/docs",
  "tags": ["css", "styling", "frontend"]
}
```

#### Validation Rules
- `title`: String, required, 1–255 characters after trimming.
- `url`: String, required, valid URL with `http://` or `https://` protocol only.
- `tags`: Optional array of strings. Each tag is trimmed, deduplicated, and converted to lowercase.

#### Response (201 Created)
```json
{
  "data": {
    "id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
    "user_id": "u1v2w3x4-y5z6-7a8b-9c0d-1e2f3a4b5c6d",
    "title": "Tailwind CSS v4 Documentation",
    "url": "https://tailwindcss.com/docs",
    "tags": ["css", "styling", "frontend"],
    "created_at": "2026-11-09T08:05:00.000Z",
    "updated_at": "2026-11-09T08:05:00.000Z",
    "deleted_at": null
  },
  "error": null
}
```

#### Error Response (400 Bad Request — Validation)
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid bookmark input.",
    "details": {
      "url": ["URL must start with http:// or https://"],
      "title": ["Title cannot be empty"]
    }
  }
}
```

---

### 2.3 `PATCH /api/bookmarks/:id`
Update an existing bookmark's title, URL, or tags.

#### Path Parameters
- `id` (`string`, required): UUID of the bookmark to update.

#### Request Body (Partial update allowed)
```json
{
  "title": "Updated Title",
  "tags": ["updated-tag"]
}
```

#### Response (200 OK)
```json
{
  "data": {
    "id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
    "user_id": "u1v2w3x4-y5z6-7a8b-9c0d-1e2f3a4b5c6d",
    "title": "Updated Title",
    "url": "https://tailwindcss.com/docs",
    "tags": ["updated-tag"],
    "created_at": "2026-11-09T08:05:00.000Z",
    "updated_at": "2026-11-09T08:10:00.000Z",
    "deleted_at": null
  },
  "error": null
}
```

#### Error Response (404 Not Found)
```json
{
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Bookmark not found or you do not have permission to edit it."
  }
}
```

---

### 2.4 `DELETE /api/bookmarks/:id`
Delete a single bookmark permanently.

#### Path Parameters
- `id` (`string`, required): UUID of the bookmark to delete.

#### Response (200 OK)
```json
{
  "data": {
    "id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
    "deleted": true
  },
  "error": null
}
```

#### Error Response (404 Not Found)
```json
{
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Bookmark not found or you do not have permission to delete it."
  }
}
```

---

### 2.5 `POST /api/bookmarks/bulk-delete`
Soft-delete multiple bookmarks at once (supports single-step Undo).

#### Request Body
```json
{
  "ids": [
    "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"
  ]
}
```

#### Validation Rules
- `ids`: Array of valid UUID strings. Must contain at least 1 and at most 100 items.

#### Response (200 OK)
```json
{
  "data": {
    "affectedCount": 2,
    "ids": [
      "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"
    ]
  },
  "error": null
}
```

---

### 2.6 `POST /api/bookmarks/bulk-restore`
Restore previously soft-deleted bookmarks (the "Undo" endpoint).

#### Request Body
```json
{
  "ids": [
    "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"
  ]
}
```

#### Response (200 OK)
```json
{
  "data": {
    "affectedCount": 2,
    "ids": [
      "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"
    ]
  },
  "error": null
}
```

---

## 3. Standard Error Code Reference

| HTTP Code | Error Code | Description |
| :---: | :--- | :--- |
| **400** | `VALIDATION_ERROR` | Request payload failed field-level schema or validation rules. |
| **400** | `BAD_REQUEST` | Malformed JSON or invalid query parameter. |
| **401** | `UNAUTHORIZED` | Missing or invalid Supabase authentication session. |
| **403** | `FORBIDDEN` | Authenticated user lacks permission to access or mutate this record. |
| **404** | `NOT_FOUND` | Record does not exist or has been deleted. |
| **500** | `INTERNAL_ERROR` | Unhandled database or server exception. |
