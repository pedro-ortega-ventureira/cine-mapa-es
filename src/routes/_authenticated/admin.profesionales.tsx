import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  setVerified,
  deleteProfessional,
  upsertProfessional,
  backfillMunicipalities,
  bulkVerifyAll,
} from "@/lib/professionals.functions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, MapPin, ShieldCheck } from "lucide-react";
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
  const [busy, setBusy] = useState<string | null>(null);


  const profsQ = useQuery({
    queryKey: ["admin-professionals", search],
    queryFn: async () => {
      let q = supabase
        .from("professionals")
        .select("*")
        .order("date_joined", { ascending: false })
        .limit(200);
      if (search) q = q.ilike("full_name", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
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
            {(profsQ.data ?? []).length === 0 && !profsQ.isLoading && (
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
