"use client";

import { useState, useActionState } from "react";
import {
  addFeeScheduleItemAction,
  removeFeeScheduleItemAction,
} from "@/actions/finance";
import type { FeeScheduleItemFormState } from "@/lib/validators/finance";

interface FeeScheduleItem {
  id: string;
  description: string;
  amount: number;
  isDiscount: boolean;
  order: number;
}

interface FeeScheduleItemsListProps {
  feeScheduleId: string;
  items: FeeScheduleItem[];
}

export default function FeeScheduleItemsList({
  feeScheduleId,
  items,
}: FeeScheduleItemsListProps) {
  const [showAdd, setShowAdd] = useState(false);
  const addInitialState: FeeScheduleItemFormState = {};
  const [addState, addAction, addPending] = useActionState(
    addFeeScheduleItemAction,
    addInitialState
  );

  const removeInitialState: FeeScheduleItemFormState = {};
  const [removeState, removeAction, removePending] = useActionState(
    removeFeeScheduleItemAction,
    removeInitialState
  );

  // If add was successful and we're showing the form, hide it
  // But wait, useActionState doesn't clear easily without useEffect,
  // we can just hide it when addPending becomes false and it was successful.
  // For simplicity, we just keep the form open or close it manually.

  const total = items.reduce(
    (acc, curr) => acc + (curr.isDiscount ? -Number(curr.amount) : Number(curr.amount)),
    0
  );

  return (
    <div className="card">
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between" }}>
        <h2 className="card-title">Schedule Items</h2>
        {!showAdd && (
          <button className="btn-secondary btn-sm" onClick={() => setShowAdd(true)}>
            + Add Item
          </button>
        )}
      </div>
      <div className="card-body">
        {addState.message && !addState.success && (
          <div className="alert alert-error mb-4">{addState.message}</div>
        )}
        {removeState.message && !removeState.success && (
          <div className="alert alert-error mb-4">{removeState.message}</div>
        )}

        {showAdd && (
          <form action={addAction} className="form-card mb-4" style={{ backgroundColor: "var(--color-bg-alt)" }}>
            <input type="hidden" name="feeScheduleId" value={feeScheduleId} />
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Description</label>
                <input type="text" name="description" className="form-control" required placeholder="e.g. Tuition Fee" />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₱)</label>
                <input type="number" step="0.01" name="amount" className="form-control" required min="0" />
              </div>
            </div>
            <div className="form-group mt-2" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
              <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <input type="checkbox" name="isDiscount" />
                <span>Is Discount (Negative amount)</span>
              </label>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                Order
                <input type="number" name="order" className="form-control" style={{ width: "80px" }} defaultValue="0" />
              </label>
            </div>
            <div className="mt-4" style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" className="btn-primary btn-sm" disabled={addPending}>
                {addPending ? "Adding..." : "Save Item"}
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {items.length === 0 ? (
          <p className="text-muted">No items configured yet.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.order}</td>
                    <td>{item.description}</td>
                    <td>{item.isDiscount ? <span className="badge badge-warning">Discount</span> : <span className="badge badge-secondary">Fee</span>}</td>
                    <td style={{ textAlign: "right", color: item.isDiscount ? "var(--color-error)" : "inherit" }}>
                      {item.isDiscount ? "-" : ""}₱{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <form action={removeAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="feeScheduleId" value={feeScheduleId} />
                        <button type="submit" className="btn-danger btn-sm" disabled={removePending}>
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: "right", fontWeight: "bold" }}>Total Base Amount:</td>
                  <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "1.1rem" }}>
                    ₱{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
