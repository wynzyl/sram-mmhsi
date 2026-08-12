"use client";

import { useState, useMemo } from "react";
import { deleteDiscountTypeAction } from "../actions/discount-types.actions";
import type { DiscountTypeView } from "../discounts.schema";
import { DataTable } from "@/components/shared/DataTable";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import DiscountTypeFormModal from "./DiscountTypeFormModal";

interface DiscountTypesTableProps {
  discountTypes: DiscountTypeView[];
}

export default function DiscountTypesTable({
  discountTypes,
}: DiscountTypesTableProps) {
  const [editingType, setEditingType] = useState<DiscountTypeView | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteDiscountTypeAction(id);
    } finally {
      setDeleting(false);
      setDeletingId(null);
    }
  };

  const formatValue = (type: DiscountTypeView) => {
    if (type.calculationType === "percentage") {
      return `${Number(type.defaultValue)}%`;
    }
    return <CurrencyDisplay amount={Number(type.defaultValue)} />;
  };

  const columns = useMemo<ColumnDef<DiscountTypeView>[]>(
    () => [
      {
        header: "Code",
        accessorKey: "code",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.code}</span>
        ),
      },
      {
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            {row.original.description && (
              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                {row.original.description}
              </div>
            )}
          </div>
        ),
      },
      {
        header: "Type",
        accessorKey: "calculationType",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.calculationType === "percentage"
              ? "Percentage"
              : "Fixed Amount"}
          </span>
        ),
      },
      {
        header: "Applies To",
        accessorKey: "baseType",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.baseType === "tuition_only"
              ? "Tuition Only"
              : "Full Assessment"}
          </span>
        ),
      },
      {
        header: "Default Value",
        accessorKey: "defaultValue",
        cell: ({ row }) => (
          <span className="font-medium">{formatValue(row.original)}</span>
        ),
      },
      {
        header: "Status",
        accessorKey: "isActive",
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "success" : "secondary"}>
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        header: "Options",
        id: "options",
        cell: ({ row }) => (
          <div className="flex gap-1 text-xs">
            {row.original.isStackable && (
              <span className="px-1.5 py-0.5 bg-muted rounded">
                Stackable
              </span>
            )}
            {row.original.requiresDocumentation && (
              <span className="px-1.5 py-0.5 bg-muted rounded">
                Docs Required
              </span>
            )}
          </div>
        ),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => {
          const discountType = row.original;

          if (deletingId === discountType.id) {
            return (
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground">Delete?</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(discountType.id)}
                  loading={deleting}
                >
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingId(null)}
                >
                  Cancel
                </Button>
              </div>
            );
          }

          return (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingType(discountType)}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeletingId(discountType.id)}
              >
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    [deletingId, deleting]
  );

  return (
    <div>
      {/* Header with Create button */}
      <div className="flex justify-between items-center mb-4 px-4">
        <div>
          <h2 className="text-lg font-semibold">Discount Types</h2>
          <p className="text-sm text-muted-foreground">
            Manage available discount types for student enrollments
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          Add Discount Type
        </Button>
      </div>

      {discountTypes.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-muted-foreground mb-2">
            No discount types configured
          </div>
          <p className="text-sm text-muted-foreground">
            Create discount types to enable registrars to tag students for
            discounts.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} data={discountTypes} searchable={true} />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <DiscountTypeFormModal
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit Modal */}
      {editingType && (
        <DiscountTypeFormModal
          discountType={editingType}
          onClose={() => setEditingType(null)}
        />
      )}
    </div>
  );
}
