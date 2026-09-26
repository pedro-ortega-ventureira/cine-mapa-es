import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteMyFilmographyItem,
  getMyFilmography,
  reorderMyFilmography,
  upsertMyFilmographyItem,
} from "@/lib/public-registration.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Database } from "@/integrations/supabase/types";

type FilmographyRow = Database["public"]["Tables"]["filmography_items"]["Row"];

type FilmographyDraft = {
  title: string;
  year: string;
  type: "movie" | "tv" | "short" | "other";
  role_in_production: string;
  countries: string;
  genre: string;
  external_url: string;
  poster_url: string;
};

const emptyDraft: FilmographyDraft = {
  title: "",
  year: "",
  type: "other",
  role_in_production: "",
  countries: "",
  genre: "",
  external_url: "",
  poster_url: "",
};

function rowToDraft(row: FilmographyRow): FilmographyDraft {
  return {
    title: row.title,
    year: row.year == null ? "" : String(row.year),
    type: row.type,
    role_in_production: row.role_in_production ?? "",
    countries: (row.countries ?? []).join(", "),
    genre: row.genre ?? "",
    external_url: row.external_url ?? "",
    poster_url: row.poster_url ?? "",
  };
}

export function FilmographyEditor({ profileExists }: { profileExists: boolean }) {
  const queryClient = useQueryClient();
  const getFilmography = useServerFn(getMyFilmography);
  const upsertFilmography = useServerFn(upsertMyFilmographyItem);
  const deleteFilmography = useServerFn(deleteMyFilmographyItem);
  const reorderFilmography = useServerFn(reorderMyFilmography);
  const [adding, setAdding] = useState(false);

  const filmographyQuery = useQuery({
    queryKey: ["my-filmography"],
    enabled: profileExists,
    queryFn: () => getFilmography(),
  });

  const rows = (filmographyQuery.data ?? []) as FilmographyRow[];

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["my-filmography"] });
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const itemIds = rows.map((row) => row.id);
    [itemIds[index], itemIds[target]] = [itemIds[target], itemIds[index]];
    try {
      await reorderFilmography({ data: { item_ids: itemIds } });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo reordenar");
    }
  }

  async function remove(row: FilmographyRow) {
    if (!window.confirm(`¿Eliminar «${row.title}» de tus producciones destacadas?`)) return;
    try {
      await deleteFilmography({ data: { id: row.id } });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Producciones destacadas</h2>
          <p className="text-sm text-muted-foreground">
            Añade hasta cinco trabajos. El rol desempeñado es obligatorio.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!profileExists || adding || rows.length >= 5}
          onClick={() => setAdding(true)}
        >
          <Plus className="mr-1 h-4 w-4" /> Añadir producción
        </Button>
      </div>

      {!profileExists && (
        <p className="rounded-md border bg-secondary/30 p-3 text-sm text-muted-foreground">
          Guarda primero tu ficha para poder añadir producciones.
        </p>
      )}
      {profileExists && filmographyQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Cargando producciones…</p>
      )}
      {profileExists && filmographyQuery.isError && (
        <p className="text-sm text-destructive">No se han podido cargar tus producciones.</p>
      )}

      {rows.map((row, index) => (
        <FilmographyCard
          key={row.id}
          initialDraft={rowToDraft(row)}
          onSave={async (draft) => {
            await upsertFilmography({ data: { id: row.id, item: draftToInput(draft, index) } });
            await refresh();
          }}
          onDelete={() => remove(row)}
          onMoveUp={index > 0 ? () => move(index, -1) : undefined}
          onMoveDown={index < rows.length - 1 ? () => move(index, 1) : undefined}
        />
      ))}

      {adding && (
        <FilmographyCard
          initialDraft={emptyDraft}
          isNew
          onSave={async (draft) => {
            await upsertFilmography({
              data: { item: draftToInput(draft, rows.length) },
            });
            setAdding(false);
            await refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </section>
  );
}

function draftToInput(draft: FilmographyDraft, sortOrder: number) {
  return {
    title: draft.title,
    year: Number.parseInt(draft.year, 10),
    type: draft.type,
    role_in_production: draft.role_in_production,
    countries: draft.countries
      .split(",")
      .map((country) => country.trim())
      .filter(Boolean),
    genre: draft.genre || null,
    external_url: draft.external_url || null,
    poster_url: draft.poster_url || null,
    sort_order: sortOrder,
  };
}

function FilmographyCard({
  initialDraft,
  isNew = false,
  onSave,
  onDelete,
  onCancel,
  onMoveUp,
  onMoveDown,
}: {
  initialDraft: FilmographyDraft;
  isNew?: boolean;
  onSave: (draft: FilmographyDraft) => Promise<void>;
  onDelete?: () => void;
  onCancel?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(initialDraft), [initialDraft]);

  async function save() {
    if (!draft.title.trim() || !draft.year.trim() || !draft.role_in_production.trim()) {
      toast.error("Título, año y rol desempeñado son obligatorios");
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      toast.success(isNew ? "Producción añadida" : "Producción actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la producción");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{isNew ? "Nueva producción" : draft.title || "Producción"}</h3>
        {!isNew && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!onMoveUp}
              onClick={onMoveUp}
            >
              <ArrowUp className="h-4 w-4" />
              <span className="sr-only">Subir</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={!onMoveDown}
              onClick={onMoveDown}
            >
              <ArrowDown className="h-4 w-4" />
              <span className="sr-only">Bajar</span>
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="sr-only">Eliminar</span>
            </Button>
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Título *"
          value={draft.title}
          onChange={(title) => setDraft({ ...draft, title })}
        />
        <Field
          label="Año *"
          type="number"
          value={draft.year}
          onChange={(year) => setDraft({ ...draft, year })}
        />
        <div>
          <Label>Tipo</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
            value={draft.type}
            onChange={(event) =>
              setDraft({ ...draft, type: event.target.value as FilmographyDraft["type"] })
            }
          >
            <option value="movie">Largometraje</option>
            <option value="tv">Televisión / serie</option>
            <option value="short">Cortometraje</option>
            <option value="other">Otro</option>
          </select>
        </div>
        <Field
          label="Rol desempeñado *"
          value={draft.role_in_production}
          onChange={(role_in_production) => setDraft({ ...draft, role_in_production })}
        />
        <Field
          label="País o países (separados por comas)"
          value={draft.countries}
          onChange={(countries) => setDraft({ ...draft, countries })}
        />
        <Field
          label="Género"
          value={draft.genre}
          onChange={(genre) => setDraft({ ...draft, genre })}
        />
        <Field
          label="URL de la producción"
          type="url"
          value={draft.external_url}
          onChange={(external_url) => setDraft({ ...draft, external_url })}
        />
        <Field
          label="URL del cartel o portada"
          type="url"
          value={draft.poster_url}
          onChange={(poster_url) => setDraft({ ...draft, poster_url })}
        />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar producción"}
        </Button>
      </div>
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "url";
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
