import { Resend } from "resend";
import type { ContactEmailConfig, ContactEmailPayload } from "./contact-message";
import type {
  ContactEmailSender,
  ContactProfessional,
  ContactRepository,
  ContactReservation,
} from "./contact-message-service";

type ContactEnvironment = Record<string, string | undefined>;

export interface ContactEmailServerConfig {
  apiKey: string;
  emailConfig: ContactEmailConfig;
}

type QueryResult<T> = { data: T | null; error: { code?: string; message: string } | null };

interface ContactDatabase {
  from(table: "professionals" | "contact_messages"): any;
  rpc(name: "reserve_contact_message", args: Record<string, unknown>): Promise<QueryResult<unknown>>;
}

interface ResendClient {
  emails: {
    send(
      payload: ContactEmailPayload,
      options: { idempotencyKey: string },
    ): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
  };
}

function requiredEnvironmentValue(env: ContactEnvironment, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required contact email environment variable: ${name}`);
  return value;
}

export function readContactEmailConfig(env: ContactEnvironment = process.env): ContactEmailServerConfig {
  return {
    apiKey: requiredEnvironmentValue(env, "RESEND_API_KEY"),
    emailConfig: {
      from: requiredEnvironmentValue(env, "CONTACT_EMAIL_FROM"),
    },
  };
}

function throwDatabaseError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function createSupabaseContactRepository(db: ContactDatabase): ContactRepository {
  return {
    async getProfessional(professionalId): Promise<ContactProfessional | null> {
      const result = (await db
        .from("professionals")
        .select("id,full_name,verified,email")
        .eq("id", professionalId)
        .maybeSingle()) as QueryResult<{
        id: string;
        full_name: string;
        verified: boolean;
        email: string | null;
      }>;
      throwDatabaseError(result.error);
      return result.data
        ? {
            id: result.data.id,
            fullName: result.data.full_name,
            email: result.data.email,
            verified: result.data.verified,
          }
        : null;
    },

    async reserve(contact, since): Promise<ContactReservation> {
      const result = await db.rpc("reserve_contact_message", {
        p_id: contact.request_id,
        p_professional_id: contact.professional_id,
        p_sender_name: contact.sender_name,
        p_sender_email: contact.sender_email,
        p_subject: contact.subject,
        p_message: contact.message,
        p_created_at: contact.created_at,
        p_email_payload: contact.email_payload,
        p_since: since.toISOString(),
      });
      throwDatabaseError(result.error);
      if (!result.data || typeof result.data !== "object") {
        throw new Error("Supabase did not return a contact reservation");
      }
      return result.data as ContactReservation;
    },

    async markDelivered(requestId, emailId, acceptedAt): Promise<void> {
      const result = await db
        .from("contact_messages")
        .update({ email_id: emailId, email_accepted_at: acceptedAt.toISOString() })
        .eq("id", requestId);
      throwDatabaseError(result.error);
    },
  };
}

export function createResendContactSender(resend: ResendClient): ContactEmailSender {
  return {
    async send(payload, idempotencyKey) {
      const result = await resend.emails.send(payload, { idempotencyKey });
      if (result.error) throw new Error(result.error.message);
      if (!result.data?.id) throw new Error("Resend did not return an email identifier");
      return { id: result.data.id };
    },
  };
}

export async function createContactDeliveryDeps() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { apiKey, emailConfig } = readContactEmailConfig();
  return {
    repository: createSupabaseContactRepository(supabaseAdmin),
    emailSender: createResendContactSender(new Resend(apiKey)),
    emailConfig,
  };
}
