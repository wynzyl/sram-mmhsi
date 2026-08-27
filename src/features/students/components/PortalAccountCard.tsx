"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFormToast } from "@/hooks/useFormToast";
import {
  createPortalAccountAction,
  resetPortalPasswordAction,
  togglePortalAccountStatusAction,
} from "@/features/portal-accounts/portal-accounts.actions";
import type { PortalAccountInfo } from "@/features/portal-accounts/portal-accounts.schema";
import { formatDateTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import {
  UserCircle2,
  Key,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Clock,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
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

interface PortalAccountCardProps {
  studentId: string;
  referenceNumber: string;
  account: PortalAccountInfo | null;
  /** Whether the current user can manage portal accounts */
  canManage: boolean;
}

export function PortalAccountCard({
  studentId,
  referenceNumber,
  account,
  canManage,
}: PortalAccountCardProps) {
  // Create account action
  const [createState, createAction, isCreating] = useActionState(
    createPortalAccountAction,
    {}
  );

  // Reset password action
  const [resetState, resetAction, isResetting] = useActionState(
    resetPortalPasswordAction,
    {}
  );

  // Toggle status action
  const [toggleState, toggleAction, isToggling] = useActionState(
    togglePortalAccountStatusAction,
    {}
  );

  // Show toast for form-level success/errors
  useFormToast(createState, {
    successMessage: "Portal account created successfully",
  });
  useFormToast(resetState, {
    successMessage: "Password reset successfully",
  });
  useFormToast(toggleState, {
    successMessage: account?.isActive
      ? "Account deactivated"
      : "Account activated",
  });

  // Password display modal
  const [showPassword, setShowPassword] = useState(false);
  const [displayedPassword, setDisplayedPassword] = useState<string | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  // Track which password we've already shown to prevent re-showing
  const shownPasswordRef = useRef<string | null>(null);

  // Show password modal when create/reset succeeds (only once per password)
  useEffect(() => {
    if (createState.success && createState.initialPassword) {
      if (shownPasswordRef.current !== createState.initialPassword) {
        shownPasswordRef.current = createState.initialPassword;
        setDisplayedPassword(createState.initialPassword);
        setShowPassword(true);
      }
    }
  }, [createState.success, createState.initialPassword]);

  useEffect(() => {
    if (resetState.success && resetState.newPassword) {
      if (shownPasswordRef.current !== resetState.newPassword) {
        shownPasswordRef.current = resetState.newPassword;
        setDisplayedPassword(resetState.newPassword);
        setShowPassword(true);
      }
    }
  }, [resetState.success, resetState.newPassword]);

  const handleCopyPassword = async () => {
    if (displayedPassword) {
      await navigator.clipboard.writeText(displayedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClosePasswordModal = () => {
    setShowPassword(false);
    setDisplayedPassword(null);
    // Don't clear shownPasswordRef - this prevents reopening for the same password
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCircle2 className="h-4 w-4" />
              Portal Account
            </CardTitle>
            {account && (
              <Badge variant={account.isActive ? "success" : "secondary"}>
                {account.isActive ? "Active" : "Inactive"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!account ? (
            // No account exists
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 p-4 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No portal account exists for this student.
                </p>
                {canManage && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create an account to allow self-service portal access.
                  </p>
                )}
              </div>

              {canManage && (
                <form action={createAction}>
                  <input type="hidden" name="studentId" value={studentId} />
                  <Button
                    type="submit"
                    disabled={isCreating}
                    className="w-full"
                  >
                    {isCreating ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Key className="mr-2 h-4 w-4" />
                        Create Portal Account
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          ) : (
            // Account exists
            <div className="space-y-4">
              {/* Account Info */}
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Username
                  </span>
                  <span className="font-mono text-sm font-medium">
                    {account.username}
                  </span>
                </div>

                {account.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="text-sm">{account.email}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Last Login
                  </span>
                  <span className="text-sm">
                    {account.lastLoginAt ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(account.lastLoginAt)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </span>
                </div>

                {account.forcePasswordChange && (
                  <div className="mt-2 flex items-center gap-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                    <AlertCircle className="h-3 w-3" />
                    Password change required on next login
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {canManage && (
                <div className="flex flex-col gap-2">
                  {/* Reset Password */}
                  <form action={resetAction}>
                    <input
                      type="hidden"
                      name="portalAccountId"
                      value={account.id}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={isResetting}
                      className="w-full"
                    >
                      {isResetting ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <Key className="mr-2 h-4 w-4" />
                          Reset Password
                        </>
                      )}
                    </Button>
                  </form>

                  {/* Toggle Status */}
                  <form action={toggleAction}>
                    <input
                      type="hidden"
                      name="portalAccountId"
                      value={account.id}
                    />
                    <input
                      type="hidden"
                      name="isActive"
                      value={(!account.isActive).toString()}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={isToggling}
                      className={cn(
                        "w-full",
                        account.isActive
                          ? "text-destructive hover:bg-destructive/10"
                          : "text-success hover:bg-success/10"
                      )}
                    >
                      {isToggling ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : account.isActive ? (
                        <>
                          <ShieldX className="mr-2 h-4 w-4" />
                          Deactivate Account
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Activate Account
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Display Modal */}
      <AlertDialog open={showPassword} onOpenChange={setShowPassword}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Portal Account Password</AlertDialogTitle>
            <AlertDialogDescription>
              Please share this password with the student. They will be required
              to change it on first login.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-4 space-y-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Username</p>
              <p className="font-mono font-medium">{referenceNumber}</p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Password</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-lg">
                  {displayedPassword}
                </code>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleCopyPassword}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              The password is the student&apos;s date of birth in YYYYMMDD
              format. If no DOB is on file, a fallback format is used.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction onClick={handleClosePasswordModal}>
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
