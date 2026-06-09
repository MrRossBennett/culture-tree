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

interface DeleteTreeNodeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly branchLabel: string;
  readonly isPending?: boolean;
  readonly onConfirm: () => void;
}

export function DeleteTreeNodeDialog({
  open,
  onOpenChange,
  branchLabel,
  isPending = false,
  onConfirm,
}: DeleteTreeNodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Delete branch?</DialogTitle>
          <DialogDescription className="font-body text-base leading-relaxed">
            <span className="text-foreground">{branchLabel}</span> will be removed from this tree
            and this can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3">
          <p className="font-body text-sm text-foreground">
            Only this Branch will be removed from its Guide Section.
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
              "Delete branch"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
