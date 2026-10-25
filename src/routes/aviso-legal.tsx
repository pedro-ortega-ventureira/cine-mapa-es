import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/aviso-legal")({
  head: () => ({
    meta: [
      { title: "Aviso legal — Mapa audiovisual rural" },
      { name: "description", content: "Información legal del directorio audiovisual rural." },
    ],
  }),
  component: AvisoLegal,
});

function AvisoLegal() {
  return <LegalLayout title="Aviso legal" eyebrow="Información institucional">
    <LegalSection title="Sobre este sitio"><p>Este sitio web presenta el directorio audiovisual rural de España.</p></LegalSection>
    <LegalSection title="Entidad responsable"><dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[max-content_1fr]"><dt className="font-medium text-foreground">Denominación</dt><dd>Fundación Lydia Cacho</dd><dt className="font-medium text-foreground">NIF / CIF</dt><dd>G85516987</dd><dt className="font-medium text-foreground">Forma jurídica</dt><dd>Fundación sin ánimo de lucro</dd><dt className="font-medium text-foreground">Constitución</dt><dd>2009</dd><dt className="font-medium text-foreground">Domicilio</dt><dd>C/ Gravina, 13, 1.º izquierda, 28004 Madrid</dd></dl></LegalSection>
    <LegalSection title="Contacto"><p>Para consultas sobre el sitio o los perfiles, utiliza el <Link className="font-medium text-primary underline underline-offset-4" to="/directorio">directorio y su formulario de contacto</Link>.</p></LegalSection>
  </LegalLayout>;
}
