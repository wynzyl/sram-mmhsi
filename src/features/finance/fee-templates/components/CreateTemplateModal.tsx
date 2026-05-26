"use client";

import { useActionState, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createFeeTemplateAction } from "../fee-templates.actions";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { useFormToast } from "@/hooks/useFormToast";
import { TextInputField } from "@/components/forms/TextInputField";
import { SelectField } from "@/components/forms/SelectField";
import { FEE_ASSESSMENT_BAND_LABELS } from "@/lib/constants/assessment-bands";
import { Button } from "@/components/ui/button";

export function CreateTemplateModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createFeeTemplateAction, {});
  const [name, setName] = useState("");
  const [assessmentBand, setAssessmentBand] = useState("");
  const [description, setDescription] = useState("");

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  useFormToast(state, {
    successMessage: "Fee template created successfully",
    onSuccess: () => {
      if (state.templateId) {
        setTimeout(() => {
          router.push(`/staff/finance/fee-templates/${state.templateId}`);
        }, 500);
      }
    },
  });

  return (
    <>
      <Button onClick={openModal}>Create Template</Button>

      <Modal
        open={open}
        onClose={closeModal}
        aria-labelledby="create-template-title"
      >
        <ModalHeader
          onClose={closeModal}
          kicker="Finance · Fee Management"
          subtitle="Define a reusable fee structure for an assessment band."
        >
          <h2 id="create-template-title">Create Fee Template</h2>
        </ModalHeader>

        <ModalBody>
          <form action={action} className="flex flex-col gap-4">
                  <TextInputField
                    label="Template Name"
                    name="name"
                    required
                    value={name}
                    onChange={setName}
                    placeholder="e.g., Standard Casa Fees 2026+"
                    error={state.errors?.name}
                  />

                  <SelectField
                    label="Assessment Band"
                    name="assessmentBand"
                    required
                    value={assessmentBand}
                    onChange={setAssessmentBand}
                    options={[
                      { value: "", label: "Select assessment band..." },
                      ...Object.entries(FEE_ASSESSMENT_BAND_LABELS).map(
                        ([value, label]) => ({ value, label })
                      ),
                    ]}
                    error={state.errors?.assessmentBand}
                  />

                  <div className="form-group">
                    <label htmlFor="description" className="form-label">
                      Description{" "}
                      <span className="text-gray-400 dark:text-gray-500 font-normal">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="form-control"
                      placeholder="Add any notes about this template…"
                    />
                    {state.errors?.description && (
                      <p className="form-error">{state.errors.description[0]}</p>
                    )}
                  </div>

                  {/* Next steps hint */}
                  <div className="flex gap-3 p-4 bg-muted border border-border rounded-md">
                    <div className="shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground" aria-hidden>📋</div>
                    <div>
                      <p className="text-[0.8125rem] font-semibold text-foreground">Next steps after creating</p>
                      <ol className="m-0 pl-5 text-[0.8125rem] text-muted-foreground list-decimal">
                        <li>Add fee items (tuition, materials, discounts) to the template</li>
                        <li>Assign the template to a school year under Fee Schedules</li>
                        <li>Optionally add year-specific overrides when amounts change</li>
                      </ol>
                    </div>
                  </div>

            <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-border">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create Template"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    </>
  );
}
