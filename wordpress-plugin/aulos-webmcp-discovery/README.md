# Aulós WebMCP Discovery

Plugin de WordPress que expone tres herramientas WebMCP de solo lectura para
descubrir artículos gratuitos del Zine, consultar ediciones del catálogo y
construir rutas de lectura gratuitas con ediciones relacionadas.

## Instalación en staging

1. Recuperar y anotar el estado actual del plugin en el entorno de staging.
2. Crear un ZIP que contenga únicamente el directorio
   `aulos-webmcp-discovery`.
3. Subirlo mediante el instalador autenticado de plugins de WordPress.
4. Activarlo solo cuando WordPress confirme que la instalación terminó.

## Comprobación

Habilitar la función de prueba de WebMCP en Chrome o el *origin trial* vigente.
En el panel WebMCP de DevTools deben aparecer:

- `explorar_contenidos`
- `buscar_ediciones`
- `recomendar_ruta_de_lectura`

Comprobar una consulta válida y otra vacía para cada herramienta. Los resultados
deben enlazar únicamente contenido público del mismo origen. Ninguna invocación
debe modificar el carrito ni requerir una cuenta.

## Reversión

Desactivar el plugin. La web, el Zine, el catálogo y el flujo de compra seguirán
funcionando sin las herramientas WebMCP.
