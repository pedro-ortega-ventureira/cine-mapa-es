import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth-callback")({
  ssr: false,
  component: AuthCallbackPage,
});

function safeNext(): string {
  if (typeof window === "undefined") return "/registro";
  const raw = new URLSearchParams(window.location.search).get("next") ?? "/registro";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/registro";
}

function AuthCallbackPage() {
  const [failed, setFailed] = useState(false);
  const [next, setNext] = useState("/registro");

  useEffect(() => {
    const target = safeNext();
    setNext(target);
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      window.location.replace(target);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) finish();
    });

    const timeout = window.setTimeout(() => {
      if (!done) setFailed(true);
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      {failed ? (
        <>
          <p className="text-sm text-muted-foreground">No hemos podido completar el acceso.</p>
          <a href={next} className="mt-3 inline-block text-primary hover:underline">
            Volver al registro
          </a>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Completando el acceso…</p>
      )}
    </div>
  );
}
