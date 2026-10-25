import { createServerFn } from "@tanstack/react-start";
import {
  CONTACT_UNAVAILABLE_MESSAGE,
  contactMessageInputSchema,
  type ContactMessageInput,
} from "./contact-message";
import {
  deliverContactMessage,
  type ContactDeliveryDeps,
  type ContactDeliveryResult,
} from "./contact-message-service";

type ContactDepsFactory = () => Promise<ContactDeliveryDeps>;

export async function handleContactMessage(
  data: ContactMessageInput,
  createDeps: ContactDepsFactory,
): Promise<ContactDeliveryResult> {
  if (data.website.trim()) {
    return { ok: true, contactId: data.request_id, emailId: null };
  }
  try {
    return await deliverContactMessage(data, await createDeps());
  } catch (error) {
    if (error instanceof Error && error.message === CONTACT_UNAVAILABLE_MESSAGE) {
      throw new Error(CONTACT_UNAVAILABLE_MESSAGE);
    }
    throw new Error("No se pudo enviar el mensaje");
  }
}

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactMessageInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { createContactDeliveryDeps } = await import("./contact-message.server");
      const result = await handleContactMessage(data, createContactDeliveryDeps);
      console.info(
        `[contact-message] phase=accepted request_id=${result.contactId} email_id=${result.emailId ?? "none"}`,
      );
      return result;
    } catch (error) {
      console.error(`[contact-message] phase=failed request_id=${data.request_id}`);
      throw error;
    }
  });
