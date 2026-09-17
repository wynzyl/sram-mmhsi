"use client";

import { useState, useMemo, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteRoomAction,
  toggleRoomActiveAction,
} from "../schedules.actions";
import type { RoomView } from "../schedules.schema";
import { ROOM_TYPE_LABELS } from "../schedules.schema";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Users } from "lucide-react";
import RoomFormModal from "./RoomFormModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RoomsTableProps {
  rooms: RoomView[];
}

export function RoomsTable({ rooms }: RoomsTableProps) {
  const router = useRouter();
  const [editingRoom, setEditingRoom] = useState<RoomView | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState<RoomView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deletingRoom) return;
    setIsDeleting(true);
    try {
      const result = await deleteRoomAction(deletingRoom.id);
      if (result.success) {
        toast.success(result.message);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(result.message);
      }
    } finally {
      setIsDeleting(false);
      setDeletingRoom(null);
    }
  };

  const handleToggleActive = async (room: RoomView) => {
    setTogglingId(room.id);
    try {
      const result = await toggleRoomActiveAction(room.id);
      if (result.success) {
        toast.success(result.message);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(result.message);
      }
    } finally {
      setTogglingId(null);
    }
  };

  const columns = useMemo<ColumnDef<RoomView>[]>(
    () => [
      {
        header: "Code",
        accessorKey: "code",
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium">
            {row.original.code}
          </span>
        ),
      },
      {
        header: "Room Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        header: "Building",
        accessorKey: "building",
        cell: ({ row }) =>
          row.original.building ? (
            <span>
              {row.original.building}
              {row.original.floor && ` / ${row.original.floor}`}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        header: "Type",
        accessorKey: "roomType",
        cell: ({ row }) => (
          <Badge variant="secondary">
            {ROOM_TYPE_LABELS[row.original.roomType]}
          </Badge>
        ),
      },
      {
        header: "Capacity",
        accessorKey: "capacity",
        cell: ({ row }) =>
          row.original.capacity ? (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              {row.original.capacity}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        header: "Slots",
        accessorKey: "slotCount",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.slotCount}</span>
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
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const room = row.original;
          const canDelete = room.slotCount === 0;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleToggleActive(room)}
                disabled={togglingId === room.id}
                title={room.isActive ? "Deactivate" : "Activate"}
              >
                {room.isActive ? (
                  <ToggleRight className="h-4 w-4 text-success" />
                ) : (
                  <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingRoom(room)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeletingRoom(room)}
                className="text-destructive hover:text-destructive"
                disabled={!canDelete}
                title={canDelete ? "Delete" : "Cannot delete: has schedule slots"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [togglingId]
  );

  return (
    <>
      <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          {rooms.length} room{rooms.length !== 1 ? "s" : ""}
        </span>
        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Room
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rooms}
        searchable
        searchPlaceholder="Search rooms..."
      />

      {/* Create Modal */}
      <RoomFormModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={() => {
          setShowCreateModal(false);
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* Edit Modal */}
      {editingRoom && (
        <RoomFormModal
          key={editingRoom.id}
          open={true}
          onOpenChange={(open) => !open && setEditingRoom(null)}
          room={editingRoom}
          onSuccess={() => {
            setEditingRoom(null);
            startTransition(() => {
              router.refresh();
            });
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingRoom}
        onOpenChange={(open) => !open && setDeletingRoom(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingRoom?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
