"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { StrandFormDialog } from "@/features/academics/strands";

export function AddStrandButton() {
  const [open, setOpen] = useState(false);
  // Key increments each time dialog opens to reset useActionState
  const [dialogKey, setDialogKey] = useState(0);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Increment key to force fresh component state
      setDialogKey((k) => k + 1);
    }
    setOpen(newOpen);
  };

  return (
    <>
      <Button onClick={() => handleOpenChange(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Strand
      </Button>
      <StrandFormDialog key={dialogKey} open={open} onOpenChange={handleOpenChange} />
    </>
  );
}
