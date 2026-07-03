import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ContactDialog({ professionalId, professionalName }: { professionalId: string; professionalName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ sender_name: "", sender_email: "", subject: "", message: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("contact_messages").insert({
      professional_id: professionalId,
      ...form,
    });
    setLoading(false);
    if (error) {
      toast.error("No se pudo enviar el mensaje", { description: error.message });
      return;
    }
    toast.success("Mensaje enviado", { description: "El profesional lo recibirá en breve." });
    setOpen(false);
    setForm({ sender_name: "", sender_email: "", subject: "", message: "" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full">
          <Mail className="h-4 w-4 mr-2" /> Contactar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contactar con {professionalName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input
            required
            placeholder="Tu nombre"
            value={form.sender_name}
            onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
          />
          <Input
            required
            type="email"
            placeholder="Tu email"
            value={form.sender_email}
            onChange={(e) => setForm({ ...form, sender_email: e.target.value })}
          />
          <Input
            placeholder="Asunto (opcional)"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <Textarea
            required
            placeholder="Mensaje"
            rows={5}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Enviando…" : "Enviar mensaje"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
