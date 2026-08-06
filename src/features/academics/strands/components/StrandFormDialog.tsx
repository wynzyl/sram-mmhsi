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
  TRACK_CATEGORIES,
  TRACK_CATEGORY_LABELS,
} from "@/lib/constants/track-categories";
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
    successMessage: isEditing ? "Track updated successfully" : "Track created successfully",
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
          <DialogTitle>{isEditing ? "Edit Track" : "Add Track"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the track details below."
              : "Add a new SHS academic track. Tracks own subjects directly."}
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {isEditing && <input type="hidden" name="id" value={strand.id} />}

          {/* Track Code */}
          <div className="space-y-2">
            <Label htmlFor="code">Track Code *</Label>
            <Input
              id="code"
              name="code"
              defaultValue={strand?.code ?? ""}
              placeholder="e.g., STEM, ABM, TVL-ICT"
              required
              className="uppercase"
            />
            <p className="text-xs text-muted-foreground">
              Uppercase letters, numbers, and hyphens only. Example: STEM, TVL-ICT, MAHS
            </p>
            {state.errors?.code && (
              <p className="text-sm text-destructive">{state.errors.code[0]}</p>
            )}
          </div>

          {/* Short Code */}
          <div className="space-y-2">
            <Label htmlFor="shortCode">Short Code *</Label>
            <Input
              id="shortCode"
              name="shortCode"
              defaultValue={strand?.shortCode ?? ""}
              placeholder="e.g., STEM, ICT"
              required
              maxLength={10}
              className="uppercase"
            />
            <p className="text-xs text-muted-foreground">
              Abbreviation for badges. For TVL-ICT, use ICT as short code.
            </p>
            {state.errors?.shortCode && (
              <p className="text-sm text-destructive">{state.errors.shortCode[0]}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={strand?.name ?? ""}
              placeholder="Full track name"
              required
            />
            {state.errors?.name && (
              <p className="text-sm text-destructive">{state.errors.name[0]}</p>
            )}
          </div>

          {/* Track Category */}
          <div className="space-y-2">
            <Label htmlFor="trackCategory">Category *</Label>
            <Select name="trackCategory" defaultValue={strand?.trackCategory ?? "academic"} required>
              <SelectTrigger id="trackCategory">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {TRACK_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {TRACK_CATEGORY_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.errors?.trackCategory && (
              <p className="text-sm text-destructive">{state.errors.trackCategory[0]}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={strand?.description ?? ""}
              placeholder="Brief description of the track"
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
                Inactive tracks cannot be selected for new enrollments.
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
                  : "Create Track"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
