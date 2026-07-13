"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@upstart13-com/aiden-ui";

interface DeleteConversationDialogProps {
  id:    string;
  title: string;
  /**
   * "icon"   — small ghost trash-icon trigger, for the conversations list card.
   * "button" — labeled destructive button, for the conversation detail page header.
   */
  variant: "icon" | "button";
  /**
   * Called after a successful delete when the caller wants to remove this
   * row from an in-memory list instead of navigating away (list view).
   */
  onDeleted?: (id: string) => void;
  /**
   * Where to navigate after a successful delete when there's no list to
   * remove the row from (detail view — the conversation being viewed no
   * longer exists once deleted).
   */
  redirectTo?: string;
}

/**
 * A conversation delete is more consequential than a pin delete (it
 * cascades every ConversationTurn in it — see prisma/fragments/conversation.prisma),
 * so unlike PinCard's un-confirmed trash icon, this always goes through the
 * design system's destructive confirmation dialog (docs/design-system/04-dialogs.md)
 * before calling DELETE /api/conversations/[id].
 */
export function DeleteConversationDialog({
  id,
  title,
  variant,
  onDeleted,
  redirectTo,
}: DeleteConversationDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Delete failed", {
          description: "Could not remove this conversation. Please try again.",
        });
        return;
      }
      toast.success("Conversation deleted");
      setOpen(false);
      if (onDeleted) onDeleted(id);
      if (redirectTo) router.push(redirectTo);
    } catch {
      toast.error("Network error", { description: "Please try again." });
    } finally {
      setDeleting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!deleting) setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {variant === "icon" ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className="text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Delete conversation"
        >
          <Trash2 className="size-4" strokeWidth={1.5} />
        </Button>
      ) : (
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 className="mr-2 size-4" strokeWidth={1.5} />
          Delete
        </Button>
      )}

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete &quot;{title}&quot;</DialogTitle>
          <DialogDescription>
            This will permanently delete this conversation and every turn in
            it. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" strokeWidth={1.5} />
                Deleting…
              </>
            ) : (
              "Delete conversation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
