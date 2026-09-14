// Paginación contra el tope de filas de PostgREST.
//
// La API de Supabase corta TODA respuesta en el "Max rows" del proyecto —aquí
// 1.000 filas— y `.limit(n)` con una n mayor NO lo levanta: es un tope de
// servidor, no una preferencia del cliente. Una consulta que espera más filas
// de las que caben no da error: devuelve un resultado truncado, callado y
// plausible.
//
// Así estuvo roto el alta durante meses. `/registro` pedía los 7.718 municipios
// elegibles con `.limit(20000)`, recibía los 1.000 primeros por orden
// alfabético, y el buscador sólo conocía de "Ababuj" a "Beleña". Quien vivía en
// Casabermeja, Esporles o Villafranca del Bierzo no encontraba su pueblo y no
// podía darse de alta, sin que nada fallara por ninguna parte.
//
// `fetchAllRows` pagina con `.range()` hasta agotar los resultados. El orden es
// OBLIGATORIO en la consulta que se le pase: sin un orden estable, dos páginas
// consecutivas pueden repetir u omitir filas.
//
//   const filas = await fetchAllRows((from, to) =>
//     supabase.from("municipalities").select("code,name").order("code").range(from, to),
//   );

export const POSTGREST_MAX_ROWS = 1000;

type Page<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => Page<T>,
  options: { pageSize?: number; maxRows?: number } = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? POSTGREST_MAX_ROWS;
  // Cota de seguridad: si el servidor devolviera páginas llenas
  // indefinidamente, esto para en vez de colgar la pestaña.
  const maxRows = options.maxRows ?? 100_000;

  const out: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    // Una página incompleta significa que no hay más.
    if (rows.length < pageSize) break;
  }
  return out;
}
