# Security Specification — Krillion / Sapientia Online

## 1. Data Invariants
1. **Admin Authority (`/packs/{packId}`)**: Only verified administrators (`akhildforever@gmail.com` with `email_verified == true` or `/admins/{uid}`) may create, update, or delete published theme packs. All visitors may read published packs.
2. **Score Integrity (`/scores/{scoreId}`)**: Every score entry must be created by a verified authenticated player (`uid == request.auth.uid`), have `depth == points * 10`, use `createdAt == request.time`, contain zero PII (`email` or `phone` forbidden by `hasOnly`), and remain immutable after creation (`update: false`). Only admins may delete score entries.
3. **PII Isolation (`/users/{userId}`)**: Player email addresses and private registration details live exclusively in `/users/{userId}`. Only the profile owner (`uid == userId`) or a verified admin may `get` a profile; only verified admins may `list` `/users` for free event entry verification.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Score Spoof**: Unauthenticated `create` on `/scores/s1` -> Denied (`!isVerifiedUser()`).
2. **UID Impersonation**: User A creates `/scores/s2` with `uid: "userB"` -> Denied (`data.uid == request.auth.uid`).
3. **Shadow Field Injection**: User A creates `/scores/s3` with extra field `isAdmin: true` -> Denied (`keys().hasOnly(...)`).
4. **Backdated Timestamp**: User A creates `/scores/s4` with client `createdAt` instead of `request.time` -> Denied (`data.createdAt == request.time`).
5. **Score Tampering (Update)**: User A attempts `update` on `/scores/s2` to raise `depth` -> Denied (`allow update: if false`).
6. **Depth / Points Desync**: User A creates `/scores/s5` with `points: 10`, `depth: 999900` -> Denied (`data.depth == data.points * 10`).
7. **Resource Exhaustion / ID Poisoning**: User A creates `/scores/<200-char-id>` or `playerName` of 500 chars -> Denied (`isValidId` + `.size() <= 80`).
8. **Unverified Email Admin Spoof**: Token with `email: "akhildforever@gmail.com"` and `email_verified: false` attempts `/packs` write -> Denied (`email_verified == true`).
9. **Non-Admin Pack Hijack**: Regular verified user attempts `create` or `update` on `/packs/mbbs-survival` -> Denied (`isAdmin()`).
10. **PII Scraping (`list /users`)**: Regular signed-in player attempts `list` on `/users` -> Denied (`allow list: if isAdmin()`).
11. **Cross-User Profile Read**: User A attempts `get` on `/users/userB` -> Denied (`isOwner(userId) || isAdmin()`).
12. **Immutable Profile Field Override**: User A updates `/users/userA` changing `createdAt` or `uid` -> Denied (`incoming().uid == existing().uid && incoming().createdAt == existing().createdAt`).
