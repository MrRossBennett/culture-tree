import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { LoaderCircleIcon } from "lucide-react";

interface DeleteTreeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly treeLabel: string;
  readonly isPending?: boolean;
  readonly onConfirm: () => void;
}

export function DeleteTreeDialog({
  open,
  onOpenChange,
  treeLabel,
  isPending = false,
  onConfirm,
}: DeleteTreeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Delete tree?</DialogTitle>
          <DialogDescription className="font-body text-base leading-relaxed">
            <span className="text-foreground">{treeLabel}</span> and all of its Branches will be
            permanently removed and this can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3">
          <p className="font-body text-sm text-foreground">
            Everyone with the link will lose access to this Culture Tree.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? (
              <>
                <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                Deleting…
              </>
            ) : (
              "Delete tree"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
