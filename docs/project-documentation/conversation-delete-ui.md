# Conversation Delete UI

**Feature:** Delete action for conversations, on both the list and detail views
**Date:** 2026-07-13
**Files added:** `src/components/conversations/delete-conversation-dialog.tsx`, `src/app/dashboard/conversations/conversations-list-client.tsx`
**Files changed:** `src/components/conversations/conversation-card.tsx`, `src/app/dashboard/conversations/page.tsx`, `src/app/dashboard/conversations/[id]/page.tsx`
**Related:** `docs/plans/ai-data-explorer-fixes-plan.md` (F2-1), `docs/project-documentation/security-remediation.md`

## What was built

`DELETE /api/conversations/[id]` has existed since F2-1 (part of the certification remediation pass), but nothing in the app called it — there was no way to delete a conversation from the UI. This was reported directly: quoting the original grading feedback line ("Planned GET list / DELETE /api/conversations endpoints were never built... no way to delete a conversation") back at the app after F2-1 landed, confirming the API half was fixed but the UI half never was.

Three pieces close that gap:

1. **`DeleteConversationDialog`** (`src/components/conversations/delete-conversation-dialog.tsx`) — a single client component with two render modes:
   - `variant="icon"` — a small ghost trash-icon button, used on each row in the conversations list.
   - `variant="button"` — a labeled `destructive` button, used in the detail page's header action row.

   Both modes open the same confirmation dialog before calling `DELETE /api/conversations/[id]`. On success: `variant="icon"` calls an `onDeleted(id)` callback so the caller can remove the row from an in-memory list; `variant="button"` (used where there's no list to remove a row from — you're looking *at* the thing being deleted) redirects via `router.push(redirectTo)`.

2. **`ConversationsListClient`** (`src/app/dashboard/conversations/conversations-list-client.tsx`) — holds the list in `useState` so a delete can remove a row without a full page reload. `page.tsx` stays a server component that fetches from Prisma and passes serialized data down; the client component owns only the interactive part.

3. **Wiring into the two existing pages** — `ConversationCard` now renders the icon-variant dialog next to its content instead of the whole card being one giant `<Link>`; `/dashboard/conversations/[id]/page.tsx`'s `PageHeader` action row now has "All conversations" (outline) and "Delete" (destructive) side by side.

## Why key decisions were made

**A confirmation dialog, not a bare icon click.** `PinCard` (`src/components/pins/pin-card.tsx`) already has a delete trash-icon that deletes immediately on click, no confirmation. Deleting a conversation is a different risk level: `ConversationTurn.conversation` has `onDelete: Cascade` (`prisma/fragments/conversation.prisma`), so deleting one `Conversation` row deletes every turn — every question asked and every result — in that conversation. That's a bigger, less-recoverable loss than un-pinning a single saved chart. `docs/design-system/04-dialogs.md`'s own worked example for a destructive dialog is literally "Delete Project" with a cascading-data warning — this maps to that pattern, not the pin's lighter-weight one. Following the existing pin pattern here would have been the wrong precedent to copy.

**One component, two variants, not two components.** The list needs a small icon trigger; the detail page needs a labeled button. Both need the identical dialog body, the identical fetch call, and the identical error handling — only the trigger's visual shape and what happens after success (`onDeleted` vs. `redirectTo`) differ. Keeping that as one component with a `variant` prop means the confirmation copy, the destructive-button styling, and the fetch logic exist in exactly one place, not two that could drift.

**Link and delete button are siblings, not nested.** `ConversationCard` used to wrap its entire content in one `<Link>`. Putting an interactive `<button>` inside an `<a>` is invalid HTML nesting and unreliable for click handling (the button's click would bubble to the anchor's navigation unless carefully intercepted). The card was restructured so the `Link` wraps only the clickable "go to this conversation" content, and the delete trigger sits next to it inside the same `CardContent`, as a sibling — no nesting, no `preventDefault`/`stopPropagation` gymnastics required for correctness (a `stopPropagation` was still added on the icon trigger as a defensive habit, but it's no longer load-bearing).

**Server/client split, not a client-only page.** `ConversationsPage` stayed a server component that queries Prisma directly and does the auth redirect — exactly as before. Only the part that needs `useState` (the list, so a delete can remove a row live) moved into a new client component. This is the same split `PinsPage` / `PinsListClient` already established for pins; conversations now follow the identical shape rather than inventing a second one.

## How the pieces fit together

```
ConversationsPage (server)                ConversationDetailPage (server)
  fetch conversations via Prisma            fetch one conversation via Prisma
  → serialize dates to ISO strings          → assertOwnership is implicit here via
  → <ConversationsListClient                  the `where: { id, userId }` filter
       initialConversations={...} />        → <DeleteConversationDialog
                                                  variant="button"
ConversationsListClient (client)                 redirectTo="/dashboard/conversations" />
  useState(initialConversations)
  → <ConversationCard onDeleted={...} />

ConversationCard (client)
  <Link>...content...</Link>
  <DeleteConversationDialog variant="icon" onDeleted={...} />

DeleteConversationDialog (client, shared)
  <Dialog> — confirmation, "Delete conversation" / Cancel
    on confirm → fetch DELETE /api/conversations/[id]
      success → toast, then onDeleted?.(id) or router.push(redirectTo)
      failure → toast.error, dialog stays open
```

The actual delete authorization is unchanged from F2-1 — `DELETE /api/conversations/[id]` still runs `assertOwnership` before deleting anything. This change only adds a way to reach that endpoint from the UI; it does not change what the endpoint is allowed to do.

## Caveats and gotchas

- **`GET /api/conversations` still has no UI consumer.** The list page (`page.tsx`) queries Prisma directly, same as before this change — it was never rewritten to call its own `GET` endpoint. That endpoint exists to satisfy the certification's acceptance criterion ("the endpoint exists, is auth-scoped, and is covered by the smoke suite") and is exercised by `scripts/smoke-test.sh`, not by this page. Worth knowing if asked "does the conversations page use the API you built" — the honest answer is no, and that was already true before this change.
- **No optimistic UI beyond removing the row after a confirmed success.** The row disappears from the list only after the `DELETE` request returns `ok`. If the request fails, the row stays and a toast explains why — there's no optimistic removal that then rolls back on failure.
- **The detail page's delete button has no separate loading page.** On success it calls `router.push("/dashboard/conversations")` immediately; there's a brief moment where the now-deleted conversation's page could theoretically still be visible if the push resolves slower than expected. In practice this is instant on a local Postgres and wasn't worth adding a loading skeleton for.
- **This does not add a "restore" or "undo" path.** The dialog's copy says "This action cannot be undone" because, as of this change, that's literally true — no soft-delete/trash exists on the `Conversation` model. If that's ever wanted, it's a schema change (a `deletedAt` column), not a UI change.

## How to extend

- **Adding delete to another list+detail pair that follows the same shape** (e.g. if `pins` ever needed a labeled detail-page delete button too): reuse `DeleteConversationDialog`'s shape as the template — a single component with an icon/button variant switch, not two separate components.
- **Adding a bulk-delete ("select multiple, delete all") action:** would need a new endpoint (the current `DELETE /api/conversations/[id]` is single-row and `assertOwnership`-gated per row) and a new dialog copy ("Delete 3 conversations?") — not a small extension of this component, a separate piece of work.
