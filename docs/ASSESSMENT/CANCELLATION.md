## ASSESSMENT CANCELLATION


# Complete Cancellation Transaction

    1. Transaction Steps
    2. Verify user role is Admin or Finance.
    3. Verify assessment exists.
    4. Verify assessment status is Posted.
    5. Verify enrollment status is Assessed.
    6. Verify no posted payment exists for the enrollment.
    7. Require cancellation reason.
    8. Mark assessment as Cancelled.
    9. Mark assessment items as Cancelled, or keep them under Cancelled assessment.
    10. Void/reverse assessment ledger entries.
    11. Void/reverse discount ledger entries.
    12. If previous balance was forwarded:
    13. void BalanceForwarding
    14. reverse old enrollment BalanceForwardOut
    15. reverse current enrollment BalanceForwardIn
    16. restore old balance as open
    17. Set discount grants from Applied back to rejected.
    18. Change enrollment status:
    19. Assessed → Pending
    20. Create AssessmentVoidLog.
    21. Commit transaction.

    If any step fails:

    Rollback everything.

    ## No partial cancellation. Partial cancellation is how ledgers become crime scenes.