"use client";

import { useActionState, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormToast } from "@/hooks/useFormToast";
import {
  SHS_STRAND_CODES,
  SHS_STRAND_LABELS,
} from "@/lib/constants/strands";
import type { StrandView, CreateStrandFormState, UpdateStrandFormState } from "../strands.schema";
import { createStrandAction, updateStrandAction } from "../strands.actions";

interface StrandFormDialogProps {
  strand?: StrandView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StrandFormDialog({
  strand,
  open,
  onOpenChange,
}: StrandFormDialogProps) {
  const router = useRouter();
  const isEditing = !!strand;

  const [createState, createAction, createPending] = useActionState<
    CreateStrandFormState,
    FormData
  >(createStrandAction, {});

  const [updateState, updateAction, updatePending] = useActionState<
    UpdateStrandFormState,
    FormData
  >(updateStrandAction, {});

  const state = isEditing ? updateState : createState;
  const action = isEditing ? updateAction : createAction;
  const isPending = isEditing ? updatePending : createPending;

  // Handle success/error state changes
  useFormToast(state, {
    successMessage: isEditing ? "Strand updated successfully" : "Strand created successfully",
    onSuccess: () => {
      onOpenChange(false);
      startTransition(() => {
        router.refresh();
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Strand" : "Add Strand"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the strand details below."
              : "Add a new SHS academic strand."}
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {isEditing && <input type="hidden" name="id" value={strand.id} />}

          {/* Strand Code - only for new strands */}
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="code">Strand Code *</Label>
              <Select name="code" required>
                <SelectTrigger id="code">
                  <SelectValue placeholder="Select strand code" />
                </SelectTrigger>
                <SelectContent>
                  {SHS_STRAND_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code} - {SHS_STRAND_LABELS[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isEditing && (createState.errors as Record<string, string[]> | undefined)?.code && (
                <p className="text-sm text-destructive">{(createState.errors as Record<string, string[]>).code[0]}</p>
              )}
            </div>
          )}

          {/* Display code for editing */}
          {isEditing && (
            <div className="space-y-2">
              <Label>Strand Code</Label>
              <p className="text-sm font-medium">{strand.code}</p>
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={strand?.name ?? ""}
              placeholder="Full strand name"
              required
            />
            {state.errors?.name && (
              <p className="text-sm text-destructive">{state.errors.name[0]}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={strand?.description ?? ""}
              placeholder="Brief description of the strand"
              rows={3}
            />
            {state.errors?.description && (
              <p className="text-sm text-destructive">
                {state.errors.description[0]}
              </p>
            )}
          </div>

          {/* Display Order */}
          <div className="space-y-2">
            <Label htmlFor="displayOrder">Display Order</Label>
            <Input
              id="displayOrder"
              name="displayOrder"
              type="number"
              min={0}
              defaultValue={strand?.displayOrder ?? 0}
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first in lists.
            </p>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isActive">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive strands cannot be selected for new enrollments.
              </p>
            </div>
            <Switch
              id="isActive"
              name="isActive"
              value="true"
              defaultChecked={strand?.isActive ?? true}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Strand"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
