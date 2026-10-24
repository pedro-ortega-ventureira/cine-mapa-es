import { Resend } from "resend";
import type { ContactEmailConfig, ContactEmailPayload } from "./contact-message";
import type {
  ContactEmailSender,
  ContactProfessional,
  ContactRecord,
  ContactRepository,
  ContactSaveStatus,
} from "./contact-message-service";

type ContactEnvironment = Record<string, string | undefined>;

export interface ContactEmailServerConfig {
  apiKey: string;
  emailConfig: ContactEmailConfig;
}

type QueryResult<T> = { data: T | null; error: { code?: string; message: string } | null };

interface ContactDatabase {
  from(table: "professionals" | "contact_messages"): any;
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
      to: requiredEnvironmentValue(env, "CONTACT_EMAIL_TO"),
      from: requiredEnvironmentValue(env, "CONTACT_EMAIL_FROM"),
    },
  };
}

function throwDatabaseError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function matchesRecord(left: ContactRecord, right: ContactRecord): boolean {
  return (
    left.request_id === right.request_id &&
    left.professional_id === right.professional_id &&
    left.sender_name === right.sender_name &&
    left.sender_email === right.sender_email &&
    left.subject === right.subject &&
    left.message === right.message
  );
}

export function createSupabaseContactRepository(db: ContactDatabase): ContactRepository {
  return {
    async getProfessional(professionalId): Promise<ContactProfessional | null> {
      const result = (await db
        .from("professionals")
        .select("id,full_name,verified")
        .eq("id", professionalId)
        .maybeSingle()) as QueryResult<{ id: string; full_name: string; verified: boolean }>;
      throwDatabaseError(result.error);
      return result.data
        ? { id: result.data.id, fullName: result.data.full_name, verified: result.data.verified }
        : null;
    },

    async getById(requestId): Promise<ContactRecord | null> {
      const result = (await db
        .from("contact_messages")
        .select("id,professional_id,sender_name,sender_email,subject,message")
        .eq("id", requestId)
        .maybeSingle()) as QueryResult<{
        id: string;
        professional_id: string;
        sender_name: string;
        sender_email: string;
        subject: string | null;
        message: string;
      }>;
      throwDatabaseError(result.error);
      return result.data
        ? {
            request_id: result.data.id,
            professional_id: result.data.professional_id,
            sender_name: result.data.sender_name,
            sender_email: result.data.sender_email,
            subject: result.data.subject ?? "",
            message: result.data.message,
          }
        : null;
    },

    async countRecentByEmail(senderEmail, since): Promise<number> {
      const result = (await db
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_email", senderEmail)
        .gte("created_at", since.toISOString())) as QueryResult<null> & { count?: number | null };
      throwDatabaseError(result.error);
      return result.count ?? 0;
    },

    async save(contact): Promise<ContactSaveStatus> {
      const insert = await db.from("contact_messages").insert({
        id: contact.request_id,
        professional_id: contact.professional_id,
        sender_name: contact.sender_name,
        sender_email: contact.sender_email,
        subject: contact.subject,
        message: contact.message,
      });
      if (!insert.error) return "new";
      if (insert.error.code !== "23505") throwDatabaseError(insert.error);

      const existing = await this.getById(contact.request_id);
      return existing && matchesRecord(existing, contact) ? "duplicate_same" : "conflict";
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
