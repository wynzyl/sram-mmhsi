To implement the **Official Receipt (OR) Booklet management** system you described, we must integrate it directly into the **Payment Posting Workflow (Workflow 4\)** and the **Data Model Procedure** defined in the SRAMS Engineering Blueprint.  
Based on the sources, here is how this feature should be structured to maintain the system's integrity:

### 1\. Integration into Workflow 4 (Payment Posting)

The consumption of OR numbers from a booklet becomes a mandatory **Precondition** for the Cashier 1\.

* **Booklet Selection:** The Cashier must select the "active" booklet (e.g., AP 00001-00050) before posting payments 1\.  
* **Automatic Consumption:** When a payment is **posted**, the system must automatically assign the next available sequential number (e.g., AP 00001\) to the transaction 1\.  
* **Validation Rules:** The system must validate that the OR number is not already "consumed" or "voided" before finalizing the post 1\.

### 2\. Data Model & Entity Updates

To support this, the **Entity List** must be expanded to include booklet management while adhering to the **Unique Constraints** rule 2\.

* **New Entity \- receipt\_booklets:** This will store the series (e.g., AP), start number, end number, and the current "next available" pointer.  
* **Unique Constraint:** Each OR number must be unique within the system to ensure **financial record integrity** 2, 3\.  
* **Status Transitions:** Just as student records have lifecycle states, booklets and individual ORs should track states: available, consumed, or voided 2\.

### 3\. Auditable Financial Posting

Since one of the core goals is to provide **auditable financial posting**, the handling of these booklets must be strictly logged 4\.

* **Mandatory Audit Events:** Every time a booklet is started, an OR is consumed, or a booklet is marked as "exhausted," an **Audit Event** must be triggered 5\.  
* **Traceability:** The audit dimensions must capture the **Actor (Cashier)**, the **Timestamp**, and the **Previous/New state** of the booklet's sequence 6\.  
* **Voiding Logic:** If a payment is voided, the OR number associated with it must remain "consumed" or be marked as "voided" to maintain an immutable history; it should not be returned to the pool for re-use 1, 2\.

### 4\. UI/UX for High-Volume Flows

The Cashier interface must remain "dense" and "low-friction" 7\.

* **Information Density:** The system should display the "Current Active Booklet" and the "Next OR Number" prominently on the payment screen so the Cashier doesn't have to navigate away to verify the sequence 7, 8\.  
* **Automation:** To minimize clicks, the system should automatically "consume the next available booklet" once the current series is exhausted, provided the next booklet has been pre-loaded by an Admin or Finance Officer 8, 9\.

### 5\. Role-Based Access Control (RBAC)

* **Cashier:** Can select and consume ORs during the payment workflow 9\.  
* **Finance Officer/Admin:** Responsible for the **setup of booklets** and the initial entry of OR ranges into the system 9\.  
* **Security:** To prevent fraud, the "Action Guard Layer" must ensure that a Cashier cannot manually skip or alter the OR sequence unless they have specific override permissions 10\.

### Enrollment cancellation and refunds

SRAMS does not model refunds as separate negative payments. After tuition has been posted, reversing money on the ledger is done by **voiding** the posted payment(s) from the assessment ledger (OR remains non-reusable per void rules above). **Cancelling** an enrollment closes that enrollment’s assessment ledger for **new** cashier posts and should normally happen only after posted amounts are voided when that matches finance policy. Registrar roles must void first when the ledger still shows collections; administrators holding `enrollments:cancel_with_balance` may cancel with a mandatory long audit remark—this is an exception trail, not a substitute for proper voiding where accounting requires it.

