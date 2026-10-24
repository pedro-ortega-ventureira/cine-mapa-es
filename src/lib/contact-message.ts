import { z } from "zod";

export const contactMessageInputSchema = z
  .object({
    request_id: z.string().uuid(),
    professional_id: z.string().uuid(),
    sender_name: z.string().trim().min(1).max(100),
    sender_email: z.string().trim().toLowerCase().email().max(254),
    subject: z.string().trim().max(160),
    message: z.string().trim().min(1).max(5_000),
    website: z.string().trim().max(2_000),
  })
  .strict();

export type ContactMessageInput = z.infer<typeof contactMessageInputSchema>;

export interface ContactEmailConfig {
  to: string;
  from: string;
}

export interface ContactEmailPayload extends ContactEmailConfig {
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}

export function normalizeContactInput(input: ContactMessageInput): ContactMessageInput {
  return {
    request_id: input.request_id,
    professional_id: input.professional_id,
    sender_name: input.sender_name.trim(),
    sender_email: input.sender_email.trim().toLowerCase(),
    subject: input.subject.trim(),
    message: input.message.trim(),
    website: input.website.trim(),
  };
}

function stripHeaderBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildContactEmail(
  rawInput: ContactMessageInput,
  professionalName: string,
  config: ContactEmailConfig,
  submittedAt: Date,
): ContactEmailPayload {
  const input = normalizeContactInput(rawInput);
  const safeProfessionalName = stripHeaderBreaks(professionalName) || "Profesional";
  const safeSubject = stripHeaderBreaks(input.subject) || "Sin asunto";
  const submittedAtIso = submittedAt.toISOString();

  const text = [
    `Profesional: ${safeProfessionalName}`,
    `Nombre: ${input.sender_name}`,
    `Email: ${input.sender_email}`,
    `Fecha: ${submittedAtIso}`,
    `Asunto: ${safeSubject}`,
    "",
    input.message,
  ].join("\n");

  const html = [
    "<h1>Nuevo contacto desde el directorio audiovisual</h1>",
    `<p><strong>Profesional:</strong> ${escapeHtml(safeProfessionalName)}</p>`,
    `<p><strong>Nombre:</strong> ${escapeHtml(input.sender_name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(input.sender_email)}</p>`,
    `<p><strong>Fecha:</strong> ${escapeHtml(submittedAtIso)}</p>`,
    `<p><strong>Asunto:</strong> ${escapeHtml(safeSubject)}</p>`,
    `<p style="white-space: pre-wrap">${escapeHtml(input.message)}</p>`,
  ].join("\n");

  return {
    from: config.from,
    to: config.to,
    replyTo: input.sender_email,
    subject: `[Directorio] Contacto para ${safeProfessionalName}: ${safeSubject}`,
    text,
    html,
  };
}

export function contactIdempotencyKey(requestId: string): string {
  return `contact-message/${requestId}`;
}
