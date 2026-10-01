/**
 * Order confirmation email via the Mailgun REST API (TRD section 16).
 *
 * Server-only. The API key is read from server-only environment variables and
 * is never sent to the browser (AGENTS.md section 6).
 *
 * Failure policy (TRD section 16, AGENTS.md section 8)
 * ---------------------------------------------------
 * A Mailgun failure must NOT invalidate a created order. This module therefore
 * never throws: it returns a result and lets the caller log the failure and
 * carry on. A second order is never created because an email failed.
 */

import {
  BANK_TRANSFER,
  PAYMENT_METHOD,
  paymentMethodLabel,
  SHOP,
} from "@/lib/config/business";
import { getMailgunEnv } from "@/lib/env";
import { formatNaira, lineTotal } from "@/lib/format";
import type { OrderWithItems } from "@/lib/orders";

export type SendResult =
  { sent: true; messageId: string } | { sent: false; error: string };

export type SendOptions = {
  /** Mailgun processes the message but does not deliver it. For testing. */
  testMode?: boolean;
};

/** Mailgun's HTTP basic-auth username is always the literal `api`. */
const MAILGUN_AUTH_USER = "api";

/** Escapes customer-supplied text before it goes into the HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function subjectFor(order: OrderWithItems): string {
  return `${SHOP.name}: order ${order.order_number} confirmed`;
}

function textBody(order: OrderWithItems): string {
  const lines: string[] = [];

  lines.push(`${SHOP.name} — order confirmation`);
  lines.push("");
  lines.push(`Order number: ${order.order_number}`);
  lines.push(`Thank you, ${order.customer_name}.`);
  lines.push("");
  lines.push("Items");

  for (const item of order.items) {
    lines.push(
      `- ${item.productName} (${item.variantLabel}) x ${item.quantity} @ ${formatNaira(item.unitPrice)} = ${formatNaira(lineTotal(item.unitPrice, item.quantity))}`,
    );
  }

  lines.push("");
  lines.push(`Subtotal: ${formatNaira(order.subtotal)}`);
  lines.push(`Delivery fee: ${formatNaira(order.delivery_fee)}`);
  lines.push(`Total: ${formatNaira(order.total)}`);
  lines.push("");
  lines.push("Delivery address");
  lines.push(`${order.customer_name} · ${order.customer_phone}`);
  lines.push(order.delivery_address);
  lines.push("");
  lines.push(`Payment: ${paymentMethodLabel(order.payment_method)}`);

  // Bank details are included so the customer has them in the same message.
  // The order remains unpaid until an admin verifies the transfer by hand.
  if (order.payment_method === PAYMENT_METHOD.bankTransfer) {
    lines.push("");
    lines.push("Transfer to");
    lines.push(`Bank: ${BANK_TRANSFER.bankName}`);
    lines.push(`Account name: ${BANK_TRANSFER.accountName}`);
    lines.push(`Account number: ${BANK_TRANSFER.accountNumber}`);
    lines.push(
      `Use ${order.order_number} as the transfer reference. We confirm receipt before dispatch.`,
    );
  }

  if (order.note) {
    lines.push("");
    lines.push(`Your note: ${order.note}`);
  }

  lines.push("");
  lines.push(
    `Questions? Contact ${SHOP.name} on ${SHOP.phone} or ${SHOP.email}.`,
  );

  return lines.join("\n");
}

/**
 * A simple, responsive HTML body. No CSS framework and no external images, so
 * it renders acceptably in clients that block remote content.
 */
function htmlBody(order: OrderWithItems): string {
  const rows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e5e5e5;">
          ${escapeHtml(item.productName)}<br />
          <span style="color:#666;font-size:13px;">
            ${escapeHtml(item.variantLabel)} &times; ${item.quantity}
          </span>
        </td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid #e5e5e5;">
          ${escapeHtml(formatNaira(item.unitPrice))}<br />
          <span style="color:#666;font-size:13px;">
            ${escapeHtml(formatNaira(lineTotal(item.unitPrice, item.quantity)))}
          </span>
        </td>
      </tr>`,
    )
    .join("");

  const note = order.note
    ? `<p style="margin:16px 0 0;"><strong>Your note:</strong> ${escapeHtml(order.note)}</p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:16px;background:#fafafa;font-family:Arial,Helvetica,sans-serif;color:#171717;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;padding:24px;border-radius:8px;">
      <h1 style="margin:0 0 4px;font-size:20px;">${escapeHtml(SHOP.name)}</h1>
      <p style="margin:0 0 20px;color:#666;">
        Order <strong>${escapeHtml(order.order_number)}</strong> confirmed
      </p>

      <p style="margin:0 0 16px;">Thank you, ${escapeHtml(order.customer_name)}.</p>

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:16px;font-size:14px;">
        <tr>
          <td style="padding:2px 0;color:#666;">Subtotal</td>
          <td align="right" style="padding:2px 0;">${escapeHtml(formatNaira(order.subtotal))}</td>
        </tr>
        <tr>
          <td style="padding:2px 0;color:#666;">Delivery fee</td>
          <td align="right" style="padding:2px 0;">${escapeHtml(formatNaira(order.delivery_fee))}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-top:1px solid #e5e5e5;font-weight:bold;">Total</td>
          <td align="right" style="padding:6px 0;border-top:1px solid #e5e5e5;font-weight:bold;">
            ${escapeHtml(formatNaira(order.total))}
          </td>
        </tr>
      </table>

      <p style="margin:20px 0 0;font-size:14px;">
        <strong>Payment:</strong> ${escapeHtml(paymentMethodLabel(order.payment_method))}
      </p>

      ${
        order.payment_method === PAYMENT_METHOD.bankTransfer
          ? `
      <p style="margin:16px 0 0;font-size:14px;">
        <strong>Transfer to</strong><br />
        Bank: ${escapeHtml(BANK_TRANSFER.bankName)}<br />
        Account name: ${escapeHtml(BANK_TRANSFER.accountName)}<br />
        Account number: ${escapeHtml(BANK_TRANSFER.accountNumber)}
      </p>
      <p style="margin:16px 0 0;font-size:13px;color:#555;">
        Use ${escapeHtml(order.order_number)} as the transfer reference. We
        confirm receipt before dispatch, and your order stays unpaid until we do.
      </p>`
          : ""
      }

      <p style="margin:16px 0 0;font-size:14px;">
        <strong>Delivering to</strong><br />
        ${escapeHtml(order.customer_name)} &middot; ${escapeHtml(order.customer_phone)}<br />
        ${escapeHtml(order.delivery_address)}
      </p>

      ${note}

      <p style="margin:24px 0 0;font-size:12px;color:#666;">
        Questions? Contact ${escapeHtml(SHOP.name)} on
        ${escapeHtml(SHOP.phone)} or ${escapeHtml(SHOP.email)}.
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Sends the order confirmation email.
 *
 * @param order the persisted order, including its item snapshots, so the email
 * reflects exactly what was stored rather than what was intended.
 * @param recipient defaults to the address recorded on the order.
 *
 * @returns `{ sent: true, messageId }` or `{ sent: false, error }`. This never
 * throws and never rejects, so the caller cannot accidentally fail an order
 * because of email.
 */
export async function sendOrderConfirmationEmail(
  order: OrderWithItems,
  recipient: string = order.customer_email,
  options: SendOptions = {},
): Promise<SendResult> {
  let config: ReturnType<typeof getMailgunEnv>;
  let endpoint: string;

  try {
    config = getMailgunEnv();
    endpoint = `${config.MAILGUN_BASE_URL}/v3/${encodeURIComponent(config.MAILGUN_DOMAIN)}/messages`;
  } catch (error) {
    // Misconfiguration is reported, not thrown.
    return {
      sent: false,
      error:
        error instanceof Error ? error.message : "Mailgun is not configured.",
    };
  }

  const body = new URLSearchParams({
    // The friendly-name form is supported by Mailgun and gives a branded sender.
    from: `${SHOP.name} <${config.MAILGUN_FROM_EMAIL}>`,
    to: recipient,
    subject: subjectFor(order),
    text: textBody(order),
    html: htmlBody(order),
    // Tagging makes these messages easy to find in the Mailgun dashboard.
    "o:tag": ["order-confirmation"].join(","),
  });

  if (options.testMode) {
    body.set("o:testmode", "yes");
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      // Basic auth: username is always `api`, password is the private key.
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${MAILGUN_AUTH_USER}:${config.MAILGUN_API_KEY}`,
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      // Do not hang a checkout on a slow mail provider.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // The response body can echo the address but never the API key.
      const detail = (await response.text()).slice(0, 300);
      return {
        sent: false,
        error: `Mailgun responded ${response.status}: ${detail}`,
      };
    }

    const payload = (await response.json()) as { id?: string };
    return { sent: true, messageId: payload.id ?? "unknown" };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown Mailgun error.",
    };
  }
}
