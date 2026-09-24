/**
 * Matrices de evaluación de requisitos legales (Ambiente / SST) — checklists
 * estáticos de cumplimiento normativo, revisados por QHSE periódicamente
 * (no un registro operativo fila-por-fila). Un documento por tipo.
 */
export type LegalTipo = 'ambiente' | 'sst';

export const LEGAL_TIPO_LABELS: Record<LegalTipo, string> = {
  ambiente: 'Requisitos legales — Gestión Ambiental',
  sst: 'Requisitos legales — Seguridad y Salud en el Trabajo',
};

export interface DocumentoLegal {
  id: number;
  tipo: LegalTipo;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  revision: string | null;
  fechaAprobacion: string | null;
  uploadedBy: string;
  uploadedAt: string;
}
