import { describe, expect, it } from "vitest";
import {
  buildContactEmail,
  contactIdempotencyKey,
  contactMessageInputSchema,
  normalizeContactInput,
} from "./contact-message";

const validInput = {
  request_id: "0f6ff2c3-4c4e-4d8c-b866-b3356611a661",
  professional_id: "93afb8a7-0702-4db5-8d2f-a121fce08a35",
  sender_name: "  Pedro Ortega  ",
  sender_email: "  PEDRO@example.org  ",
  subject: "  Una consulta  ",
  message: "  Hola, quisiera contactar.  ",
  website: "  ",
};

describe("contactMessageInputSchema", () => {
  it("acepta una solicitud válida y normaliza sus campos", () => {
    const parsed = contactMessageInputSchema.parse(validInput);

    expect(normalizeContactInput(parsed)).toEqual({
      request_id: validInput.request_id,
      professional_id: validInput.professional_id,
      sender_name: "Pedro Ortega",
      sender_email: "pedro@example.org",
      subject: "Una consulta",
      message: "Hola, quisiera contactar.",
      website: "",
    });
  });

  it("rechaza UUID y email inválidos", () => {
    expect(() => contactMessageInputSchema.parse({ ...validInput, request_id: "invalido" })).toThrow();
    expect(() => contactMessageInputSchema.parse({ ...validInput, professional_id: "invalido" })).toThrow();
    expect(() => contactMessageInputSchema.parse({ ...validInput, sender_email: "no-es-email" })).toThrow();
  });

  it("aplica los límites de tamaño", () => {
    expect(() => contactMessageInputSchema.parse({ ...validInput, sender_name: "n".repeat(101) })).toThrow();
    expect(() => contactMessageInputSchema.parse({ ...validInput, subject: "s".repeat(161) })).toThrow();
    expect(() => contactMessageInputSchema.parse({ ...validInput, message: "m".repeat(5_001) })).toThrow();
  });
});

describe("composición del correo de contacto", () => {
  const config = {
    to: "pedro.ortega@xn--espaalatente-dhb.org",
    from: "Directorio audiovisual <contacto@xn--espaalatente-dhb.org>",
  };

  it("compone un correo completo con asunto por defecto y Reply-To normalizado", () => {
    const input = contactMessageInputSchema.parse({ ...validInput, subject: "" });
    const email = buildContactEmail(
      input,
      "Iñigo Floristán Irisarri",
      config,
      new Date("2026-10-24T05:10:00.000Z"),
    );

    expect(email).toMatchObject({
      from: config.from,
      to: config.to,
      replyTo: "pedro@example.org",
      subject: "[Directorio] Contacto para Iñigo Floristán Irisarri: Sin asunto",
    });
    expect(email.text).toContain("Profesional: Iñigo Floristán Irisarri");
    expect(email.text).toContain("Nombre: Pedro Ortega");
    expect(email.text).toContain("Email: pedro@example.org");
    expect(email.text).toContain("Hola, quisiera contactar.");
    expect(email.text).toContain("2026-10-24T05:10:00.000Z");
  });

  it("escapa el HTML y elimina saltos de cabecera del asunto", () => {
    const input = contactMessageInputSchema.parse({
      ...validInput,
      sender_name: "<script>alert('nombre')</script>",
      subject: "Consulta\r\nBcc: atacante@example.org",
      message: "Hola <script>alert('mensaje')</script> & adiós",
    });
    const email = buildContactEmail(input, "Profesional <principal>", config, new Date(0));

    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.subject).toContain("Consulta Bcc: atacante@example.org");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;alert(&#39;mensaje&#39;)&lt;/script&gt; &amp; adiós");
    expect(email.html).toContain("Profesional &lt;principal&gt;");
  });

  it("deriva una clave de idempotencia estable del UUID", () => {
    expect(contactIdempotencyKey(validInput.request_id)).toBe(
      `contact-message/${validInput.request_id}`,
    );
  });
});
