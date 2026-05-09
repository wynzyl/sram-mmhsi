import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

type SendInvoiceEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

export async function sendInvoiceEmail({ to, subject, html }: SendInvoiceEmailOptions) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    if (process.env.NODE_ENV === "development") {
      console.warn("⚠️ GMAIL_USER or GMAIL_APP_PASSWORD is not set.");
      console.log("📨 Mocking email send to:", to);
      console.log("📝 Subject:", subject);
      // Mock delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true, message: "Mock email sent successfully (check console)" };
    } else {
      throw new Error("Email configuration is missing in production.");
    }
  }

  try {
    const info = await transporter.sendMail({
      from: `"SRAMS Finance" <${GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return { success: true, message: `Email sent: ${info.messageId}` };
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new Error("Failed to send invoice email.");
  }
}
