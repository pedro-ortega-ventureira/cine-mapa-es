import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Film } from "lucide-react";
import { isValidEmail, RESET_SENT_MESSAGE, validateNewPassword } from "@/lib/password-recovery";
import {
  ACCOUNT_CONFIRMED_MESSAGE,
  afterEmailConfirmation,
  afterPasswordRecoveryUpdate,
  afterSignUp,
  SIGNUP_CONFIRM_MESSAGE,
} from "@/lib/auth-flow";
import { INITIAL_AUTH_LINK_TYPE } from "@/lib/auth-hash";

import { validateAuthSearch } from "@/lib/auth-search";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: validateAuthSearch,
  beforeLoad: async ({ search }) => {
    // Al volver desde el enlace del email hay sesión de recuperación o de
    // confirmación: no se debe saltar al panel.
    if (search.recovery) return;
    if (INITIAL_AUTH_LINK_TYPE === "recovery" || INITIAL_AUTH_LINK_TYPE === "signup") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/admin" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { recovery } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(
    () => recovery === true || INITIAL_AUTH_LINK_TYPE === "recovery",
  );
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [signupPending, setSignupPending] = useState(false);
  const [accountConfirmed, setAccountConfirmed] = useState(false);


  useEffect(() => {
    if (recovery) setRecoveryMode(true);
    if (INITIAL_AUTH_LINK_TYPE === "signup") {
      (async () => {
        const action = afterEmailConfirmation();
        if (action.signOut) await supabase.auth.signOut();
        setMode("signin");
        setAccountConfirmed(true);
        toast.success(action.message);
      })();
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [recovery]);


  async function handleForgotPassword() {
    if (!isValidEmail(email)) {
      toast.error("Escribe tu email para enviarte el enlace");
      return;
    }
    setResetting(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth?recovery=1`,
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
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      const action = afterPasswordRecoveryUpdate();
      setRecoveryMode(false);
      setNewPassword("");
      setNewPassword2("");
      // La sesión de recuperación no da acceso al panel.
      if (action.signOut) await supabase.auth.signOut();
      setMode("signin");
      toast.success(action.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/admin" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        const action = afterSignUp();
        // Aunque el backend devuelva sesión, se cierra: primero hay que
        // confirmar la cuenta desde el correo.
        if (action.signOut && data.session) await supabase.auth.signOut();
        setMode("signin");
        setPassword("");
        setSignupPending(true);
        toast.success(action.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
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
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="new-password-2">Repite la contraseña</Label>
            <Input
              id="new-password-2"
              type="password"
              required
              minLength={6}
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "…" : "Guardar contraseña"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="text-center mb-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
          <Film className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">
          {mode === "signin" ? "Acceso administrador" : "Crear cuenta"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Panel de gestión del directorio audiovisual rural
        </p>
      </div>

      {accountConfirmed && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium">{ACCOUNT_CONFIRMED_MESSAGE}</p>
        </div>
      )}

      {signupPending && (

        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium">{SIGNUP_CONFIRM_MESSAGE}</p>
          <p className="text-muted-foreground mt-1">
            Hemos enviado un enlace de confirmación a {email}. Ábrelo y después inicia sesión.
          </p>
        </div>
      )}


      <form onSubmit={handleSubmit} className="space-y-3 border rounded-lg p-6 bg-card">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "…" : mode === "signin" ? "Entrar" : "Crear cuenta"}
        </Button>
        {mode === "signin" && (
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
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "¿No tienes cuenta? Crear una" : "¿Ya tienes cuenta? Entrar"}
        </button>
      </form>
    </div>
  );
}
