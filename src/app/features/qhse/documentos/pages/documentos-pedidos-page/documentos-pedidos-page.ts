import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { QhseDocumentosService } from '../../services/qhse-documentos.service';
import { PedidoConEstadoDocumental, QHSE_REFERENCIA_VIGENTE, QHSE_TIPO_FORMATO_RECEPCION, QHSE_TIPO_SFI } from '../../models/qhse-documentos.model';

type BadgeTone = 'success' | 'warning' | 'error' | 'neutral' | 'brand' | 'info';
interface Badge {
  text: string;
  tone: BadgeTone;
}

const CARGADO: Badge = { text: 'Cargado', tone: 'success' };
const PENDIENTE: Badge = { text: 'Pendiente', tone: 'warning' };
const VENCIDO: Badge = { text: 'Vencido', tone: 'error' };
const SIN_ART: Badge = { text: 'Sin ART', tone: 'neutral' };

/**
 * Bandeja "Documentos por pedido" de QHSE — ver PLAN-QHSE-PUMPING-NOTIFICACIONES,
 * Fase 2. QHSE sube acá el Formato de Recepción y el SFI; ART y PT los sube
 * el Supervisor desde su ticket de Pumping (esta pantalla solo los muestra).
 */
@Component({
  selector: 'app-documentos-pedidos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DynadrillScreenHeaderComponent, DynadrillDataTableComponent, DynadrillIconButtonComponent],
  templateUrl: './documentos-pedidos-page.html',
  styleUrl: './documentos-pedidos-page.scss',
})
export class DocumentosPedidosPage {
  private readonly service = inject(QhseDocumentosService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly pedidos = signal<PedidoConEstadoDocumental[]>([]);
  protected readonly subiendo = signal<string | null>(null);

  protected readonly columns: DynadrillDataTableColumn[] = [
    { key: 'code', header: 'Pedido', sortable: true, searchable: true },
    { key: 'cliente', header: 'Cliente', searchable: true },
    { key: 'campo', header: 'Campo / Pozo', searchable: true },
    { key: 'formatoRecepcionBadge', header: 'Formato de Recepción', type: 'badge' },
    { key: 'artBadge', header: 'ART', type: 'badge' },
    { key: 'ptBadge', header: 'PT (hoy)', type: 'badge' },
    { key: 'sfiBadge', header: 'SFI', type: 'badge' },
  ];

  protected readonly rows = computed(() =>
    this.pedidos().map(p => ({
      pedidoId: p.pedidoId,
      code: p.code,
      cliente: p.cliente,
      campo: `${p.campo} / ${p.pozo}`,
      formatoRecepcionBadge: p.estado.formatoRecepcion ? CARGADO : PENDIENTE,
      artBadge: p.estado.artVigente === true ? CARGADO : p.estado.artVigente === false ? VENCIDO : SIN_ART,
      ptBadge: p.estado.ptHoy ? CARGADO : PENDIENTE,
      sfiBadge: p.estado.sfi ? CARGADO : PENDIENTE,
      estado: p.estado,
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['pedidoId']);

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.loading.set(true);
    this.service.listarPedidos().subscribe({
      next: pedidos => {
        this.pedidos.set(pedidos);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private key(pedidoId: number, tipo: string): string {
    return `${pedidoId}:${tipo}`;
  }

  protected subiendoTipo(pedidoId: number, tipo: string): boolean {
    return this.subiendo() === this.key(pedidoId, tipo);
  }

  /** Sube (o reemplaza) el Formato de Recepción o el SFI de un pedido — únicos dos tipos que QHSE sube directamente. */
  protected subir(pedidoId: number, tipo: typeof QHSE_TIPO_FORMATO_RECEPCION | typeof QHSE_TIPO_SFI, input: HTMLInputElement): void {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    this.subiendo.set(this.key(pedidoId, tipo));
    this.service.subir(pedidoId, tipo, QHSE_REFERENCIA_VIGENTE, archivo).subscribe({
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

  protected descargar(pedidoId: number, tipo: string): void {
    this.service.descargar(pedidoId, tipo, QHSE_REFERENCIA_VIGENTE).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.notify.error('Error', 'No se pudo abrir el documento.'),
    });
  }
}
