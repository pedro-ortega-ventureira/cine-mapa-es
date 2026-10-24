import {
  buildContactEmail,
  contactIdempotencyKey,
  normalizeContactInput,
  type ContactEmailConfig,
  type ContactEmailPayload,
  type ContactMessageInput,
} from "./contact-message";

export type ContactRecord = Omit<ContactMessageInput, "website">;

export interface ContactProfessional {
  id: string;
  fullName: string;
  verified: boolean;
}

export type ContactSaveStatus = "new" | "duplicate_same" | "conflict";

export interface ContactRepository {
  getProfessional(professionalId: string): Promise<ContactProfessional | null>;
  getById(requestId: string): Promise<ContactRecord | null>;
  countRecentByEmail(senderEmail: string, since: Date): Promise<number>;
  save(contact: ContactRecord): Promise<ContactSaveStatus>;
}

export interface ContactEmailSender {
  send(payload: ContactEmailPayload, idempotencyKey: string): Promise<{ id: string }>;
}

export interface ContactDeliveryDeps {
  repository: ContactRepository;
  emailSender: ContactEmailSender;
  emailConfig: ContactEmailConfig;
  now?: () => Date;
}

export interface ContactDeliveryResult {
  ok: true;
  contactId: string;
  emailId: string | null;
}

function toRecord(input: ContactMessageInput): ContactRecord {
  return {
    request_id: input.request_id,
    professional_id: input.professional_id,
    sender_name: input.sender_name,
    sender_email: input.sender_email,
    subject: input.subject,
    message: input.message,
  };
}

function recordsMatch(left: ContactRecord, right: ContactRecord): boolean {
  return (
    left.request_id === right.request_id &&
    left.professional_id === right.professional_id &&
    left.sender_name === right.sender_name &&
    left.sender_email === right.sender_email &&
    left.subject === right.subject &&
    left.message === right.message
  );
}

export async function deliverContactMessage(
  rawInput: ContactMessageInput,
  deps: ContactDeliveryDeps,
): Promise<ContactDeliveryResult> {
  const input = normalizeContactInput(rawInput);
  if (input.website) {
    return { ok: true, contactId: input.request_id, emailId: null };
  }

  const now = deps.now?.() ?? new Date();
  const professional = await deps.repository.getProfessional(input.professional_id);
  if (!professional?.verified) {
    throw new Error("El profesional no está disponible para recibir contactos");
  }

  const contact = toRecord(input);
  const existing = await deps.repository.getById(input.request_id);
  if (existing) {
    if (!recordsMatch(existing, contact)) {
      throw new Error("El identificador de la solicitud ya está en uso");
    }
  } else {
    const since = new Date(now.getTime() - 30 * 60 * 1_000);
    const recentCount = await deps.repository.countRecentByEmail(input.sender_email, since);
    if (recentCount >= 5) {
      throw new Error("Has enviado demasiados mensajes. Inténtalo más tarde");
    }

    const status = await deps.repository.save(contact);
    if (status === "conflict") {
      throw new Error("El identificador de la solicitud ya está en uso");
    }
  }

  const payload = buildContactEmail(input, professional.fullName, deps.emailConfig, now);
  const sent = await deps.emailSender.send(payload, contactIdempotencyKey(input.request_id));

  return { ok: true, contactId: input.request_id, emailId: sent.id };
}
