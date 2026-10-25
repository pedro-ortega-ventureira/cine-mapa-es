import { createFileRoute, Link } from "@tanstack/react-router";

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
  return <LegalPage title="Aviso legal">
    <p>Este sitio web presenta el directorio audiovisual rural de España.</p>
    <h2>Entidad responsable</h2>
    <dl className="grid gap-2 sm:grid-cols-[max-content_1fr]">
      <dt className="font-medium">Denominación</dt><dd>Fundación Lydia Cacho</dd>
      <dt className="font-medium">NIF / CIF</dt><dd>G85516987</dd>
      <dt className="font-medium">Forma jurídica</dt><dd>Fundación sin ánimo de lucro</dd>
      <dt className="font-medium">Constitución</dt><dd>2009</dd>
      <dt className="font-medium">Domicilio</dt><dd>C/ Gravina, 13, 1.º izquierda, 28004 Madrid</dd>
    </dl>
    <h2>Contacto</h2>
    <p>Para consultas sobre el sitio o los perfiles, utiliza el <Link className="underline" to="/directorio">directorio y su formulario de contacto</Link>.</p>
  </LegalPage>;
}

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-3xl px-4 py-12 prose prose-neutral dark:prose-invert">
    <h1>{title}</h1>{children}
  </main>;
}
