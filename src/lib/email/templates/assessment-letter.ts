import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

export type AssessmentLetterParams = {
  invoiceNumber: string;
  studentName: string;
  studentReferenceNumber: string;
  amountDue: string | number;
  date?: Date;
};

export function generateAssessmentLetterHtml({
  invoiceNumber,
  studentName,
  studentReferenceNumber,
  amountDue,
  date = new Date(),
}: AssessmentLetterParams): string {
  const invoiceDisplay = invoiceNumber.replace(/^INV-/, "");

  const formattedDate = formatDate(date, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const formattedAmount = formatCurrency(amountDue);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Assessment Invoice</title>
</head>
<body style="margin:0;padding:0;background:#f0ede8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0"
               style="max-width:640px;width:100%;background:#ffffff;
                      font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;
                      border:1px solid #d9d3cb;">

          <!-- TOP ACCENT BAR -->
          <tr>
            <td style="background:#c70000;height:6px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- LETTERHEAD -->
          <tr>
            <td style="padding:36px 48px 0 48px;text-align:center;">
              <div style="font-size:19px;font-weight:bold;color:#c70000;
                          letter-spacing:0.5px;line-height:1.35;text-transform:uppercase;">
                Merryland Montesorri and High School Inc.
              </div>
              <div style="font-size:12px;color:#666666;margin-top:5px;letter-spacing:0.3px;">
                San Vicente, Urdaneta, Pangasinan
              </div>
            </td>
          </tr>

          <!-- RED RULE -->
          <tr>
            <td style="padding:16px 48px 0 48px;">
              <div style="border-bottom:1.5px solid #c70000;"></div>
            </td>
          </tr>

          <!-- DATE / INVOICE ROW -->
          <tr>
            <td style="padding:18px 48px 0 48px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:left;font-size:12.5px;color:#333333;font-family:Georgia,'Times New Roman',serif;">
                    Invoice No.:&nbsp;<strong>${invoiceDisplay}</strong>
                  </td>
                  <td style="text-align:right;font-size:12.5px;color:#333333;font-family:Georgia,'Times New Roman',serif;">
                    Date:&nbsp;<strong>${formattedDate}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- TITLE -->
          <tr>
            <td style="padding:28px 48px 24px 48px;text-align:center;">
              <span style="font-size:15px;font-weight:bold;letter-spacing:3px;
                           text-transform:uppercase;color:#1a1a1a;
                           font-family:Georgia,'Times New Roman',serif;">
                Assessment Invoice
              </span>
            </td>
          </tr>

          <!-- THIN RULE BELOW TITLE -->
          <tr>
            <td style="padding:0 48px 24px 48px;">
              <div style="border-bottom:1px solid #e0dbd4;"></div>
            </td>
          </tr>

          <!-- SALUTATION -->
          <tr>
            <td style="padding:0 48px 10px 48px;font-size:14px;line-height:1.7;
                       font-family:Georgia,'Times New Roman',serif;">
              Dear Parent/Guardian,
            </td>
          </tr>

          <!-- INTRO -->
          <tr>
            <td style="padding:0 48px 20px 48px;font-size:14px;line-height:1.75;
                       font-family:Georgia,'Times New Roman',serif;color:#2a2a2a;">
              This is to inform you that the following student has been assessed
              for the amount due stated below:
            </td>
          </tr>

          <!-- STUDENT DETAILS BOX -->
          <tr>
            <td style="padding:0 48px 20px 48px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border-left:3px solid #c70000;background:#faf8f5;">
                <tr>
                  <td style="padding:16px 20px;font-size:13.5px;line-height:2.1;
                             font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
                    <strong>Student Name:</strong>&nbsp;${studentName}<br />
                    <strong>Student Reference No.:</strong>&nbsp;${studentReferenceNumber}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- AMOUNT DUE -->
          <tr>
            <td style="padding:0 48px 24px 48px;font-size:14px;line-height:1.7;
                       font-family:Georgia,'Times New Roman',serif;">
              <strong>Amount Due:</strong>&nbsp;
              <span style="font-size:20px;font-weight:bold;color:#c70000;
                           font-family:Georgia,'Times New Roman',serif;">
                ${formattedAmount}
              </span>
            </td>
          </tr>

          <!-- PAYMENT INSTRUCTION -->
          <tr>
            <td style="padding:0 48px 18px 48px;font-size:14px;line-height:1.75;
                       font-family:Georgia,'Times New Roman',serif;color:#2a2a2a;">
              Please settle the above amount at the cashier&#39;s office. Kindly
              present this assessment invoice upon payment for proper verification
              and issuance of official receipt.
            </td>
          </tr>

          <!-- THANK YOU -->
          <tr>
            <td style="padding:0 48px 32px 48px;font-size:14px;line-height:1.7;
                       font-family:Georgia,'Times New Roman',serif;">
              Thank you.
            </td>
          </tr>

          <!-- CLOSING / SIGNATURE -->
          <tr>
            <td style="padding:0 48px 40px 48px;font-size:14px;line-height:1.8;
                       font-family:Georgia,'Times New Roman',serif;">
              Respectfully,<br /><br />
              <strong>Merryland Montesorri</strong><br />
              Accounting / Cashier Department
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:16px 48px 24px 48px;border-top:1px solid #e0dbd4;
                       font-size:11px;color:#999999;text-align:center;
                       font-family:Arial,sans-serif;letter-spacing:0.2px;">
              This is an official assessment invoice from SRAMS.
              Please do not reply directly to this email.
            </td>
          </tr>

          <!-- BOTTOM ACCENT BAR -->
          <tr>
            <td style="background:#c70000;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
