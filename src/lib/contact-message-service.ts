import {
  buildContactEmail,
  CONTACT_UNAVAILABLE_MESSAGE,
  contactIdempotencyKey,
  normalizeProfessionalContactEmail,
  normalizeContactInput,
  type ContactEmailConfig,
  type ContactEmailPayload,
  type ContactMessageInput,
} from "./contact-message";

export type ContactRecord = Omit<ContactMessageInput, "website">;

export interface StoredContact extends ContactRecord {
  created_at: string;
  email_payload: ContactEmailPayload;
  email_id: string | null;
}

export interface ContactProfessional {
  id: string;
  fullName: string;
  email: string | null;
  verified: boolean;
}

export type ContactReservationStatus =
  | "new"
  | "duplicate_same"
  | "conflict"
  | "rate_limited";

export interface ContactReservation {
  status: ContactReservationStatus;
  contact: StoredContact | null;
}

export interface ContactRepository {
  getProfessional(professionalId: string): Promise<ContactProfessional | null>;
  reserve(contact: StoredContact, since: Date): Promise<ContactReservation>;
  markDelivered(requestId: string, emailId: string, acceptedAt: Date): Promise<void>;
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
  const recipient = normalizeProfessionalContactEmail(professional.email);
  if (!recipient) {
    throw new Error(CONTACT_UNAVAILABLE_MESSAGE);
  }

  const candidate: StoredContact = {
    ...toRecord(input),
    created_at: now.toISOString(),
    email_payload: buildContactEmail(
      input,
      professional.fullName,
      recipient,
      deps.emailConfig,
      now,
    ),
    email_id: null,
  };
  const since = new Date(now.getTime() - 30 * 60 * 1_000);
  const reservation = await deps.repository.reserve(candidate, since);

  if (reservation.status === "conflict") {
    throw new Error("El identificador de la solicitud ya está en uso");
  }
  if (reservation.status === "rate_limited") {
    throw new Error("Has enviado demasiados mensajes. Inténtalo más tarde");
  }
  if (!reservation.contact) {
    throw new Error("No se pudo reservar el mensaje de contacto");
  }
  if (reservation.contact.email_id) {
    return {
      ok: true,
      contactId: input.request_id,
      emailId: reservation.contact.email_id,
    };
  }

  const sent = await deps.emailSender.send(
    reservation.contact.email_payload,
    contactIdempotencyKey(input.request_id),
  );
  await deps.repository.markDelivered(input.request_id, sent.id, now);
  return { ok: true, contactId: input.request_id, emailId: sent.id };
}
