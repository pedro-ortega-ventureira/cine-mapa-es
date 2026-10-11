# Auditoría de preproducción de Aulós

Fecha: 2026-10-11T17:01:47.911Z
Entorno: `staging8.aulos.es` (lectura autenticada).

## Veredicto

**APTO CON OBSERVACIONES.** No quedan bloqueantes técnicos en las superficies
revisadas. Antes de una apertura pública conviene redactar metadescripciones
específicas; la verificación de una compra completa se omitió por decisión del
propietario.

### Evidencia de salida

- Las once rutas de contenido responden `200`; `/shop/` responde `301` y
  conserva la query al redirigir a `/catalogo/`.
- Todas las páginas indexables auditadas tienen canonical y exactamente un
  `H1` visible y dentro del contenido principal.
- Producto, carrito y cuenta permanecen fuera de la regla de redirección.
- `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy` y
  `X-Frame-Options` están aplicadas. No aparecieron errores CSP en las pruebas
  de navegador.
- Home, catálogo, zine y producto se revisaron con Chromium a 1440 px y 390 px:
  sin desbordamiento horizontal y con un `H1` visible.
- Orígenes externos observados: `fonts.googleapis.com`, `gmpg.org`,
  `js.stripe.com`, `mistericaland.substack.com`, `stats.wp.com` y
  `www.googletagmanager.com`.

### Observaciones no bloqueantes

- Diez metadescripciones requieren tratamiento editorial: nueve son demasiado
  largas y `/mi-cuenta/` no tiene una. Para la cuenta es preferible valorar
  `noindex` antes que redactar una descripción promocional.
- El título `Home - Ediciones Aulós` es funcional pero poco descriptivo; se
  recomienda sustituirlo por una propuesta de valor antes de optimizar SEO.
- No se completó una compra de prueba, conforme a la instrucción recibida.
- Staging debe conservar el bloqueo a buscadores; la indexación solo debe
  habilitarse al publicar en producción.

## Bloqueantes

- Ninguno detectado.

## Recomendaciones

- `/`: metadescripción demasiado larga (418 caracteres).
- `/catalogo/`: metadescripción demasiado larga (388 caracteres).
- `/zine/`: metadescripción demasiado larga (200 caracteres).
- `/publica-con-aulos/`: metadescripción demasiado larga (435 caracteres).
- `/producto/leer-la-luna-tarot-y-cine-carlos-a-cuellar-alejandro/`: metadescripción demasiado larga (343 caracteres).
- `/mi-cuenta/`: sin metadescripción.
- `/terminos-y-condiciones/`: metadescripción demasiado larga (466 caracteres).
- `/politica-de-privacidad/`: metadescripción demasiado larga (466 caracteres).
- `/politica-de-cookies-ue/`: metadescripción demasiado larga (390 caracteres).
- `/reembolso_devoluciones/`: metadescripción demasiado larga (430 caracteres).

## Redirecciones

- `/shop/` → `/catalogo/` (HTTP 301).

## Inventario SEO y semántico

| Ruta | HTTP | Título | Metadescripción | Canonical | H1 total/main | Encabezados |
|---|---:|---|---|---|---:|---|
| `/` | 200 | Home - Ediciones Aulós | Ediciones Aulós · Humanidades en tiempos digitales Investigación que merece perdurar. Libros académicos singulares sobre estética, ocultura y humanidades digitales. Ediciones cuid… | https://staging8.aulos.es/ | 1/1 | H1 Investigación que merece perdurar. · H2 Entra por donde comienza tu curiosidad. · H3 Libros y catálogos · H3 Revista académica · H3 Publica con Aulós · H2 Libros para leer desp… |
| `/catalogo/` | 200 | Catálogo - Ediciones Aulós | Ediciones AulósCatálogo de Ediciones AulósCon cada compra realizada en la tienda Aulós recibirás de regalo el PDF de Estética y romanticismos. Edición destacadaLa vanguardia prerr… | https://staging8.aulos.es/catalogo/ | 1/1 | H1 Catálogo de Ediciones Aulós · H2 La vanguardia prerrafaelista · H2 Aulós Humanidades · H3 Leer la Luna. Tarot y cine · H3 El caos de la naturaleza · H3 Otro Siglo de Oro · H3 R… |
| `/shop/` | 301 | — | — | — | 0/0 | — |
| `/zine/` | 200 | Zine - Ediciones Aulós | AULÓS-ZINE · ISSN 2952-4148Aulós ZineCine, arte, pensamiento y cultura desde la mirada editorial de Aulós.TodosEstéticaGóticoHistoria del ArteHumanidadesHumanidades DigitalesNotic… | https://staging8.aulos.es/zine/ | 1/1 | H1 Aulós Zine · H2 Cine y ocultura. Una entrevista con Carlos Cuéllar · H2 Carlos Martínez Carrasco en Onda Cero · H2 Compendio de lo oculto · H2 Melodías para los sueños y las so… |
| `/publica-con-aulos/` | 200 | Publica con Aulós - Ediciones Aulós | Ediciones Aulós · Propuestas editorialesTu investigación merece seguir viviendo en un libro.Una editorial especializada para que tu investigación circule, se recuerde y perdure.So… | https://staging8.aulos.es/publica-con-aulos/ | 1/1 | H1 Tu investigación merece seguir viviendo en un libro. · H2 Del proyecto financiado a una obra con presencia propia. · H2 Una edición que cuida el conocimiento y amplía su alcanc… |
| `/producto/leer-la-luna-tarot-y-cine-carlos-a-cuellar-alejandro/` | 200 | Leer la Luna. Tarot y cine - Ediciones Aulós | El indudable magnetismo de la Luna nos afecta y nos inspira tanto en el sentido espiritual como en el creativo, hasta el punto de configurar un tema artístico recurrente en todo t… | https://staging8.aulos.es/producto/leer-la-luna-tarot-y-cine-carlos-a-cuellar-alejandro/ | 1/1 | H1 Leer la Luna. Tarot y cine · H2 Valoraciones · H2 Productos relacionados · H3 Herejía y Belleza 8 – Lo sagrado y lo profano 1 · H3 Arte y sociedades secretas. Péladan y los Sal… |
| `/carrito/` | 200 | Carrito - Ediciones Aulós | ¿Tienes alguna duda? Contáctanos: | https://staging8.aulos.es/carrito/ | 1/1 | H1 Carrito · H2 ¿Tienes alguna duda? |
| `/mi-cuenta/` | 200 | Mi cuenta - Ediciones Aulós | — | https://staging8.aulos.es/mi-cuenta/ | 1/1 | H1 Mi cuenta · H2 Acceder · H2 Registrarse |
| `/terminos-y-condiciones/` | 200 | Términos y condiciones - Ediciones Aulós | Información de compraTérminos y condicionesEstas condiciones regulan el acceso a aulos.es y las compras realizadas en nuestra tienda. ResponsableAsociación Cultural Mentenebre NIF… | https://staging8.aulos.es/terminos-y-condiciones/ | 1/1 | H1 Términos y condiciones · H2 Identificación · H2 Uso del sitio · H2 Productos y pedidos · H2 Propiedad intelectual · H2 Enlaces, responsabilidad y cambios · H2 Normativa aplicab… |
| `/politica-de-privacidad/` | 200 | Política de privacidad - Ediciones Aulós | Protección de datosPolítica de privacidadEsta política explica cómo tratamos los datos personales de quienes navegan, contactan o compran en aulos.es. ResponsableAsociación Cultur… | https://staging8.aulos.es/politica-de-privacidad/ | 1/1 | H1 Política de privacidad · H2 Responsable del tratamiento · H2 Datos que podemos tratar · H2 Finalidades y base jurídica · H2 Conservación y destinatarios · H2 Sus derechos · H2… |
| `/politica-de-cookies-ue/` | 200 | Política de cookies (UE) - Ediciones Aulós | Transparencia y controlPolítica de cookiesUtilizamos cookies y tecnologías similares para que el sitio funcione, recordar sus preferencias y, cuando usted lo autorice, conocer mej… | https://staging8.aulos.es/politica-de-cookies-ue/ | 1/1 | H1 Política de cookies · H2 Configuración de cookies · H2 1. Introducción · H2 2. ¿Qué son las cookies? · H2 3. ¿Qué son los scripts? · H2 4. ¿Qué es una baliza web? · H2 5. Cooki… |
| `/reembolso_devoluciones/` | 200 | Política de devoluciones y reembolsos - Ediciones Aulós | Compras en AulósPolítica de devoluciones y reembolsosEn Ediciones Aulós queremos que la compra sea clara y segura. Esta política se aplica a las adquisiciones realizadas en aulos.… | https://staging8.aulos.es/reembolso_devoluciones/ | 1/1 | H1 Política de devoluciones y reembolsos · H2 Contacto e identificación · H2 Derecho de desistimiento · H2 Reembolsos · H2 Publicaciones digitales · H2 Productos defectuosos o ped… |
