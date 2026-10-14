(() => {
  'use strict';

  const modelContext = document.modelContext;
  if (!modelContext || typeof modelContext.registerTool !== 'function') {
    return;
  }

  const config = globalThis.aulosWebMCP;
  if (!config || typeof config.restRoot !== 'string') {
    return;
  }

  const text = (value) => String(value ?? '').trim().slice(0, 160);
  const limit = (value) => Math.min(6, Math.max(1, Number.parseInt(value, 10) || 3));
  const request = async (route, input, mapping, signal) => {
    const url = new URL(route, config.restRoot);
    for (const [source, target] of Object.entries(mapping)) {
      const value = source === 'maximo_resultados' ? limit(input[source]) : text(input[source]);
      if (value !== '') {
        url.searchParams.set(target, String(value));
      }
    }
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) {
      return 'Aulós no pudo recuperar contenido público en este momento.';
    }
    return JSON.stringify(await response.json());
  };

  const commonLimit = {
    type: 'integer',
    minimum: 1,
    maximum: 6,
    default: 3,
    description: 'Número máximo de resultados, entre 1 y 6.',
  };
  const annotations = {
    readOnlyHint: true,
    consequentialHint: false,
    untrustedContentHint: true,
  };

  const tools = [
    {
      name: 'explorar_contenidos',
      description: 'Busca contenidos gratuitos del Zine de Aulós por tema o categoría.',
      inputSchema: {
        type: 'object',
        properties: {
          tema: { type: 'string', maxLength: 160, description: 'Tema cultural que se quiere explorar.' },
          categoria: { type: 'string', maxLength: 160, description: 'Categoría opcional del Zine.' },
          maximo_resultados: commonLimit,
        },
        required: ['tema'],
      },
      annotations,
      execute: (input = {}, { signal } = {}) => request('content', input, {
        tema: 'tema', categoria: 'categoria', maximo_resultados: 'maximo_resultados',
      }, signal),
    },
    {
      name: 'buscar_ediciones',
      description: 'Busca ediciones de pago del catálogo público de Aulós y devuelve enlaces a sus fichas.',
      inputSchema: {
        type: 'object',
        properties: {
          consulta: { type: 'string', maxLength: 160, description: 'Tema, título o autor que se busca.' },
          coleccion: { type: 'string', maxLength: 160, description: 'Colección editorial opcional.' },
          formato: { type: 'string', maxLength: 160, description: 'Formato opcional de la edición.' },
          maximo_resultados: commonLimit,
        },
        required: ['consulta'],
      },
      annotations,
      execute: (input = {}, { signal } = {}) => request('editions', input, {
        consulta: 'consulta', coleccion: 'coleccion', formato: 'formato', maximo_resultados: 'maximo_resultados',
      }, signal),
    },
    {
      name: 'recomendar_ruta_de_lectura',
      description: 'Propone una ruta que empieza con contenido gratuito y añade hasta dos ediciones de pago relacionadas.',
      inputSchema: {
        type: 'object',
        properties: {
          pregunta: { type: 'string', maxLength: 160, description: 'Pregunta cultural del lector.' },
          interes: { type: 'string', maxLength: 160, description: 'Interés temático complementario.' },
          maximo_resultados: commonLimit,
        },
        required: ['pregunta'],
      },
      annotations,
      execute: (input = {}, { signal } = {}) => request('reading-route', input, {
        pregunta: 'pregunta', interes: 'interes', maximo_resultados: 'maximo_resultados',
      }, signal),
    },
  ];

  for (const tool of tools) {
    modelContext.registerTool(tool);
  }
})();
