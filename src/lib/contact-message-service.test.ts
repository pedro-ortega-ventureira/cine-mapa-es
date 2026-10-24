import { describe, expect, it, vi } from "vitest";
import type { ContactMessageInput } from "./contact-message";
import {
  deliverContactMessage,
  type ContactDeliveryDeps,
  type ContactEmailSender,
  type ContactRecord,
  type ContactRepository,
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

const record: ContactRecord = {
  request_id: input.request_id,
  professional_id: input.professional_id,
  sender_name: input.sender_name,
  sender_email: input.sender_email,
  subject: input.subject,
  message: input.message,
};

function makeDeps() {
  const repository: ContactRepository = {
    getProfessional: vi.fn(async () => ({
      id: input.professional_id,
      fullName: "Iñigo Floristán Irisarri",
      verified: true,
    })),
    getById: vi.fn(async () => null),
    countRecentByEmail: vi.fn(async () => 0),
    save: vi.fn(async () => "new" as const),
  };
  const emailSender: ContactEmailSender = {
    send: vi.fn(async () => ({ id: "email_123" })),
  };
  const deps: ContactDeliveryDeps = {
    repository,
    emailSender,
    emailConfig: {
      to: "pedro.ortega@xn--espaalatente-dhb.org",
      from: "Directorio audiovisual <contacto@xn--espaalatente-dhb.org>",
    },
    now: () => new Date("2026-10-24T05:30:00.000Z"),
  };

  return { deps, repository, emailSender };
}

describe("deliverContactMessage", () => {
  it("guarda y envía una solicitud válida en el orden previsto", async () => {
    const order: string[] = [];
    const repository: ContactRepository = {
      getProfessional: vi.fn(async () => {
        order.push("professional");
        return { id: input.professional_id, fullName: "Iñigo Floristán Irisarri", verified: true };
      }),
      getById: vi.fn(async () => {
        order.push("existing");
        return null;
      }),
      countRecentByEmail: vi.fn(async () => {
        order.push("rate-limit");
        return 0;
      }),
      save: vi.fn(async () => {
        order.push("save");
        return "new" as const;
      }),
    };
    const send = vi.fn(async (_payload, idempotencyKey: string) => {
      order.push("send");
      expect(idempotencyKey).toBe(`contact-message/${input.request_id}`);
      return { id: "email_123" };
    });
    const deps: ContactDeliveryDeps = {
      repository,
      emailSender: { send },
      emailConfig: {
        to: "pedro.ortega@xn--espaalatente-dhb.org",
        from: "Directorio audiovisual <contacto@xn--espaalatente-dhb.org>",
      },
      now: () => new Date("2026-10-24T05:30:00.000Z"),
    };

    await expect(deliverContactMessage(input, deps)).resolves.toEqual({
      ok: true,
      contactId: input.request_id,
      emailId: "email_123",
    });
    expect(order).toEqual(["professional", "existing", "rate-limit", "save", "send"]);
    expect(repository.countRecentByEmail).toHaveBeenCalledWith(
      "pedro@example.org",
      new Date("2026-10-24T05:00:00.000Z"),
    );
    expect(repository.save).toHaveBeenCalledWith({
      request_id: input.request_id,
      professional_id: input.professional_id,
      sender_name: input.sender_name,
      sender_email: input.sender_email,
      subject: input.subject,
      message: input.message,
    });
    expect(send).toHaveBeenCalledOnce();
  });

  it.each([null, { id: input.professional_id, fullName: "Iñigo", verified: false }])(
    "rechaza un profesional inexistente o no verificado",
    async (professional) => {
      const { deps, repository, emailSender } = makeDeps();
      repository.getProfessional = vi.fn(async () => professional);

      await expect(deliverContactMessage(input, deps)).rejects.toThrow(/profesional/i);
      expect(repository.getById).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
      expect(emailSender.send).not.toHaveBeenCalled();
    },
  );

  it("rechaza el sexto mensaje del mismo email dentro de 30 minutos", async () => {
    const { deps, repository, emailSender } = makeDeps();
    repository.countRecentByEmail = vi.fn(async () => 5);

    await expect(deliverContactMessage(input, deps)).rejects.toThrow(/demasiados/i);
    expect(repository.save).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("responde de forma neutra al honeypot sin usar dependencias", async () => {
    const { deps, repository, emailSender } = makeDeps();

    await expect(deliverContactMessage({ ...input, website: "https://spam.example" }, deps)).resolves.toEqual({
      ok: true,
      contactId: input.request_id,
      emailId: null,
    });
    expect(repository.getProfessional).not.toHaveBeenCalled();
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.countRecentByEmail).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("no envía si falla el guardado", async () => {
    const { deps, repository, emailSender } = makeDeps();
    repository.save = vi.fn(async () => {
      throw new Error("database unavailable");
    });

    await expect(deliverContactMessage(input, deps)).rejects.toThrow("database unavailable");
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("mantiene el registro cuando Resend falla después del guardado", async () => {
    const { deps, repository, emailSender } = makeDeps();
    emailSender.send = vi.fn(async () => {
      throw new Error("resend unavailable");
    });

    await expect(deliverContactMessage(input, deps)).rejects.toThrow("resend unavailable");
    expect(repository.save).toHaveBeenCalledOnce();
  });

  it("reintenta una solicitud idéntica con la misma clave sin volver a guardarla ni limitarla", async () => {
    const { deps, repository, emailSender } = makeDeps();
    repository.getById = vi.fn(async () => record);

    await expect(deliverContactMessage(input, deps)).resolves.toMatchObject({
      ok: true,
      contactId: input.request_id,
      emailId: "email_123",
    });
    expect(repository.countRecentByEmail).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.any(Object),
      `contact-message/${input.request_id}`,
    );
  });

  it("rechaza un UUID repetido con contenido diferente", async () => {
    const { deps, repository, emailSender } = makeDeps();
    repository.getById = vi.fn(async () => ({ ...record, message: "Otro mensaje" }));

    await expect(deliverContactMessage(input, deps)).rejects.toThrow(/identificador/i);
    expect(repository.countRecentByEmail).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("clasifica como conflicto una colisión detectada al guardar", async () => {
    const { deps, repository, emailSender } = makeDeps();
    repository.save = vi.fn(async () => "conflict" as const);

    await expect(deliverContactMessage(input, deps)).rejects.toThrow(/identificador/i);
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it("continúa el envío si una carrera de guardado resulta ser el mismo contacto", async () => {
    const { deps, repository, emailSender } = makeDeps();
    repository.save = vi.fn(async () => "duplicate_same" as const);

    await expect(deliverContactMessage(input, deps)).resolves.toMatchObject({ emailId: "email_123" });
    expect(emailSender.send).toHaveBeenCalledOnce();
  });
});
