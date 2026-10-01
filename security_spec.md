# Security Specification (`security_spec.md`) — MyWardrobe AI

## 1. Data Invariants & Master Source of Truth

1. **Zero Cross-User Wardrobe Leak (Privacy Mandate)**:
   - Every document in `/users/{userId}`, `/wardrobeItems/{itemId}`, `/outfits/{outfitId}`, `/feedback/{feedbackId}`, and `/trips/{tripId}` belongs strictly to a single authenticated, email-verified user (`request.auth.uid == userId` and `request.auth.token.email_verified == true`).
   - No user can `get`, `list`, `create`, `update`, or `delete` another user's profile, wardrobe photos/items, outfits, style feedback, or trip packing lists.
2. **Secure List Queries (The Query Enforcer)**:
   - All `allow list` rules on `/wardrobeItems`, `/outfits`, `/feedback`, and `/trips` explicitly verify `resource.data.userId == request.auth.uid`. Blanket `isSignedIn()` list rules are strictly prohibited.
   - `/users` does not permit collection-wide `list` queries at all (`allow list: if false;`).
3. **Strict Key & Type Validation (Anti-Update-Gap)**:
   - Every `create` and `update` operation invokes the entity validation helper (`isValidUserProfile`, `isValidWardrobeItem`, `isValidOutfit`, `isValidStyleFeedback`, `isValidTripPlan`), enforcing exact key sets (`hasAll` + `hasOnly`), bounded strings, bounded arrays, valid enums, and regex ID checks (`isValidId`).
4. **Temporal & Identity Immutability**:
   - `createdAt` must equal `request.time` on `create` and remain immutable on `update` (`incoming().createdAt == existing().createdAt`).
   - `updatedAt` must equal `request.time` on `create` and `update`.
   - `userId`, `itemId`, `outfitId`, `feedbackId`, and `tripId` are strictly immutable after creation.
5. **Relational Integrity**:
   - Creating a `/feedback/{feedbackId}` record requires that `/outfits/$(incoming().outfitId)` exists and is owned by `request.auth.uid`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 — Identity Spoofing on Wardrobe Creation**:
   `{ "itemId": "item_1", "userId": "victim_uid_999", "name": "Stolen Shirt", ... }` submitted by `attacker_uid_111` -> **REJECTED** (`data.userId == request.auth.uid` fails).
2. **Payload 2 — Unverified Email Write Attempt**:
   Authenticated user with `email_verified: false` attempts to create a `UserProfile` -> **REJECTED** (`isVerifiedUser()` fails).
3. **Payload 3 — Shadow Field Injection on Update**:
   User updates `/wardrobeItems/item_1` with `{ ...validFields, "isAdmin": true }` -> **REJECTED** (`hasOnly` in `isValidWardrobeItem` and `affectedKeys().hasOnly(...)` fails).
4. **Payload 4 — Cross-User Wardrobe List Scraping**:
   Authenticated user queries `collection(db, 'wardrobeItems')` without `where('userId', '==', auth.uid)` -> **REJECTED** (`allow list` checks `resource.data.userId == request.auth.uid`).
5. **Payload 5 — Cross-User Profile Read (PII / Preference Leak)**:
   `attacker_uid` calls `getDoc(doc(db, 'users', 'victim_uid'))` -> **REJECTED** (`request.auth.uid == userId` fails).
6. **Payload 6 — ID Poisoning Attack**:
   User attempts to create `/wardrobeItems/invalid$id!with/slashes` or 500-char ID -> **REJECTED** (`isValidId(itemId)` fails).
7. **Payload 7 — Timestamp Forgery (Backdating `createdAt`)**:
   User sends `createdAt: Timestamp.fromMillis(946684800000)` on `create` -> **REJECTED** (`incoming().createdAt == request.time` fails).
8. **Payload 8 — Immortal Field Mutation (`createdAt` or `userId` modified on update)**:
   User updates `/outfits/outfit_1` changing `createdAt` or `userId` -> **REJECTED** (`incoming().createdAt == existing().createdAt` and `affectedKeys().hasOnly(...)` fail).
9. **Payload 9 — Denial-of-Wallet Oversized String / Array**:
   User sends a 10,000-character `notes` field or 50-item `occasions` array in `/wardrobeItems/item_1` -> **REJECTED** (`data.notes.size() <= 500` and `data.occasions.size() <= 15` fail).
10. **Payload 10 — Value Poisoning on Allowed Update Key**:
    User updates `usageCount` on `/wardrobeItems/item_1` with `"a_string_instead_of_int"` or `-5` -> **REJECTED** (`isValidWardrobeItem(incoming())` wraps the entire `allow update` block and enforces `data.usageCount is int && data.usageCount >= 0`).
11. **Payload 11 — Orphaned Feedback Creation**:
    User creates `/feedback/fb_1` referencing a non-existent `outfitId: "ghost_outfit"` or an outfit owned by another user -> **REJECTED** (`exists(...)` and ownership check via `get(...).data.userId == request.auth.uid` fail).
12. **Payload 12 — Feedback Mutation / Tampering**:
    User attempts to update an existing `/feedback/fb_1` record -> **REJECTED** (`allow update: if false;` on immutable audit feedback logs).
