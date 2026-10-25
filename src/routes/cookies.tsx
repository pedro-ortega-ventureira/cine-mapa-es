import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/cookies")({
  head: () => ({ meta: [{ title: "Política de cookies — Mapa audiovisual rural" }] }),
  component: Cookies,
});

function Cookies() {
  return <LegalLayout title="Política de cookies" eyebrow="Transparencia técnica">
    <LegalSection title="Cookies técnicas"><p>El sitio utiliza cookies técnicas y almacenamiento de sesión necesarios para mantener la autenticación y el funcionamiento de la aplicación.</p></LegalSection>
    <LegalSection title="Cookies no esenciales"><p>No se activan cookies publicitarias ni de seguimiento de terceros desde este directorio.</p></LegalSection>
    <LegalSection title="Cómo gestionarlas"><p>Puedes bloquear o eliminar cookies desde la configuración de tu navegador. Si bloqueas las cookies técnicas, algunas funciones de acceso y registro pueden dejar de funcionar.</p></LegalSection>
  </LegalLayout>;
}
