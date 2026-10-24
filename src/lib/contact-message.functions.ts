import { createServerFn } from "@tanstack/react-start";
import { contactMessageInputSchema } from "./contact-message";
import { deliverContactMessage } from "./contact-message-service";

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactMessageInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { createContactDeliveryDeps } = await import("./contact-message.server");
      const result = await deliverContactMessage(data, await createContactDeliveryDeps());
      console.info(
        `[contact-message] phase=accepted request_id=${result.contactId} email_id=${result.emailId ?? "none"}`,
      );
      return result;
    } catch {
      console.error(`[contact-message] phase=failed request_id=${data.request_id}`);
      throw new Error("No se pudo enviar el mensaje");
    }
  });
