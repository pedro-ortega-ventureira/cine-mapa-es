import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

import {
  getMyProfessional,
  registerProfessional,
  updateMyProfessional,
} from "@/lib/public-registration.functions";
import { PRIMARY_ROLES, PRODUCTION_TYPES } from "@/lib/constants";
import { municipalityResolution, postalCodeForLookup } from "@/lib/postal-code";
import { isValidEmail, RESET_SENT_MESSAGE, validateNewPassword } from "@/lib/password-recovery";
import {
  afterPasswordRecoveryUpdate,
  afterSignUp,
  SIGNUP_CONFIRM_MESSAGE,
} from "@/lib/auth-flow";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Film, CheckCircle2, Info } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/registro")({
  ssr: false,
  component: RegistroPage,
});

const selectClass = "w-full rounded-md border border-input px-2 py-2 text-sm bg-background";

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-muted-foreground">{children}</p>;
}

// El directorio solo admite profesionales residentes en municipios de menos de
// 20.000 habitantes, así que el buscador solo ofrece esos. El municipio se
// cruza por nombre normalizado (sin acentos) o por código postal contra la
// tabla `municipalities`, sin datos externos.
const MAX_MUNICIPALITY_POPULATION = 20000;

type MunicipalityLite = {
  code: string;
  name: string;
  province: string;
  population: number | null;
  postal_codes: string[] | null;
};

type ProfessionalRow = Database["public"]["Tables"]["professionals"]["Row"];

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

function rowToForm(row: ProfessionalRow): FormState {
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
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [signupPending, setSignupPending] = useState(false);


  // Al volver desde el enlace del email, Supabase emite PASSWORD_RECOVERY.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleForgotPassword() {
    if (!isValidEmail(authEmail)) {
      toast.error("Escribe tu email para enviarte el enlace");
      return;
    }
    setResetting(true);
    try {
      await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
        redirectTo: `${window.location.origin}/registro`,
      });
    } finally {
      setResetting(false);
      // Mensaje genérico siempre: no se enumeran cuentas.
      toast.success(RESET_SENT_MESSAGE);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateNewPassword(newPassword, newPassword2);
    if (problem) {
      toast.error(problem);
      return;
    }
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      const action = afterPasswordRecoveryUpdate();
      setNewPassword("");
      setNewPassword2("");
      setRecoveryMode(false);
      // No se entra a la plataforma con la sesión de recuperación.
      if (action.signOut) await supabase.auth.signOut();
      setAuthMode("signin");
      toast.success(action.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setAuthLoading(false);
    }
  }


  const [existing, setExisting] = useState<ProfessionalRow | null | undefined>(undefined);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [autoFilledFromCp, setAutoFilledFromCp] = useState(false);

  // La API de Supabase pagina las respuestas grandes, por lo que el listado
  // general no es fiable para resolver un CP. Se consulta el CP exacto en la
  // base de datos para que municipios de cualquier letra se puedan encontrar.
  const postalCode = postalCodeForLookup(form.raw_postal_code);
  const cpMatchesQ = useQuery({
    queryKey: ["municipalities-by-postal-code", postalCode],
    enabled: postalCode !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("code,name,province,population,postal_codes")
        .lt("population", MAX_MUNICIPALITY_POPULATION)
        .contains("postal_codes", [postalCode!])
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as MunicipalityLite[];
    },
    staleTime: 10 * 60_000,
  });

  const cpMatches = useMemo(() => cpMatchesQ.data ?? [], [cpMatchesQ.data]);

  // Ya no hay listado completo en memoria, así que el municipio seleccionado
  // puede no estar ni en los resultados de la búsqueda ni en los del código
  // postal (por ejemplo al abrir un perfil ya guardado): se pide por su código.
  const selectedMunicipalityQ = useQuery({
    queryKey: ["municipality", form.municipality_code],
    enabled: !!form.municipality_code,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("code,name,province,population,postal_codes")
        .eq("code", form.municipality_code)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as MunicipalityLite | null;
    },
    staleTime: 30 * 60_000,
  });

  const selectedMunicipality = form.municipality_code
    ? (cpMatches.find((municipality) => municipality.code === form.municipality_code) ??
      selectedMunicipalityQ.data ??
      null)
    : null;

  // El código postal manda: selecciona el único municipio asociado y, si hay
  // varios, conserva únicamente una elección que pertenezca a ese código.
  useEffect(() => {
    if (!postalCode || cpMatchesQ.isFetching) return;
    const resolution = municipalityResolution(cpMatches.map((municipality) => municipality.code));
    if (resolution.kind === "selected") {
      setForm((f) => ({ ...f, municipality_code: resolution.municipalityCode }));
      setAutoFilledFromCp(true);
      return;
    }
    const selectedMatchesPostalCode = cpMatches.some(
      (municipality) => municipality.code === form.municipality_code,
    );
    if (!selectedMatchesPostalCode) {
      setForm((f) => ({ ...f, municipality_code: "" }));
    }
    setAutoFilledFromCp(false);
  }, [postalCode, cpMatches, cpMatchesQ.isFetching, form.municipality_code]);

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
  }, [session, getMineFn]);

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
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { emailRedirectTo: window.location.origin + "/registro" },
        });
        if (error) throw error;
        const action = afterSignUp();
        // Aunque el backend devuelva sesión, se cierra: el perfil no se
        // muestra hasta que la cuenta esté confirmada por email.
        if (action.signOut && data.session) await supabase.auth.signOut();
        setSession(null);
        setAuthMode("signin");
        setAuthPassword("");
        setSignupPending(true);
        toast.success(action.message);
      }

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setAuthLoading(false);
    }
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
    if (!postalCode) {
      toast.error("El código postal es obligatorio y debe tener 5 dígitos");
      return;
    }
    if (cpMatchesQ.isFetching) {
      toast.error("Espera a que comprobemos el código postal");
      return;
    }
    if (cpMatchesQ.isError) {
      toast.error("No se ha podido comprobar el código postal. Inténtalo de nuevo");
      return;
    }
    if (cpMatches.length === 0) {
      toast.error("El código postal no corresponde a ningún municipio admitido");
      return;
    }
    // El municipio es obligatorio: la base de datos rechaza cualquier alta sin
    // municipio elegible (trigger trg_municipio_menor_20k).
    if (
      !form.municipality_code ||
      !cpMatches.some((municipality) => municipality.code === form.municipality_code)
    ) {
      toast.error("Elige el municipio que corresponde a tu código postal");
      return;
    }
    // Los campos numéricos se envían con parseInt: un valor no numérico daba
    // NaN y el validador del servidor lo rechazaba con un error ilegible.
    const birthYear = form.birth_year.trim() ? Number.parseInt(form.birth_year, 10) : null;
    if (birthYear !== null && !Number.isFinite(birthYear)) {
      toast.error("El año de nacimiento debe ser un número");
      return;
    }
    const yearsExp = form.years_of_experience.trim()
      ? Number.parseInt(form.years_of_experience, 10)
      : null;
    if (yearsExp !== null && !Number.isFinite(yearsExp)) {
      toast.error("Los años de experiencia deben ser un número");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        alias: form.alias || null,
        photo_url: form.photo_url || null,
        birth_year: birthYear,
        gender: form.gender || null,
        nationality: form.nationality || null,
        email: form.email || null,
        phone: form.phone || null,
        website: form.website || null,
        municipality_code: form.municipality_code || null,
        raw_postal_code: form.raw_postal_code.trim() || null,
        primary_role: form.primary_role || null,
        secondary_roles: form.secondary_roles,
        production_types: form.production_types,
        bio: form.bio || null,
        years_of_experience: yearsExp,
        languages: form.languages
          ? form.languages
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        availability: form.availability || null,
        works_remotely: form.works_remotely,
        willing_to_travel: form.willing_to_travel,
        reel_url: form.reel_url || null,
        equipment_owned: form.equipment_owned
          ? form.equipment_owned
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        union_membership: form.union_membership || null,
        nif_cif: form.nif_cif || null,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      };
      const row = existing
        ? await updateFn({ data: payload })
        : await registerFn({ data: payload });
      setExisting(row);
      toast.success(
        existing ? "Perfil actualizado" : "¡Perfil publicado! Ya apareces en el directorio.",
      );
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

  if (recoveryMode) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
            <Film className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Elige una nueva contraseña</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escríbela dos veces para confirmar que coinciden.
          </p>
        </div>
        <form onSubmit={handleUpdatePassword} className="space-y-3 border rounded-lg p-6 bg-card">
          <div>
            <Label htmlFor="reg-new-password">Nueva contraseña</Label>
            <Input
              id="reg-new-password"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="reg-new-password-2">Repite la contraseña</Label>
            <Input
              id="reg-new-password-2"
              type="password"
              required
              minLength={6}
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={authLoading} className="w-full">
            {authLoading ? "…" : "Guardar contraseña"}
          </Button>
        </form>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
            <Film className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Tu ficha en el directorio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Entra con tu cuenta para crear tu ficha o corregir la que ya tienes.
          </p>
        </div>

        {signupPending && (
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            <p className="font-medium">{SIGNUP_CONFIRM_MESSAGE}</p>
            <p className="text-muted-foreground mt-1">
              Te hemos enviado un enlace de confirmación a {authEmail}. Ábrelo y después inicia
              sesión aquí para completar tu ficha.
            </p>
          </div>
        )}



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
          {authMode === "signin" && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
              onClick={handleForgotPassword}
              disabled={resetting}
            >
              {resetting ? "Enviando…" : "¿Has olvidado tu contraseña?"}
            </button>
          )}
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
          {existing ? "Tu ficha profesional" : "Publica tu ficha"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {existing
            ? "Edita tus datos cuando quieras. Los cambios se publican al instante."
            : "Es gratis y se publica al instante en el directorio, sin esperas ni revisión."}
        </p>
        {existing && (
          <p className="text-sm text-emerald-600 flex items-center gap-1 mt-2">
            <CheckCircle2 className="h-4 w-4" /> Tu ficha está publicada y visible en el directorio.
            {existing.slug && (
              <a
                href={`/profesionales/${existing.slug}`}
                className="ml-1 text-primary hover:underline"
              >
                Ver mi ficha
              </a>
            )}
          </p>
        )}
      </div>

      <div className="mb-8 rounded-lg border bg-secondary/30 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-medium">
          <Info className="h-4 w-4 text-primary" /> Cómo rellenar tu ficha
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm marker:text-muted-foreground">
          <li>
            <strong>Rellena primero el código postal.</strong> Es obligatorio y tiene 5 dígitos: es
            lo que identifica tu localidad.
          </li>
          <li>
            <strong>Si el código postal identifica una sola localidad</strong>, se selecciona
            automáticamente. <strong>Si corresponde a varias</strong>, tienes que elegir la tuya en
            la lista antes de guardar.
          </li>
          <li>
            <strong>Nombre y municipio son obligatorios.</strong> Puedes completar el resto más
            adelante.
          </li>
          <li>
            <strong>Elige tus roles y tipos de producción.</strong> Son los filtros con los que te
            encontrarán.
          </li>
        </ol>
        <div className="mt-4 border-t pt-3 text-sm">
          <p>
            <strong>Qué se publica.</strong> Nombre, alias, municipio, código postal, roles,
            biografía, web, showreel y etiquetas.
          </p>
          <p className="mt-1 text-muted-foreground">
            El <strong>email</strong>, el <strong>teléfono</strong> y el <strong>NIF/CIF</strong> no
            son públicos. Los mensajes de contacto los gestiona la administración del directorio.
          </p>
        </div>
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
              <Input
                value={form.alias}
                onChange={(e) => setForm({ ...form, alias: e.target.value })}
              />
            </div>
            <div>
              <Label>Foto (URL)</Label>
              <Input
                value={form.photo_url}
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                placeholder="https://…"
              />
              <Hint>
                Pega la dirección de una foto ya publicada en internet. No se suben archivos.
              </Hint>
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
          <div>
            <Label>Código postal *</Label>
            <Input
              value={form.raw_postal_code}
              onChange={(e) => {
                setForm({
                  ...form,
                  raw_postal_code: e.target.value.trim(),
                  municipality_code: "",
                });
                setAutoFilledFromCp(false);
              }}
              placeholder="p.ej. 15113"
              inputMode="numeric"
              maxLength={5}
              pattern="[0-9]{5}"
              required
            />
            <Hint>
              Obligatorio. El código postal determina la localidad. Si corresponde a un único
              municipio, lo seleccionaremos automáticamente; si corresponde a varios, tendrás que
              elegir el tuyo.
            </Hint>
          </div>
          <div>
            <Label>Municipio de residencia *</Label>
            {!postalCode ? (
              <p className="mt-1 rounded-md border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
                Introduce primero un código postal válido de 5 dígitos.
              </p>
            ) : cpMatchesQ.isFetching ? (
              <p className="mt-1 rounded-md border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
                Comprobando el código postal…
              </p>
            ) : cpMatchesQ.isError ? (
              <p className="mt-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                No se ha podido comprobar el código postal. Inténtalo de nuevo.
              </p>
            ) : cpMatches.length === 0 ? (
              <p className="mt-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Este código postal no corresponde a ningún municipio de menos de{" "}
                {MAX_MUNICIPALITY_POPULATION.toLocaleString("es-ES")} habitantes admitido en el
                directorio.
              </p>
            ) : selectedMunicipality ? (
              <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span>
                  <strong>{selectedMunicipality.name}</strong> ({selectedMunicipality.province}) ·{" "}
                  {(selectedMunicipality.population ?? 0).toLocaleString("es-ES")} hab.
                  {autoFilledFromCp && (
                    <span className="text-muted-foreground"> · detectado por tu código postal</span>
                  )}
                </span>
                {cpMatches.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setForm({ ...form, municipality_code: "" });
                      setAutoFilledFromCp(false);
                    }}
                  >
                    Cambiar
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-1 max-h-56 overflow-auto rounded-md border divide-y">
                <p className="px-3 py-1.5 text-xs text-muted-foreground bg-secondary/40">
                  Varios municipios comparten este código postal. Elige el tuyo:
                </p>
                {cpMatches.map((m) => (
                  <button
                    key={m.code}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/60"
                    onClick={() => {
                      setForm({ ...form, municipality_code: m.code });
                      setAutoFilledFromCp(false);
                    }}
                  >
                    {m.name}{" "}
                    <span className="text-muted-foreground">
                      ({m.province}) · {(m.population ?? 0).toLocaleString("es-ES")} hab.
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Email de contacto</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Hint>No se publica.</Hint>
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Hint>No se publica. Opcional.</Hint>
            </div>
            <div>
              <Label>Web</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
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
            <Textarea
              rows={5}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          <div>
            <Label>Etiquetas (separadas por comas)</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div>
            <Label>NIF/CIF (opcional, solo visible para administración)</Label>
            <Input
              value={form.nif_cif}
              onChange={(e) => setForm({ ...form, nif_cif: e.target.value })}
            />
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
