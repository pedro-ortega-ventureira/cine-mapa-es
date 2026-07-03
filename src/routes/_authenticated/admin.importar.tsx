import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { importProfessionals } from "@/lib/professionals.functions";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/importar")({
  component: ImportPage,
});

type Row = Record<string, any>;

const FIELD_OPTIONS = [
  { value: "", label: "— No importar —" },
  { value: "full_name", label: "Nombre completo" },
  { value: "email", label: "Email" },
  { value: "raw_postal_code", label: "Código postal" },
  { value: "primary_role", label: "Rol principal" },
  { value: "secondary_roles", label: "Roles secundarios (coma)" },
  { value: "bio", label: "Biografía / Actividad" },
];

function autoDetect(header: string): string {
  const h = header.toLowerCase();
  if (h.includes("nombre") || h.includes("apellido")) return "full_name";
  if (h.includes("email") || h.includes("correo") || h.includes("@")) return "email";
  if (h.includes("postal") || h.includes("cp")) return "raw_postal_code";
  if (h.includes("actividad") || h.includes("rol") || h.includes("especialidad") || h.includes("profesion")) return "primary_role";
  if (h.includes("bio") || h.includes("presenta")) return "bio";
  return "";
}

function ImportPage() {
  const importFn = useServerFn(importProfessionals);
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [filename, setFilename] = useState<string>("");
  const [result, setResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
      if (data.length === 0) {
        toast.error("El fichero está vacío");
        return;
      }
      const hdrs = Object.keys(data[0]);
      setHeaders(hdrs);
      setRows(data);
      setFilename(file.name);
      // auto-detect
      const m: Record<string, string> = {};
      for (const h of hdrs) m[h] = autoDetect(h);
      setMapping(m);
      setResult(null);
    };
    reader.readAsArrayBuffer(file);
  }

  async function runImport() {
    setImporting(true);
    try {
      const mapped = rows.map((row) => {
        const out: any = {};
        for (const [col, field] of Object.entries(mapping)) {
          if (!field) continue;
          let val = row[col];
          if (val == null || val === "") continue;
          val = String(val).trim();
          if (field === "secondary_roles") out[field] = val.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
          else out[field] = val;
        }
        return out;
      }).filter((r: any) => r.full_name);

      const res = await importFn({ data: { filename, rows: mapped } });
      setResult(res);
      toast.success(`Importación completada: ${res.inserted} nuevas, ${res.updated} actualizadas`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Importar desde Excel</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Sube un fichero .xlsx, mapea las columnas y confirma. Los registros con el mismo email se actualizan.
      </p>

      {rows.length === 0 ? (
        <label className="block cursor-pointer rounded-lg border-2 border-dashed p-12 text-center hover:bg-accent/30">
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Haz clic o arrastra el fichero .xlsx</p>
          <p className="text-xs text-muted-foreground mt-1">
            Soporta el formato del formulario de "Directorio audiovisual del medio rural".
          </p>
        </label>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">{filename}</span> · {rows.length} filas
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRows([]);
                  setHeaders([]);
                  setResult(null);
                }}
              >
                Cambiar fichero
              </Button>
              <Button onClick={runImport} disabled={importing}>
                <Upload className="h-4 w-4 mr-2" />
                {importing ? "Importando…" : "Importar"}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-secondary/30">
            <p className="text-sm font-medium mb-2">Mapeo de columnas</p>
            <div className="grid gap-2">
              {headers.map((h) => (
                <div key={h} className="grid grid-cols-2 gap-2 items-center text-sm">
                  <div className="truncate text-muted-foreground text-xs" title={h}>{h}</div>
                  <select
                    value={mapping[h] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                    className="rounded border border-input px-2 py-1 text-xs"
                  >
                    {FIELD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <p className="p-3 text-xs font-medium bg-secondary/30">Vista previa (primeras 10 filas)</p>
            <table className="w-full text-xs">
              <thead className="bg-secondary/20">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="p-2 text-left font-normal text-muted-foreground truncate max-w-[200px]">
                      {h}
                      {mapping[h] && (
                        <span className="ml-1 text-primary">→ {mapping[h]}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-t">
                    {headers.map((h) => (
                      <td key={h} className="p-2 truncate max-w-[200px]">
                        {r[h] == null ? "—" : String(r[h]).slice(0, 60)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result && (
            <div className="rounded-lg border bg-green-50 p-4 text-sm">
              <p className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Importación completada
              </p>
              <ul className="mt-2 space-y-0.5">
                <li>{result.inserted} nuevos profesionales</li>
                <li>{result.updated} actualizados</li>
                {result.error_count > 0 && (
                  <li className="text-destructive">{result.error_count} filas con errores</li>
                )}
              </ul>
              {result.errors?.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs">Ver errores</summary>
                  <pre className="mt-2 text-xs bg-background border rounded p-2 overflow-x-auto">
                    {JSON.stringify(result.errors, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
