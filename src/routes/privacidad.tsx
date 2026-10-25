import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidad")({
  head: () => ({ meta: [{ title: "Política de privacidad — Mapa audiovisual rural" }] }),
  component: Privacy,
});

function Privacy() {
  return <main className="mx-auto w-full max-w-3xl px-4 py-12 prose prose-neutral dark:prose-invert">
    <h1>Política de privacidad</h1>
    <p>Esta política explica cómo se tratan los datos del directorio audiovisual rural.</p>
    <h2>Responsable</h2><p>Fundación Lydia Cacho, NIF/CIF G85516987, C/ Gravina, 13, 1.º izquierda, 28004 Madrid.</p>
    <h2>Datos y finalidades</h2>
    <p>Tratamos los datos que proporcionas al crear o actualizar un perfil para gestionar tu cuenta y publicar la información que hayas decidido hacer pública. Los mensajes del formulario de contacto se utilizan para facilitar la comunicación con el profesional destinatario.</p>
    <h2>Base jurídica y conservación</h2>
    <p>La base jurídica es la ejecución de la relación solicitada por la persona usuaria y, cuando corresponda, su consentimiento. Conservamos los datos mientras exista la cuenta o sea necesario prestar el servicio y después durante los plazos legales aplicables.</p>
    <h2>Proveedores</h2>
    <p>La aplicación utiliza servicios de alojamiento, base de datos y envío de correo necesarios para prestar estas funciones. No se venden datos personales.</p>
    <h2>Derechos</h2>
    <p>Puedes solicitar acceso, rectificación, supresión, oposición, limitación o portabilidad de tus datos mediante el <a className="underline" href="/directorio">formulario de contacto del directorio</a>.</p>
  </main>;
}
