import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillCardComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import {
  ESTADO_VIGENCIA_TONO,
  PERMISO_LEGAL_GESTIONAR,
  textoDeVigencia,
  type RequisitoLegalGrupo,
  type RevisionLegal,
} from '../../models/documento-legal.model';
import { DocumentoLegalService } from '../../services/documento-legal.service';

interface BorradorRevision {
  revision: string;
  fechaAprobacion: string;
  vigenteHasta: string;
}
const BORRADOR_VACIO: BorradorRevision = { revision: '', fechaAprobacion: '', vigenteHasta: '' };

/**
 * Matrices de evaluación de requisitos legales (Ambiente / SST) — checklists de cumplimiento normativo. QHSE sube el archivo completo cada vez
 * que sale una revisión nueva: la anterior queda en el historial (no se pisa) y la nueva rige, con su fecha de aprobación y, si la tiene, su
 * vigencia. El archivo mismo es la fuente de verdad (no hay filas por norma).
 */
@Component({
  selector: 'app-legal-page',
  imports: [
    DatePipe,
    PageHeader,
    DynadrillCardComponent,
    DynadrillTagComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-page.html',
  styleUrl: './legal-page.scss',
})
export class LegalPage {
  private readonly service = inject(DocumentoLegalService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly grupos = signal<RequisitoLegalGrupo[]>([]);
  protected readonly subiendo = signal<string | null>(null);
  protected readonly borradores = signal<Record<string, BorradorRevision>>({});
  protected readonly puedeGestionar = computed(() => this.auth.can(PERMISO_LEGAL_GESTIONAR));

  protected readonly tarjetas = computed(() =>
    this.grupos().map((g) => ({
      tipoId: g.tipo.id,
      label: g.tipo.nombre,
      vigente: g.vigente,
      anteriores: g.revisiones.filter((r) => r.estado !== 'vigente'),
    })),
  );

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.loading.set(true);
    this.service.listar().subscribe({
      next: (grupos) => {
        this.grupos.set(grupos);
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.notify.error(
          'Error',
          mensajeDeError(e, 'No se pudo cargar el estado de las matrices legales.'),
        );
      },
    });
  }

  protected borrador(tipoId: string): BorradorRevision {
    return this.borradores()[tipoId] ?? BORRADOR_VACIO;
  }

  protected setCampo(tipoId: string, campo: keyof BorradorRevision, valor: string): void {
    this.borradores.update((m) => ({
      ...m,
      [tipoId]: { ...this.borrador(tipoId), [campo]: valor },
    }));
  }

  /** Tono del tag de vigencia de la revisión que rige. */
  protected tonoVigencia(r: RevisionLegal): 'success' | 'warning' | 'error' | 'neutral' {
    return ESTADO_VIGENCIA_TONO[r.estadoVigencia ?? 'sin_vencimiento'];
  }

  protected textoVigencia(r: RevisionLegal): string {
    return textoDeVigencia(r);
  }

  protected subir(tipoId: string, input: HTMLInputElement): void {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    const b = this.borrador(tipoId);
    if (!b.revision.trim()) {
      this.notify.error('Falta la revisión', 'Escriba el número de revisión del documento.');
      return;
    }
    if (!b.fechaAprobacion) {
      this.notify.error('Falta la fecha', 'Indique la fecha de aprobación de la revisión.');
      return;
    }
    this.subiendo.set(tipoId);
    this.service
      .registrarRevision(
        {
          tipoId,
          revision: b.revision.trim(),
          fechaAprobacion: b.fechaAprobacion,
          ...(b.vigenteHasta ? { vigenteHasta: b.vigenteHasta } : {}),
        },
        archivo,
      )
      .subscribe({
        next: () => {
          this.subiendo.set(null);
          this.borradores.update((m) => ({ ...m, [tipoId]: BORRADOR_VACIO }));
          this.notify.success('Guardado', 'La revisión quedó registrada.');
          this.cargar();
        },
        error: (e) => {
          this.subiendo.set(null);
          this.notify.error('Error', mensajeDeError(e, 'No se pudo registrar la revisión.'));
        },
      });
  }

  protected descargar(r: RevisionLegal): void {
    this.service.descargar(r.archivoId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e) => this.notify.error('Error', mensajeDeError(e, 'No se pudo abrir el documento.')),
    });
  }
}
