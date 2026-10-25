import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";

export const Route = createFileRoute("/privacidad")({
  head: () => ({ meta: [{ title: "Política de privacidad — Mapa audiovisual rural" }] }),
  component: Privacy,
});

function Privacy() {
  return <LegalLayout title="Política de privacidad" eyebrow="Tus datos y tus derechos">
    <LegalSection title="Resumen"><p>Esta política explica cómo se tratan los datos del directorio audiovisual rural.</p></LegalSection>
    <LegalSection title="Responsable"><p>Fundación Lydia Cacho, NIF/CIF G85516987, C/ Gravina, 13, 1.º izquierda, 28004 Madrid.</p></LegalSection>
    <LegalSection title="Datos y finalidades"><p>Tratamos los datos que proporcionas al crear o actualizar un perfil para gestionar tu cuenta y publicar la información que hayas decidido hacer pública. Los mensajes del formulario de contacto se utilizan para facilitar la comunicación con el profesional destinatario.</p></LegalSection>
    <LegalSection title="Base jurídica y conservación"><p>La base jurídica es la ejecución de la relación solicitada por la persona usuaria y, cuando corresponda, su consentimiento. Conservamos los datos mientras exista la cuenta o sea necesario prestar el servicio y después durante los plazos legales aplicables.</p></LegalSection>
    <LegalSection title="Proveedores"><p>La aplicación utiliza servicios de alojamiento, base de datos y envío de correo necesarios para prestar estas funciones. No se venden datos personales.</p></LegalSection>
    <LegalSection title="Derechos"><p>Puedes solicitar acceso, rectificación, supresión, oposición, limitación o portabilidad de tus datos mediante el <a className="font-medium text-primary underline underline-offset-4" href="/directorio">formulario de contacto del directorio</a>.</p></LegalSection>
  </LegalLayout>;
}
