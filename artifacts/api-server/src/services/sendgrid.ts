import { ReplitConnectors } from "@replit/connectors-sdk";
import type { ApplicationRecord } from "@workspace/db";

type DeliveryAttempt = {
  accepted: boolean;
  statusCode: number | null;
};

export type ApplicationEmailDelivery = {
  notificationStatus: "configured" | "not_configured" | "failed";
  founderAlertStatus: "sent" | "not_configured" | "failed";
  applicantStatusCode: number | null;
  founderStatusCode: number | null;
};

function configuredEmail(key: string): string | null {
  const value = process.env[key]?.trim();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

export function getEmailSetupStatus() {
  const fromEmail = configuredEmail("SENDGRID_FROM_EMAIL");
  const founderEmail = configuredEmail("FOUNDER_NOTIFICATION_EMAIL");
  return {
    emailNotifications: Boolean(fromEmail),
    founderAlerts: Boolean(fromEmail && founderEmail),
  };
}

async function sendTextEmail(
  fromEmail: string,
  toEmail: string,
  subject: string,
  text: string,
): Promise<DeliveryAttempt> {
  try {
    const response = await new ReplitConnectors().proxy(
      "sendgrid",
      "/v3/mail/send",
      {
        method: "POST",
        body: {
          personalizations: [{ to: [{ email: toEmail }] }],
          from: { email: fromEmail, name: "ALPHA SQUAD" },
          subject,
          content: [{ type: "text/plain", value: text }],
          tracking_settings: {
            click_tracking: { enable: false, enable_text: false },
            open_tracking: { enable: false },
            subscription_tracking: { enable: false },
          },
        },
      },
    );
    return { accepted: response.ok, statusCode: response.status };
  } catch {
    return { accepted: false, statusCode: null };
  }
}

export async function sendApplicationEmails(
  application: Pick<ApplicationRecord, "fullName" | "email" | "primaryRole" | "reference">,
): Promise<ApplicationEmailDelivery> {
  const fromEmail = configuredEmail("SENDGRID_FROM_EMAIL");
  const founderEmail = configuredEmail("FOUNDER_NOTIFICATION_EMAIL");

  if (!fromEmail) {
    return {
      notificationStatus: "not_configured",
      founderAlertStatus: "not_configured",
      applicantStatusCode: null,
      founderStatusCode: null,
    };
  }

  const [applicantAttempt, founderAttempt] = await Promise.all([
    sendTextEmail(
      fromEmail,
      application.email,
      "We received your ALPHA SQUAD application",
      [
        `Hi ${application.fullName},`,
        "",
        `We received your application for ${application.primaryRole}.`,
        `Your application reference is ${application.reference}. Keep it for your records.`,
        "",
        "This message confirms receipt only; it is not a selection decision. To withdraw or request deletion, return to the site and use “Withdraw or delete data” in the footer.",
        "",
        "ALPHA SQUAD",
      ].join("\n"),
    ),
    founderEmail
      ? sendTextEmail(
          fromEmail,
          founderEmail,
          "New ALPHA SQUAD application",
          [
            "A new application is ready for review.",
            `Candidate: ${application.fullName}`,
            `Primary role: ${application.primaryRole}`,
            `Reference: ${application.reference}`,
            "",
            "Sign in to the founder console and search by reference to review the application.",
          ].join("\n"),
        )
      : Promise.resolve({ accepted: false, statusCode: null }),
  ]);

  return {
    notificationStatus: applicantAttempt.accepted
      ? "configured"
      : "failed",
    founderAlertStatus: !founderEmail
      ? "not_configured"
      : founderAttempt.accepted
        ? "sent"
        : "failed",
    applicantStatusCode: applicantAttempt.statusCode,
    founderStatusCode: founderAttempt.statusCode,
  };
}
