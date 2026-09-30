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
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { DocumentoLegal, LEGAL_TIPO_LABELS, LegalTipo } from '../../models/documento-legal.model';
import { DocumentoLegalService } from '../../services/documento-legal.service';

const TIPOS: LegalTipo[] = ['ambiente', 'sst'];

/**
 * Matrices de evaluación de requisitos legales (Ambiente / SST) — checklists
 * estáticos de cumplimiento normativo. QHSE sube el archivo completo cada
 * vez que sale una revisión nueva; no hay filas individuales por norma en
 * el sistema (el archivo mismo es la fuente de verdad).
 */
@Component({
  selector: 'app-legal-page',
  imports: [DatePipe, PageHeader, DynadrillCardComponent, DynadrillTagComponent, DynadrillButtonComponent, DynadrillInputComponent, DynadrillSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-page.html',
  styleUrl: './legal-page.scss',
})
export class LegalPage {
  private readonly service = inject(DocumentoLegalService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly documentos = signal<DocumentoLegal[]>([]);
  protected readonly tipoLabels = LEGAL_TIPO_LABELS;
  protected readonly subiendo = signal<LegalTipo | null>(null);
  protected readonly revisionDraft = signal<Record<LegalTipo, string>>({ ambiente: '', sst: '' });

  protected readonly tarjetas = computed(() =>
    TIPOS.map(tipo => ({
      tipo,
      label: this.tipoLabels[tipo],
      documento: this.documentos().find(d => d.tipo === tipo) ?? null,
    })),
  );

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.loading.set(true);
    this.service.listar().subscribe({
      next: documentos => {
        this.documentos.set(documentos);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar el estado de las matrices legales.');
      },
    });
  }

  protected revisionDe(tipo: LegalTipo): string {
    return this.revisionDraft()[tipo];
  }

  protected setRevision(tipo: LegalTipo, valor: string): void {
    this.revisionDraft.update(m => ({ ...m, [tipo]: valor }));
  }

  protected subir(tipo: LegalTipo, input: HTMLInputElement): void {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    this.subiendo.set(tipo);
    this.service.subir(tipo, archivo, this.revisionDe(tipo).trim() || undefined).subscribe({
      next: () => {
        this.subiendo.set(null);
        this.notify.success('Guardado', 'El documento quedó guardado.');
        this.cargar();
      },
      error: () => {
        this.subiendo.set(null);
        this.notify.error('Error', 'No se pudo subir el documento.');
      },
    });
  }

  protected descargar(tipo: LegalTipo): void {
    this.service.descargar(tipo).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.notify.error('Error', 'No se pudo abrir el documento.'),
    });
  }
}
