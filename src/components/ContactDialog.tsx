import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { sendContactMessage } from "@/lib/contact-message.functions";
import { toast } from "sonner";

const emptyForm = {
  sender_name: "",
  sender_email: "",
  subject: "",
  message: "",
  website: "",
};

export function ContactDialog({
  professionalId,
  professionalName,
}: {
  professionalId: string;
  professionalName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [requestId, setRequestId] = useState<string | null>(null);
  const sendMessage = useServerFn(sendContactMessage);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const currentRequestId = requestId ?? crypto.randomUUID();
    setRequestId(currentRequestId);

    try {
      await sendMessage({
        data: {
          request_id: currentRequestId,
          professional_id: professionalId,
          ...form,
        },
      });
      toast.success("Mensaje enviado", {
        description: "La administración lo revisará y gestionará.",
      });
      setOpen(false);
      setForm(emptyForm);
      setRequestId(null);
    } catch {
      toast.error("No se pudo enviar el mensaje");
    } finally {
      setLoading(false);
    }
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
          <input
            aria-hidden="true"
            autoComplete="off"
            className="sr-only"
            name="website"
            tabIndex={-1}
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Enviando…" : "Enviar mensaje"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
