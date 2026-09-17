"use client";

import { useActionState, useState } from "react";
import {
  createRoomAction,
  updateRoomAction,
} from "../schedules.actions";
import type {
  RoomView,
  CreateRoomFormState,
  UpdateRoomFormState,
  RoomType,
} from "../schedules.schema";
import { ROOM_TYPES, ROOM_TYPE_LABELS } from "../schedules.schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RoomFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: RoomView;
  onSuccess: () => void;
}

export default function RoomFormModal({
  open,
  onOpenChange,
  room,
  onSuccess,
}: RoomFormModalProps) {
  const isEditing = !!room;

  // Form state
  const [code, setCode] = useState(room?.code ?? "");
  const [name, setName] = useState(room?.name ?? "");
  const [building, setBuilding] = useState(room?.building ?? "");
  const [floor, setFloor] = useState(room?.floor ?? "");
  const [capacity, setCapacity] = useState(room?.capacity?.toString() ?? "");
  const [roomType, setRoomType] = useState<RoomType>(
    room?.roomType ?? "classroom"
  );

  const initialState: CreateRoomFormState | UpdateRoomFormState = {};

  const [state, action, pending] = useActionState(
    isEditing ? updateRoomAction : createRoomAction,
    initialState
  );

  useFormToast(state, {
    successMessage: isEditing
      ? "Room updated successfully"
      : "Room created successfully",
    onSuccess: () => {
      onSuccess();
      // Reset form for create
      if (!isEditing) {
        setCode("");
        setName("");
        setBuilding("");
        setFloor("");
        setCapacity("");
        setRoomType("classroom");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Room" : "Create Room"}</DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {isEditing && <input type="hidden" name="id" value={room.id} />}

          {/* Room Code */}
          <div className="space-y-2">
            <Label htmlFor="code">Room Code</Label>
            <Input
              id="code"
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="RM-101"
              required
              maxLength={20}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier (letters, numbers, hyphens only)
            </p>
            {state.errors?.code && (
              <p className="text-sm text-destructive">{state.errors.code[0]}</p>
            )}
          </div>

          {/* Room Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Room Name</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Room 101"
              required
              maxLength={100}
            />
            {state.errors?.name && (
              <p className="text-sm text-destructive">{state.errors.name[0]}</p>
            )}
          </div>

          {/* Room Type */}
          <div className="space-y-2">
            <Label htmlFor="roomType">Room Type</Label>
            <Select
              name="roomType"
              value={roomType}
              onValueChange={(v) => setRoomType(v as RoomType)}
            >
              <SelectTrigger id="roomType">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ROOM_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Building and Floor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="building">Building (Optional)</Label>
              <Input
                id="building"
                name="building"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="Main Building"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="floor">Floor (Optional)</Label>
              <Input
                id="floor"
                name="floor"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="2nd Floor"
                maxLength={20}
              />
            </div>
          </div>

          {/* Capacity */}
          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity (Optional)</Label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="40"
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of students
            </p>
          </div>

          {/* General Error */}
          {state.message && !state.success && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                  ? "Update Room"
                  : "Create Room"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
