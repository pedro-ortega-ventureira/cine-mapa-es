// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactDialog } from "./ContactDialog";

const requestId = "0f6ff2c3-4c4e-4d8c-b866-b3356611a661";
const professionalId = "93afb8a7-0702-4db5-8d2f-a121fce08a35";
const { submit, toast } = vi.hoisted(() => ({
  submit: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: () => submit,
}));
vi.mock("sonner", () => ({ toast }));

function openDialog() {
  render(
    React.createElement(ContactDialog, {
      professionalId,
      professionalName: "Iñigo Floristán Irisarri",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Contactar" }));
}

function fillForm() {
  fireEvent.change(screen.getByPlaceholderText("Tu nombre"), {
    target: { value: "Pedro Ortega" },
  });
  fireEvent.change(screen.getByPlaceholderText("Tu email"), {
    target: { value: "PEDRO@example.org" },
  });
  fireEvent.change(screen.getByPlaceholderText("Asunto (opcional)"), {
    target: { value: "Una consulta" },
  });
  fireEvent.change(screen.getByPlaceholderText("Mensaje"), {
    target: { value: "Hola, quisiera contactar." },
  });
}

describe("ContactDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("envía el contacto al servidor y cierra al aceptarlo", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(requestId);
    submit.mockResolvedValue({ ok: true, contactId: requestId, emailId: "email_123" });
    openDialog();
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    await waitFor(() =>
      expect(submit).toHaveBeenCalledWith({
        data: {
          request_id: requestId,
          professional_id: professionalId,
          sender_name: "Pedro Ortega",
          sender_email: "PEDRO@example.org",
          subject: "Una consulta",
          message: "Hola, quisiera contactar.",
          website: "",
        },
      }),
    );
    expect(toast.success).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Contactar con Iñigo Floristán Irisarri")).toBeNull());
  });

  it("conserva los datos y el UUID tras un error, y los reinicia después del éxito", async () => {
    const nextRequestId = "4b6f2c3-4c4e-4d8c-b866-b3356611a662";
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce(requestId)
      .mockReturnValueOnce(nextRequestId);
    submit
      .mockRejectedValueOnce(new Error("resend unavailable"))
      .mockResolvedValueOnce({ ok: true, contactId: requestId, emailId: "email_123" })
      .mockResolvedValueOnce({ ok: true, contactId: nextRequestId, emailId: "email_456" });
    openDialog();
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo enviar el mensaje"));
    expect((screen.getByPlaceholderText("Tu nombre") as HTMLInputElement).value).toBe(
      "Pedro Ortega",
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(submit.mock.calls[0][0].data.request_id).toBe(requestId);
    expect(submit.mock.calls[1][0].data.request_id).toBe(requestId);
    await waitFor(() => expect(screen.queryByText("Contactar con Iñigo Floristán Irisarri")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Contactar" }));
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(3));
    expect(submit.mock.calls[2][0].data.request_id).toBe(nextRequestId);
  });
});
