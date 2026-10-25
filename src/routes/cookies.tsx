import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cookies")({
  head: () => ({ meta: [{ title: "Política de cookies — Mapa audiovisual rural" }] }),
  component: Cookies,
});

function Cookies() {
  return <main className="mx-auto w-full max-w-3xl px-4 py-12 prose prose-neutral dark:prose-invert">
    <h1>Política de cookies</h1>
    <p>El sitio utiliza cookies técnicas y almacenamiento de sesión necesarios para mantener la autenticación y el funcionamiento de la aplicación.</p>
    <h2>Cookies no esenciales</h2>
    <p>No se activan cookies publicitarias ni de seguimiento de terceros desde este directorio.</p>
    <h2>Cómo gestionarlas</h2>
    <p>Puedes bloquear o eliminar cookies desde la configuración de tu navegador. Si bloqueas las cookies técnicas, algunas funciones de acceso y registro pueden dejar de funcionar.</p>
  </main>;
}
