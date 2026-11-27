# Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. Every workspace `/workspaces/{workspaceId}` is strictly owned by `workspaceId == request.auth.uid` and `ownerId == request.auth.uid`.
2. Every subcollection document (`teams`, `members`, `features`, `sprints`, `stories`) requires:
   - The parent workspace `/workspaces/{workspaceId}` to exist and have `ownerId == request.auth.uid`.
   - `incoming().ownerId == request.auth.uid`.
   - `isValidId()` on every path variable (`workspaceId`, `teamId`, `memberId`, `featureId`, `sprintId`, `storyId`).
   - `request.auth.token.email_verified == true`.
   - Strict key whitelisting (`hasAll` + `hasOnly` on create; `affectedKeys().hasOnly(...)` on update).
   - Immutable `ownerId` and `createdAt` fields on update, and `request.time` enforcement on `createdAt`/`updatedAt`.
3. Arrays (`skills`, `teamAllocations`, `requiredSkills`) are strictly bounded (`<= 12` entries) and typed on element `[0]` when non-empty.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write** to `/workspaces/{uid}/stories/{id}` (`request.auth == null`).
2. **Unverified email write** (`request.auth.token.email_verified == false`).
3. **Cross-tenant workspace read/list** (`workspaceId != request.auth.uid`).
4. **Identity spoofing on create** (`incoming().ownerId = "other-uid"`).
5. **Shadow / ghost field injection** on create (`isAdmin: true`, `extraField: 123`).
6. **Ghost field injection** on update (`affectedKeys()` includes `ownerId` or `createdAt` or `ghost`).
7. **ID poisoning** via oversized or invalid characters in `{storyId}` (`"../admin"`, 500-char ID).
8. **Type poisoning** on `storyPoints` (string `"5"` instead of number, or negative `-5`).
9. **Unbounded array / Denial-of-Wallet** (`requiredSkills` with 50 items, or 10KB title string).
10. **Client-forged timestamp** (`createdAt` or `updatedAt != request.time`).
11. **Orphaned subcollection write** where parent `/workspaces/{workspaceId}` does not exist.
12. **Blanket list query** attempting to list `/workspaces` or `/workspaces/{otherUid}/stories`.
