import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  setVerified,
  deleteProfessional,
  upsertProfessional,
  backfillMunicipalities,
  bulkVerifyAll,
  listProfessionalsAdmin,
} from "@/lib/professionals.functions";
import { resolveProfessionalGeo } from "@/lib/professionals-geo.functions";
import { linkTmdbPerson, importTmdbFilmography } from "@/lib/tmdb-import.functions";
import { tmdbSearchPerson, type TmdbPersonResult } from "@/lib/tmdb";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, MapPin, ShieldCheck, Film, Link2, Unlink } from "lucide-react";
import { PRIMARY_ROLES, PRODUCTION_TYPES, slugify } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/admin/profesionales")({
  component: AdminPros,
});


function AdminPros() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const setVerifiedFn = useServerFn(setVerified);
  const deleteFn = useServerFn(deleteProfessional);
  const backfillFn = useServerFn(backfillMunicipalities);
  const verifyAllFn = useServerFn(bulkVerifyAll);
  const resolveGeoFn = useServerFn(resolveProfessionalGeo);
  const listFn = useServerFn(listProfessionalsAdmin);
  const [busy, setBusy] = useState<string | null>(null);

  const profsQ = useQuery({
    queryKey: ["admin-professionals", search],
    queryFn: async () => listFn({ data: { search: search || undefined } }),
  });

  async function toggleVerified(id: string, current: boolean) {
    await setVerifiedFn({ data: { id, verified: !current } });
    qc.invalidateQueries({ queryKey: ["admin-professionals"] });
    qc.invalidateQueries({ queryKey: ["professionals"] });
    toast.success(current ? "Desmarcado" : "Verificado");
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este profesional? Esta acción no se puede deshacer.")) return;
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin-professionals"] });
    toast.success("Eliminado");
  }

  function openCreate() {
    setEditing({
      full_name: "",
      primary_role: "",
      email: "",
      bio: "",
      secondary_roles: [],
      production_types: [],
      verified: true,
    });
    setDialogOpen(true);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-2xl font-semibold">Profesionales</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("backfill");
              try {
                const r = await backfillFn({});
                toast.success(
                  `CPs: ${r.resolved} resueltos · ${r.ambiguous} ambiguos · ${r.missing} sin match`,
                );
                qc.invalidateQueries({ queryKey: ["admin-professionals"] });
                qc.invalidateQueries({ queryKey: ["municipality_stats"] });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              } finally {
                setBusy(null);
              }
            }}
          >
            <MapPin className="h-4 w-4 mr-2" />
            {busy === "backfill" ? "Resolviendo…" : "Resolver CPs"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("geo");
              try {
                const r = await resolveGeoFn({});
                if (!r.ok) throw new Error("Fallo");
                toast.success(
                  `Geo: ${r.exact} exactos · ${r.province} aproximados · ${r.none} sin CP`,
                );
                qc.invalidateQueries({ queryKey: ["admin-professionals"] });
                qc.invalidateQueries({ queryKey: ["map-professionals"] });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              } finally {
                setBusy(null);
              }
            }}
          >
            <MapPin className="h-4 w-4 mr-2" />
            {busy === "geo" ? "Geolocalizando…" : "Resolver geolocalización"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={async () => {
              if (!confirm("¿Verificar TODOS los profesionales no verificados?")) return;
              setBusy("verify");
              try {
                const r = await verifyAllFn({});
                toast.success(`${r.verified} fichas verificadas`);
                qc.invalidateQueries({ queryKey: ["admin-professionals"] });
                qc.invalidateQueries({ queryKey: ["municipality_stats"] });
                qc.invalidateQueries({ queryKey: ["home-stats"] });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              } finally {
                setBusy(null);
              }
            }}
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            {busy === "verify" ? "Verificando…" : "Verificar todo"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Nuevo
              </Button>
            </DialogTrigger>
            {editing && (
              <EditDialog
                value={editing}
                onDone={() => {
                  setDialogOpen(false);
                  setEditing(null);
                  qc.invalidateQueries({ queryKey: ["admin-professionals"] });
                }}
              />
            )}
          </Dialog>
        </div>
      </div>


      <Input
        placeholder="Buscar por nombre…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-sm"
      />

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left">
            <tr>
              <th className="p-2">Nombre</th>
              <th className="p-2">Rol</th>
              <th className="p-2">Municipio / CP</th>
              <th className="p-2">Email</th>
              <th className="p-2">Verificado</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {(profsQ.data ?? []).map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="p-2 font-medium">{p.full_name}</td>
                <td className="p-2 text-muted-foreground">{p.primary_role ?? "—"}</td>
                <td className="p-2 text-muted-foreground">
                  {p.municipality_code ?? p.raw_postal_code ?? "—"}
                </td>
                <td className="p-2 text-muted-foreground text-xs">{p.email ?? "—"}</td>
                <td className="p-2">
                  <button onClick={() => toggleVerified(p.id, p.verified)}>
                    {p.verified ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => {
                      setEditing(p);
                      setDialogOpen(true);
                    }}
                    className="p-1 hover:bg-secondary rounded"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-1 hover:bg-destructive/10 text-destructive rounded ml-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {profsQ.isError && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-destructive text-sm">
                  Error cargando profesionales: {profsQ.error instanceof Error ? profsQ.error.message : "desconocido"}
                </td>
              </tr>
            )}
            {!profsQ.isError && (profsQ.data ?? []).length === 0 && !profsQ.isLoading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Sin profesionales aún. Importa un Excel o crea uno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditDialog({ value, onDone }: { value: any; onDone: () => void }) {
  const [form, setForm] = useState<any>({ ...value });
  const [saving, setSaving] = useState(false);
  const upsertFn = useServerFn(upsertProfessional);

  async function save() {
    setSaving(true);
    try {
      const slug = form.slug || `${slugify(form.full_name)}-${Math.random().toString(36).slice(2, 6)}`;
      await upsertFn({ data: { ...form, slug } });
      toast.success("Guardado");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{value.id ? "Editar profesional" : "Nuevo profesional"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nombre completo *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>Alias</Label>
            <Input value={form.alias ?? ""} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Rol principal</Label>
            <select
              value={form.primary_role ?? ""}
              onChange={(e) => setForm({ ...form, primary_role: e.target.value })}
              className="w-full rounded-md border border-input px-2 py-2 text-sm"
            >
              <option value="">—</option>
              {PRIMARY_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Municipio (código)</Label>
            <Input
              value={form.municipality_code ?? ""}
              onChange={(e) => setForm({ ...form, municipality_code: e.target.value })}
              placeholder="p.ej. madrid-madrid"
            />
          </div>
          <div>
            <Label>Código Postal (crudo)</Label>
            <Input
              value={form.raw_postal_code ?? ""}
              onChange={(e) => setForm({ ...form, raw_postal_code: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Foto (URL)</Label>
          <Input value={form.photo_url ?? ""} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
        </div>
        <div>
          <Label>Biografía</Label>
          <Textarea rows={4} value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </div>
        <div>
          <Label>Tipos de producción</Label>
          <div className="grid grid-cols-2 gap-1 mt-1 max-h-40 overflow-y-auto border rounded p-2">
            {PRODUCTION_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={(form.production_types ?? []).includes(t)}
                  onChange={(e) => {
                    const arr = new Set(form.production_types ?? []);
                    if (e.target.checked) arr.add(t);
                    else arr.delete(t);
                    setForm({ ...form, production_types: [...arr] });
                  }}
                />
                {t}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!form.verified}
            onChange={(e) => setForm({ ...form, verified: e.target.checked })}
          />
          Verificado (visible al público)
        </label>

        {form.id ? (
          <TmdbLinkSection
            professionalId={form.id}
            fullName={form.full_name}
            tmdbPersonId={form.tmdb_person_id ?? null}
            onLinked={(id) => setForm({ ...form, tmdb_person_id: id })}
          />
        ) : (
          <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
            Guarda primero al profesional para poder vincularlo con TMDB y traer su filmografía.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onDone}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.full_name}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

function TmdbLinkSection({
  professionalId,
  fullName,
  tmdbPersonId,
  onLinked,
}: {
  professionalId: string;
  fullName: string;
  tmdbPersonId: number | null;
  onLinked: (id: number | null) => void;
}) {
  const [query, setQuery] = useState(fullName);
  const [results, setResults] = useState<TmdbPersonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const linkFn = useServerFn(linkTmdbPerson);
  const importFn = useServerFn(importTmdbFilmography);

  async function doSearch() {
    setSearching(true);
    try {
      setResults(await tmdbSearchPerson(query));
      setSearched(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error buscando en TMDB");
    } finally {
      setSearching(false);
    }
  }

  async function link(personId: number | null) {
    setBusy(true);
    try {
      await linkFn({ data: { professional_id: professionalId, tmdb_person_id: personId } });
      onLinked(personId);
      setResults([]);
      toast.success(personId ? "Vinculado con TMDB" : "Desvinculado de TMDB");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function importFilmography() {
    setBusy(true);
    try {
      const r = await importFn({ data: { professional_id: professionalId } });
      toast.success(`${r.imported} créditos importados desde TMDB`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error importando filmografía");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Film className="h-3.5 w-3.5" /> Filmografía TMDB
        </Label>
        {tmdbPersonId && (
          <a
            href={`https://www.themoviedb.org/person/${tmdbPersonId}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Ver persona #{tmdbPersonId} en TMDB
          </a>
        )}
      </div>

      {tmdbPersonId ? (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={importFilmography}>
            {busy ? "Importando…" : "Importar / actualizar filmografía"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => link(null)}>
            <Unlink className="h-3.5 w-3.5 mr-1" /> Desvincular
          </Button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearched(false);
              }}
              placeholder="Nombre a buscar en TMDB…"
            />
            <Button type="button" size="sm" disabled={searching} onClick={doSearch}>
              {searching ? "Buscando…" : "Buscar"}
            </Button>
          </div>
          {searched && !searching && results.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No se encontraron resultados en TMDB para "{query}".
            </p>
          )}
          {results.length > 0 && (
            <ul className="divide-y border rounded max-h-56 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id} className="flex items-center gap-2 p-2 text-sm">
                  {r.profile_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w92${r.profile_path}`}
                      alt=""
                      className="h-10 w-10 rounded object-cover shrink-0"
                    />
                  ) : (
                    <span className="h-10 w-10 rounded bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.known_for_department ?? "—"} ·{" "}
                      {(r.known_for ?? [])
                        .map((k) => k.title ?? k.name)
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(", ")}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => link(r.id)}>
                    <Link2 className="h-3.5 w-3.5 mr-1" /> Vincular
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">
            Comprueba bien la foto y los títulos antes de vincular — hay mucha gente con el mismo nombre en TMDB.
          </p>
        </>
      )}
    </div>
  );
}
