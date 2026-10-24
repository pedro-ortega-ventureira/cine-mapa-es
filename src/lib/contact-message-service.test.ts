import { describe, expect, it, vi } from "vitest";
import type { ContactEmailPayload, ContactMessageInput } from "./contact-message";
import {
  deliverContactMessage,
  type ContactDeliveryDeps,
  type ContactEmailSender,
  type ContactRepository,
  type StoredContact,
} from "./contact-message-service";

const input: ContactMessageInput = {
  request_id: "0f6ff2c3-4c4e-4d8c-b866-b3356611a661",
  professional_id: "93afb8a7-0702-4db5-8d2f-a121fce08a35",
  sender_name: "Pedro Ortega",
  sender_email: "pedro@example.org",
  subject: "Una consulta",
  message: "Hola, quisiera contactar.",
  website: "",
};

const emailConfig = {
  from: "Directorio audiovisual <contacto@xn--espaalatente-dhb.org>",
};
const professionalEmail = "inigo@example.org";

function stored(overrides: Partial<StoredContact> = {}): StoredContact {
  const emailPayload: ContactEmailPayload = {
    from: emailConfig.from,
    to: professionalEmail,
    replyTo: input.sender_email,
    subject: "[Directorio] Contacto para Iñigo: Una consulta",
    text: "Fecha: 2026-10-24T05:30:00.000Z",
    html: "<p>Fecha: 2026-10-24T05:30:00.000Z</p>",
  };
  return {
    request_id: input.request_id,
    professional_id: input.professional_id,
    sender_name: input.sender_name,
    sender_email: input.sender_email,
    subject: input.subject,
    message: input.message,
    created_at: "2026-10-24T05:30:00.000Z",
    email_payload: emailPayload,
    email_id: null,
    ...overrides,
  };
}

function makeDeps(status: "new" | "duplicate_same" = "new") {
  const contact = stored();
  const repository: ContactRepository = {
    getProfessional: vi.fn(async () => ({
      id: input.professional_id,
      fullName: "Iñigo Floristán Irisarri",
      email: professionalEmail,
      verified: true,
    })),
    reserve: vi.fn(async () => ({ status, contact })),
    markDelivered: vi.fn(async () => undefined),
  };
  const emailSender: ContactEmailSender = {
    send: vi.fn(async () => ({ id: "email_123" })),
  };
  const deps: ContactDeliveryDeps = {
    repository,
    emailSender,
    emailConfig,
    now: () => new Date("2026-10-24T05:30:00.000Z"),
  };
  return { deps, repository, emailSender, contact };
}

describe("deliverContactMessage", () => {
  it("reserva, envía y registra la aceptación en orden", async () => {
    const { deps, repository, emailSender } = makeDeps();
    const order: string[] = [];
    repository.getProfessional = vi.fn(async () => {
      order.push("professional");
      return {
        id: input.professional_id,
        fullName: "Iñigo",
        email: `  ${professionalEmail.toUpperCase()}  `,
        verified: true,
      };
    });
    repository.reserve = vi.fn(async (candidate, since) => {
      order.push("reserve");
      expect(candidate.email_payload.text).toContain("2026-10-24T05:30:00.000Z");
      expect(candidate.email_payload.to).toBe(professionalEmail);
      expect(since).toEqual(new Date("2026-10-24T05:00:00.000Z"));
      return { status: "new", contact: candidate };
    });
    emailSender.send = vi.fn(async () => {
      order.push("send");
      return { id: "email_123" };
    });
    repository.markDelivered = vi.fn(async () => {
      order.push("mark");
    });

    await expect(deliverContactMessage(input, deps)).resolves.toEqual({
      ok: true,
      contactId: input.request_id,
      emailId: "email_123",
    });
    expect(order).toEqual(["professional", "reserve", "send", "mark"]);
    expect(repository.markDelivered).toHaveBeenCalledWith(
      input.request_id,
      "email_123",
      new Date("2026-10-24T05:30:00.000Z"),
    );
  });

  it("reutiliza byte por byte el payload persistido aunque cambie el reloj", async () => {
    const { deps, repository, emailSender, contact } = makeDeps("duplicate_same");
    deps.now = () => new Date("2026-10-25T10:00:00.000Z");
    repository.getProfessional = vi.fn(async () => ({
      id: input.professional_id,
      fullName: "Iñigo",
      email: "nuevo@example.org",
      verified: true,
    }));

    await deliverContactMessage(input, deps);

    expect(emailSender.send).toHaveBeenCalledWith(
      contact.email_payload,
      `contact-message/${input.request_id}`,
    );
    expect((emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][0].text).not.toContain(
      "2026-10-25",
    );
    expect((emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][0].to).toBe(
      professionalEmail,
    );
  });

  it("no reenvía un contacto que ya tiene email aceptado", async () => {
    const { deps, repository, emailSender } = makeDeps("duplicate_same");
    repository.reserve = vi.fn(async () => ({
      status: "duplicate_same",
      contact: stored({ email_id: "email_previous" }),
    }));

    await expect(deliverContactMessage(input, deps)).resolves.toMatchObject({
      emailId: "email_previous",
    });
    expect(emailSender.send).not.toHaveBeenCalled();
    expect(repository.markDelivered).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { id: input.professional_id, fullName: "Iñigo", email: professionalEmail, verified: false },
  ])(
    "rechaza un profesional inexistente o no verificado",
    async (professional) => {
      const { deps, repository, emailSender } = makeDeps();
      repository.getProfessional = vi.fn(async () => professional);
      await expect(deliverContactMessage(input, deps)).rejects.toThrow(/profesional/i);
      expect(repository.reserve).not.toHaveBeenCalled();
      expect(emailSender.send).not.toHaveBeenCalled();
    },
  );

  it.each([null, "", "   ", "correo-invalido"])(
    "rechaza un profesional sin correo utilizable: %s",
    async (email) => {
      const { deps, repository, emailSender } = makeDeps();
      repository.getProfessional = vi.fn(async () => ({
        id: input.professional_id,
        fullName: "Iñigo",
        email,
        verified: true,
      }));

      await expect(deliverContactMessage(input, deps)).rejects.toThrow(
        "Este profesional no puede recibir mensajes",
      );
      expect(repository.reserve).not.toHaveBeenCalled();
      expect(emailSender.send).not.toHaveBeenCalled();
    },
  );

  it("convierte a Punycode el dominio internacional del destinatario", async () => {
    const { deps, repository, emailSender } = makeDeps();
    repository.getProfessional = vi.fn(async () => ({
      id: input.professional_id,
      fullName: "Iñigo",
      email: "profesional@españalatente.org",
      verified: true,
    }));
    repository.reserve = vi.fn(async (candidate) => ({ status: "new", contact: candidate }));

    await deliverContactMessage(input, deps);

    expect((emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][0].to).toBe(
      "profesional@xn--espaalatente-dhb.org",
    );
  });

  it("rechaza atómicamente el sexto mensaje", async () => {
    const { deps, repository, emailSender } = makeDeps();
    repository.reserve = vi.fn(async () => ({ status: "rate_limited", contact: null }));
    await expect(deliverContactMessage(input, deps)).rejects.toThrow(/demasiados/i);
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("rechaza un UUID repetido con contenido diferente", async () => {
    const { deps, repository, emailSender } = makeDeps();
    repository.reserve = vi.fn(async () => ({ status: "conflict", contact: null }));
    await expect(deliverContactMessage(input, deps)).rejects.toThrow(/identificador/i);
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("responde de forma neutra al honeypot sin usar dependencias", async () => {
    const { deps, repository, emailSender } = makeDeps();
    await expect(
      deliverContactMessage({ ...input, website: "https://spam.example" }, deps),
    ).resolves.toEqual({ ok: true, contactId: input.request_id, emailId: null });
    expect(repository.getProfessional).not.toHaveBeenCalled();
    expect(repository.reserve).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("conserva la reserva cuando Resend falla", async () => {
    const { deps, repository, emailSender } = makeDeps();
    emailSender.send = vi.fn(async () => {
      throw new Error("resend unavailable");
    });
    await expect(deliverContactMessage(input, deps)).rejects.toThrow("resend unavailable");
    expect(repository.reserve).toHaveBeenCalledOnce();
    expect(repository.markDelivered).not.toHaveBeenCalled();
  });
});
