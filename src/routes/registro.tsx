import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import {
  getMyProfessional,
  registerProfessional,
  updateMyProfessional,
} from "@/lib/public-registration.functions";
import { PRIMARY_ROLES, PRODUCTION_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Film, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/registro")({
  ssr: false,
  component: RegistroPage,
});

const selectClass = "w-full rounded-md border border-input px-2 py-2 text-sm bg-background";

type FormState = {
  full_name: string;
  alias: string;
  photo_url: string;
  birth_year: string;
  gender: string;
  nationality: string;
  email: string;
  phone: string;
  website: string;
  municipality_code: string;
  raw_postal_code: string;
  primary_role: string;
  secondary_roles: string[];
  production_types: string[];
  bio: string;
  years_of_experience: string;
  languages: string;
  availability: string;
  works_remotely: boolean;
  willing_to_travel: boolean;
  reel_url: string;
  equipment_owned: string;
  union_membership: string;
  nif_cif: string;
  tags: string;
};

const emptyForm: FormState = {
  full_name: "",
  alias: "",
  photo_url: "",
  birth_year: "",
  gender: "",
  nationality: "",
  email: "",
  phone: "",
  website: "",
  municipality_code: "",
  raw_postal_code: "",
  primary_role: "",
  secondary_roles: [],
  production_types: [],
  bio: "",
  years_of_experience: "",
  languages: "",
  availability: "",
  works_remotely: false,
  willing_to_travel: false,
  reel_url: "",
  equipment_owned: "",
  union_membership: "",
  nif_cif: "",
  tags: "",
};

function rowToForm(row: any): FormState {
  return {
    full_name: row.full_name ?? "",
    alias: row.alias ?? "",
    photo_url: row.photo_url ?? "",
    birth_year: row.birth_year != null ? String(row.birth_year) : "",
    gender: row.gender ?? "",
    nationality: row.nationality ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    website: row.website ?? "",
    municipality_code: row.municipality_code ?? "",
    raw_postal_code: row.raw_postal_code ?? "",
    primary_role: row.primary_role ?? "",
    secondary_roles: row.secondary_roles ?? [],
    production_types: row.production_types ?? [],
    bio: row.bio ?? "",
    years_of_experience: row.years_of_experience != null ? String(row.years_of_experience) : "",
    languages: (row.languages ?? []).join(", "),
    availability: row.availability ?? "",
    works_remotely: !!row.works_remotely,
    willing_to_travel: !!row.willing_to_travel,
    reel_url: row.reel_url ?? "",
    equipment_owned: (row.equipment_owned ?? []).join(", "),
    union_membership: row.union_membership ?? "",
    nif_cif: row.nif_cif ?? "",
    tags: (row.tags ?? []).join(", "),
  };
}

function RegistroPage() {
  const [session, setSession] = useState<any>(undefined);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [existing, setExisting] = useState<any | null | undefined>(undefined);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const getMineFn = useServerFn(getMyProfessional);
  const registerFn = useServerFn(registerProfessional);
  const updateFn = useServerFn(updateMyProfessional);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const row = await getMineFn();
        setExisting(row);
        setForm(row ? rowToForm(row) : { ...emptyForm, email: session.user?.email ?? "" });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo cargar tu perfil");
      }
    })();
  }, [session]);

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { emailRedirectTo: window.location.origin + "/registro" },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Ahora completa tu perfil abajo.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signInGoogle() {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/registro",
    });
    if (r.error) toast.error("No se pudo iniciar sesión con Google");
  }

  function toggleArrayField(field: "secondary_roles" | "production_types", value: string) {
    setForm((f) => {
      const arr = f[field];
      return {
        ...f,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        alias: form.alias || null,
        photo_url: form.photo_url || null,
        birth_year: form.birth_year ? parseInt(form.birth_year) : null,
        gender: form.gender || null,
        nationality: form.nationality || null,
        email: form.email || null,
        phone: form.phone || null,
        website: form.website || null,
        municipality_code: form.municipality_code || null,
        raw_postal_code: form.raw_postal_code || null,
        primary_role: form.primary_role || null,
        secondary_roles: form.secondary_roles,
        production_types: form.production_types,
        bio: form.bio || null,
        years_of_experience: form.years_of_experience ? parseInt(form.years_of_experience) : null,
        languages: form.languages
          ? form.languages.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        availability: form.availability || null,
        works_remotely: form.works_remotely,
        willing_to_travel: form.willing_to_travel,
        reel_url: form.reel_url || null,
        equipment_owned: form.equipment_owned
          ? form.equipment_owned.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        union_membership: form.union_membership || null,
        nif_cif: form.nif_cif || null,
        tags: form.tags ? form.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      };
      if (existing) {
        const row = await updateFn({ data: payload });
        setExisting(row);
        toast.success("Perfil actualizado");
      } else {
        const row = await registerFn({ data: payload });
        setExisting(row);
        toast.success("¡Perfil publicado! Ya apareces en el directorio.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (session === undefined) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">Cargando…</div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
            <Film className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Únete al directorio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Regístrate gratis y publica tu perfil profesional en el directorio audiovisual rural.
          </p>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-3 border rounded-lg p-6 bg-card">
          <div>
            <Label htmlFor="reg-email">Email</Label>
            <Input
              id="reg-email"
              type="email"
              required
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="reg-password">Contraseña</Label>
            <Input
              id="reg-password"
              type="password"
              required
              minLength={6}
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={authLoading} className="w-full">
            {authLoading ? "…" : authMode === "signin" ? "Entrar" : "Crear cuenta y continuar"}
          </Button>
          <Button type="button" variant="outline" onClick={signInGoogle} className="w-full">
            Continuar con Google
          </Button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
            onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
          >
            {authMode === "signin" ? "¿No tienes cuenta? Crear una" : "¿Ya tienes cuenta? Entrar"}
          </button>
        </form>
      </div>
    );
  }

  if (existing === undefined) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
        Cargando tu perfil…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Film className="h-6 w-6 text-primary" />
          {existing ? "Tu perfil profesional" : "Publica tu perfil"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {existing
            ? "Edita tus datos cuando quieras. Los cambios se publican al instante."
            : "Es gratis y se publica al instante en el directorio, sin esperas ni revisión."}
        </p>
        {existing && (
          <p className="text-sm text-emerald-600 flex items-center gap-1 mt-2">
            <CheckCircle2 className="h-4 w-4" /> Tu perfil está publicado y visible en el directorio.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-3">
          <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Datos personales
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Nombre completo *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Alias / nombre artístico</Label>
              <Input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
            </div>
            <div>
              <Label>Foto (URL)</Label>
              <Input
                value={form.photo_url}
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
              />
            </div>
            <div>
              <Label>Año de nacimiento</Label>
              <Input
                type="number"
                value={form.birth_year}
                onChange={(e) => setForm({ ...form, birth_year: e.target.value })}
              />
            </div>
            <div>
              <Label>Género</Label>
              <select
                className={selectClass}
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">—</option>
                <option value="Hombre">Hombre</option>
                <option value="Mujer">Mujer</option>
                <option value="No binario">No binario</option>
                <option value="Prefiero no decirlo">Prefiero no decirlo</option>
              </select>
            </div>
            <div>
              <Label>Nacionalidad</Label>
              <Input
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Ubicación y contacto
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Código postal</Label>
              <Input
                value={form.raw_postal_code}
                onChange={(e) => setForm({ ...form, raw_postal_code: e.target.value })}
                placeholder="p.ej. 28001"
              />
            </div>
            <div>
              <Label>Municipio (código)</Label>
              <Input
                value={form.municipality_code}
                onChange={(e) => setForm({ ...form, municipality_code: e.target.value })}
                placeholder="p.ej. madrid-madrid"
              />
            </div>
            <div>
              <Label>Email de contacto</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Web</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div>
              <Label>Reel / vídeo</Label>
              <Input
                value={form.reel_url}
                onChange={(e) => setForm({ ...form, reel_url: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Actividad profesional
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Rol principal</Label>
              <select
                className={selectClass}
                value={form.primary_role}
                onChange={(e) => setForm({ ...form, primary_role: e.target.value })}
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
              <Label>Disponibilidad</Label>
              <select
                className={selectClass}
                value={form.availability}
                onChange={(e) => setForm({ ...form, availability: e.target.value })}
              >
                <option value="">—</option>
                <option value="Disponible">Disponible</option>
                <option value="No disponible">No disponible</option>
                <option value="Bajo consulta">Bajo consulta</option>
              </select>
            </div>
            <div>
              <Label>Años de experiencia</Label>
              <Input
                type="number"
                value={form.years_of_experience}
                onChange={(e) => setForm({ ...form, years_of_experience: e.target.value })}
              />
            </div>
            <div>
              <Label>Colegiación / sindicato</Label>
              <Input
                value={form.union_membership}
                onChange={(e) => setForm({ ...form, union_membership: e.target.value })}
              />
            </div>
            <div>
              <Label>Idiomas (separados por comas)</Label>
              <Input
                value={form.languages}
                onChange={(e) => setForm({ ...form, languages: e.target.value })}
                placeholder="Español, Inglés…"
              />
            </div>
            <div>
              <Label>Equipo propio (separado por comas)</Label>
              <Input
                value={form.equipment_owned}
                onChange={(e) => setForm({ ...form, equipment_owned: e.target.value })}
                placeholder="Cámara, dron…"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.works_remotely}
                onChange={(e) => setForm({ ...form, works_remotely: e.target.checked })}
              />
              Trabaja en remoto
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.willing_to_travel}
                onChange={(e) => setForm({ ...form, willing_to_travel: e.target.checked })}
              />
              Dispuesto/a a viajar
            </label>
          </div>

          <div>
            <Label className="mb-1 block">Roles secundarios</Label>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {PRIMARY_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.secondary_roles.includes(r)}
                    onChange={() => toggleArrayField("secondary_roles", r)}
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-1 block">Tipos de producción</Label>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {PRODUCTION_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.production_types.includes(t)}
                    onChange={() => toggleArrayField("production_types", t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Sobre ti
          </h2>
          <div>
            <Label>Biografía</Label>
            <Textarea rows={5} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
          <div>
            <Label>Etiquetas (separadas por comas)</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div>
            <Label>NIF/CIF (opcional, solo visible para administración)</Label>
            <Input value={form.nif_cif} onChange={(e) => setForm({ ...form, nif_cif: e.target.value })} />
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : existing ? "Guardar cambios" : "Publicar mi perfil"}
          </Button>
        </div>
      </form>
    </div>
  );
}
