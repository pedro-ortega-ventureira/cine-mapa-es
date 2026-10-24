import { describe, expect, it, vi } from "vitest";
import type { ContactEmailPayload } from "./contact-message";
import type { ContactRecord } from "./contact-message-service";
import {
  createResendContactSender,
  createSupabaseContactRepository,
  readContactEmailConfig,
} from "./contact-message.server";
import { sendContactMessage } from "./contact-message.functions";

const requestId = "0f6ff2c3-4c4e-4d8c-b866-b3356611a661";
const professionalId = "93afb8a7-0702-4db5-8d2f-a121fce08a35";
const technicalTo = "pedro.ortega@xn--espaalatente-dhb.org";
const technicalFrom = "Directorio audiovisual <contacto@xn--espaalatente-dhb.org>";

const record: ContactRecord = {
  request_id: requestId,
  professional_id: professionalId,
  sender_name: "Pedro Ortega",
  sender_email: "pedro@example.org",
  subject: "Una consulta",
  message: "Hola, quisiera contactar.",
};

class FakeQuery {
  readonly calls: Array<[string, ...unknown[]]> = [];

  constructor(private readonly result: unknown) {}

  select(...args: unknown[]) {
    this.calls.push(["select", ...args]);
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push(["eq", ...args]);
    return this;
  }

  gte(...args: unknown[]) {
    this.calls.push(["gte", ...args]);
    return this;
  }

  insert(...args: unknown[]) {
    this.calls.push(["insert", ...args]);
    return this;
  }

  maybeSingle() {
    this.calls.push(["maybeSingle"]);
    return Promise.resolve(this.result);
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function fakeDatabase(...results: unknown[]) {
  const queries: FakeQuery[] = [];
  const from = vi.fn((table: string) => {
    const next = results.shift();
    const query = new FakeQuery(next);
    query.calls.push(["from", table]);
    queries.push(query);
    return query;
  });

  return { db: { from }, from, queries };
}

describe("readContactEmailConfig", () => {
  it.each(["RESEND_API_KEY", "CONTACT_EMAIL_TO", "CONTACT_EMAIL_FROM"])(
    "explica qué variable falta: %s",
    (missing) => {
      const env: Record<string, string | undefined> = {
        RESEND_API_KEY: "re_test_123",
        CONTACT_EMAIL_TO: technicalTo,
        CONTACT_EMAIL_FROM: technicalFrom,
      };
      delete env[missing];

      expect(() => readContactEmailConfig(env)).toThrow(missing);
    },
  );

  it("acepta las direcciones técnicas punycode", () => {
    expect(
      readContactEmailConfig({
        RESEND_API_KEY: " re_test_123 ",
        CONTACT_EMAIL_TO: ` ${technicalTo} `,
        CONTACT_EMAIL_FROM: ` ${technicalFrom} `,
      }),
    ).toEqual({
      apiKey: "re_test_123",
      emailConfig: { to: technicalTo, from: technicalFrom },
    });
  });
});

describe("createResendContactSender", () => {
  const payload: ContactEmailPayload = {
    from: technicalFrom,
    to: technicalTo,
    replyTo: "pedro@example.org",
    subject: "Contacto",
    text: "Mensaje",
    html: "<p>Mensaje</p>",
  };

  it("pasa Reply-To y la clave de idempotencia al SDK", async () => {
    const send = vi.fn(async () => ({ data: { id: "email_123" }, error: null }));
    const sender = createResendContactSender({ emails: { send } });

    await expect(sender.send(payload, `contact-message/${requestId}`)).resolves.toEqual({
      id: "email_123",
    });
    expect(send).toHaveBeenCalledWith(
      {
        from: technicalFrom,
        to: technicalTo,
        replyTo: "pedro@example.org",
        subject: "Contacto",
        text: "Mensaje",
        html: "<p>Mensaje</p>",
      },
      { idempotencyKey: `contact-message/${requestId}` },
    );
  });

  it("convierte un error de Resend en una excepción", async () => {
    const sender = createResendContactSender({
      emails: {
        send: vi.fn(async () => ({
          data: null,
          error: { name: "validation_error", message: "invalid sender" },
        })),
      },
    });

    await expect(sender.send(payload, `contact-message/${requestId}`)).rejects.toThrow(
      "invalid sender",
    );
  });
});

describe("createSupabaseContactRepository", () => {
  it("obtiene solo los datos necesarios de un profesional verificado", async () => {
    const { db, queries } = fakeDatabase({
      data: { id: professionalId, full_name: "Iñigo Floristán Irisarri", verified: true },
      error: null,
    });
    const repository = createSupabaseContactRepository(db);

    await expect(repository.getProfessional(professionalId)).resolves.toEqual({
      id: professionalId,
      fullName: "Iñigo Floristán Irisarri",
      verified: true,
    });
    expect(queries[0].calls).toEqual([
      ["from", "professionals"],
      ["select", "id,full_name,verified"],
      ["eq", "id", professionalId],
      ["maybeSingle"],
    ]);
  });

  it("cuenta mensajes recientes por email y fecha", async () => {
    const since = new Date("2026-10-24T05:00:00.000Z");
    const { db, queries } = fakeDatabase({ data: null, count: 4, error: null });
    const repository = createSupabaseContactRepository(db);

    await expect(repository.countRecentByEmail("pedro@example.org", since)).resolves.toBe(4);
    expect(queries[0].calls).toEqual([
      ["from", "contact_messages"],
      ["select", "id", { count: "exact", head: true }],
      ["eq", "sender_email", "pedro@example.org"],
      ["gte", "created_at", since.toISOString()],
    ]);
  });

  it("inserta una solicitud nueva con su UUID estable", async () => {
    const { db, queries } = fakeDatabase({ error: null });
    const repository = createSupabaseContactRepository(db);

    await expect(repository.save(record)).resolves.toBe("new");
    expect(queries[0].calls).toEqual([
      ["from", "contact_messages"],
      [
        "insert",
        {
          id: requestId,
          professional_id: professionalId,
          sender_name: "Pedro Ortega",
          sender_email: "pedro@example.org",
          subject: "Una consulta",
          message: "Hola, quisiera contactar.",
        },
      ],
    ]);
  });

  it("clasifica una colisión idéntica como duplicado seguro", async () => {
    const { db } = fakeDatabase(
      { error: { code: "23505", message: "duplicate key" } },
      {
        data: {
          id: requestId,
          professional_id: professionalId,
          sender_name: "Pedro Ortega",
          sender_email: "pedro@example.org",
          subject: "Una consulta",
          message: "Hola, quisiera contactar.",
        },
        error: null,
      },
    );
    const repository = createSupabaseContactRepository(db);

    await expect(repository.save(record)).resolves.toBe("duplicate_same");
  });

  it("clasifica una colisión con contenido distinto como conflicto", async () => {
    const { db } = fakeDatabase(
      { error: { code: "23505", message: "duplicate key" } },
      {
        data: {
          id: requestId,
          professional_id: professionalId,
          sender_name: "Pedro Ortega",
          sender_email: "pedro@example.org",
          subject: "Una consulta",
          message: "Contenido diferente",
        },
        error: null,
      },
    );
    const repository = createSupabaseContactRepository(db);

    await expect(repository.save(record)).resolves.toBe("conflict");
  });
});

describe("sendContactMessage", () => {
  it("expone una función pública de TanStack Start", () => {
    expect(sendContactMessage).toEqual(expect.any(Function));
  });
});
