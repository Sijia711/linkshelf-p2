# LinkShelf — REST API Documentation

The LinkShelf REST API enables authenticated clients to manage bookmark libraries, search and filter links by title or tags, and perform bulk deletions with a single-step Undo.

---

## 1. Authentication & Security

All `/api/bookmarks/` endpoints require an active Supabase user session:
- **Web Browser (Next.js App):** Handled automatically via HTTP-only session cookies managed by `@supabase/ssr`.
- **API Clients / Curl:** Pass the user's JWT in the `Authorization` header:
  ```http
  Authorization: Bearer <supabase_access_token>
  ```
- **Row Level Security (RLS):** All database operations run under PostgreSQL RLS policies where `auth.uid() = user_id`. Users can never view, update, soft-delete, or restore bookmarks owned by another user.
- **Service Role:** No client has access to service-role credentials.

---

## 2. Response Envelope Format

All responses use a consistent envelope format:

### Success (HTTP 200 or 201)
```json
{
  "data": { ... },
  "error": null
}
```

### Error (HTTP 400, 401, 404, 500)
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid bookmark input.",
    "details": {
      "url": ["URL must use http:// or https:// protocol."]
    }
  }
}
```

---

## 3. Endpoints

### 3.1 List Bookmarks
`GET /api/bookmarks`

Returns the authenticated user's bookmarks sorted by creation date descending (`created_at DESC`). Active bookmarks (`deleted_at IS NULL`) are returned by default.

#### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `q` | `string` | No | Case-insensitive title search (matches `%<q>%`). |
| `tag` | `string` | No | Exact tag filter (case-insensitive array containment). |
| `include_deleted` | `boolean` | No | Set to `"true"` to include soft-deleted bookmarks. |

#### Sample Request
```bash
curl -X GET "http://localhost:3000/api/bookmarks?tag=nextjs&q=docs" \
  -H "Authorization: Bearer <token>"
```

#### Response (200 OK)
```json
{
  "data": {
    "bookmarks": [
      {
        "id": "e4b5c6d7-e8f9-4a0b-1c2d-3e4f5a6b7c8d",
        "user_id": "u1v2w3x4-y5z6-7a8b-9c0d-1e2f3a4b5c6d",
        "title": "Next.js Documentation",
        "url": "https://nextjs.org/docs",
        "tags": ["docs", "nextjs", "react"],
        "created_at": "2026-11-09T10:00:00.000Z",
        "updated_at": "2026-11-09T10:00:00.000Z",
        "deleted_at": null
      }
    ],
    "total": 1
  },
  "error": null
}
```

---

### 3.2 Create Bookmark
`POST /api/bookmarks`

Creates a new bookmark. The owner `user_id` is automatically set to the authenticated user's ID.

#### Request Body
```json
{
  "title": "Vitest Testing Framework",
  "url": "https://vitest.dev",
  "tags": ["testing", "vitest", "tdd"]
}
```

#### Validation Rules
- `title`: String, required, 1–255 characters after trimming.
- `url`: String, required, must use `http://` or `https://` protocol only.
- `tags`: Optional array of strings. Tags are trimmed, lowercased, and deduplicated automatically.

#### Sample Request
```bash
curl -X POST "http://localhost:3000/api/bookmarks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title": "Vitest", "url": "https://vitest.dev", "tags": ["testing"]}'
```

#### Response (201 Created)
```json
{
  "data": {
    "id": "f5a6b7c8-d9e0-4f1a-2b3c-4d5e6f7a8b9c",
    "user_id": "u1v2w3x4-y5z6-7a8b-9c0d-1e2f3a4b5c6d",
    "title": "Vitest",
    "url": "https://vitest.dev",
    "tags": ["testing"],
    "created_at": "2026-11-09T10:15:00.000Z",
    "updated_at": "2026-11-09T10:15:00.000Z",
    "deleted_at": null
  },
  "error": null
}
```

---

### 3.3 Update Bookmark
`PATCH /api/bookmarks/:id`

Updates an existing active bookmark owned by the authenticated user. Changing ownership (`user_id`) is strictly prohibited.

#### Path Parameters
- `id` (`string`, required): UUID of the bookmark.

#### Request Body (Provide at least one field)
```json
{
  "title": "Updated Title",
  "url": "https://updated-url.com",
  "tags": ["updated", "tag"]
}
```

#### Sample Request
```bash
curl -X PATCH "http://localhost:3000/api/bookmarks/f5a6b7c8-d9e0-4f1a-2b3c-4d5e6f7a8b9c" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title": "Vitest 5.x Documentation"}'
```

#### Response (200 OK)
```json
{
  "data": {
    "id": "f5a6b7c8-d9e0-4f1a-2b3c-4d5e6f7a8b9c",
    "user_id": "u1v2w3x4-y5z6-7a8b-9c0d-1e2f3a4b5c6d",
    "title": "Vitest 5.x Documentation",
    "url": "https://vitest.dev",
    "tags": ["testing"],
    "created_at": "2026-11-09T10:15:00.000Z",
    "updated_at": "2026-11-09T10:20:00.000Z",
    "deleted_at": null
  },
  "error": null
}
```

#### Error (404 Not Found)
Returned if the bookmark ID does not exist, belongs to another user, or has already been soft-deleted.

---

### 3.4 Soft-Delete Single Bookmark
`DELETE /api/bookmarks/:id`

Soft-deletes a single bookmark by marking `deleted_at = NOW()`. Physical rows are never removed.

#### Path Parameters
- `id` (`string`, required): UUID of the bookmark.

#### Sample Request
```bash
curl -X DELETE "http://localhost:3000/api/bookmarks/f5a6b7c8-d9e0-4f1a-2b3c-4d5e6f7a8b9c" \
  -H "Authorization: Bearer <token>"
```

#### Response (200 OK)
```json
{
  "data": {
    "id": "f5a6b7c8-d9e0-4f1a-2b3c-4d5e6f7a8b9c",
    "deleted": true
  },
  "error": null
}
```

---

### 3.5 Bulk Soft-Delete Bookmarks
`POST /api/bookmarks/bulk-delete`

Soft-deletes multiple bookmarks owned by the user. Enables single-step Undo.

#### Request Body
```json
{
  "ids": [
    "e4b5c6d7-e8f9-4a0b-1c2d-3e4f5a6b7c8d",
    "f5a6b7c8-d9e0-4f1a-2b3c-4d5e6f7a8b9c"
  ]
}
```

#### Sample Request
```bash
curl -X POST "http://localhost:3000/api/bookmarks/bulk-delete" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"ids": ["e4b5c6d7-e8f9-4a0b-1c2d-3e4f5a6b7c8d"]}'
```

#### Response (200 OK)
```json
{
  "data": {
    "affectedCount": 1,
    "ids": ["e4b5c6d7-e8f9-4a0b-1c2d-3e4f5a6b7c8d"]
  },
  "error": null
}
```

---

### 3.6 Bulk Restore Bookmarks (Undo)
`POST /api/bookmarks/bulk-restore`

Restores soft-deleted bookmarks by setting `deleted_at = NULL`. Powers the frontend **Undo** button.

#### Request Body
```json
{
  "ids": [
    "e4b5c6d7-e8f9-4a0b-1c2d-3e4f5a6b7c8d"
  ]
}
```

#### Sample Request
```bash
curl -X POST "http://localhost:3000/api/bookmarks/bulk-restore" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"ids": ["e4b5c6d7-e8f9-4a0b-1c2d-3e4f5a6b7c8d"]}'
```

#### Response (200 OK)
```json
{
  "data": {
    "affectedCount": 1,
    "ids": ["e4b5c6d7-e8f9-4a0b-1c2d-3e4f5a6b7c8d"]
  },
  "error": null
}
```

---

## 4. Error Codes Reference

| Status | Code | Description |
| :---: | :--- | :--- |
| **400** | `VALIDATION_ERROR` | Request body or query parameters failed schema rules. |
| **400** | `BAD_REQUEST` | Malformed JSON or invalid path UUID. |
| **401** | `UNAUTHORIZED` | User is not signed in or access token is invalid. |
| **404** | `NOT_FOUND` | Bookmark does not exist, belongs to another user, or was deleted. |
| **500** | `INTERNAL_ERROR` | Database or unexpected server error. |
