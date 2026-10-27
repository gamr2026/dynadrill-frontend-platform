import { SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { map, of, switchMap, type Observable } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextareaComponent,
  DynadrillTextComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { MODULO_ARCHIVO_DESPACHO } from '../../facturacion/pedidos-comercial/models/guia-comercial';
import type { ArchivoSubido } from '../../facturacion/pedidos-comercial/models/documentos-pedido';
import { ArchivosService } from '../../facturacion/pedidos-comercial/services/archivos.service';
import {
  formatearCantidad,
  mensajeErrorInventario,
  type DespachoBodega,
  type ItemDespacho,
  type MovimientoKardex,
} from '../models/inventario-plataforma.model';
import { InventarioPlataformaService } from '../services/inventario-plataforma.service';

export interface GestionarDespachoDialogData {
  /** La fila de la bandeja; el detalle (con las salidas de stock) se carga al abrir. */
  despacho: DespachoBodega;
}

/**
 * Bodega resuelve la Solicitud de Despacho: respalda con salidas de stock de los artículos que existen en Inventario, despacha
 * adjuntando el documento de respaldo (obligatorio; la hoja MSDS es opcional) o rechaza con motivo. Ambos casos devuelven el pedido a
 * Facturación en la etapa de prefactura. Una vez resuelta, la solicitud no cambia.
 */
@Component({
  selector: 'app-gestionar-despacho-dialog',
  /** Pantalla completa en móvil (formulario largo) — ver styles.scss. */
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [DynadrillTextComponent, DynadrillInputComponent, DynadrillTextareaComponent, DynadrillButtonComponent, SlicePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gestionar-despacho-dialog.html',
  styleUrl: './gestionar-despacho-dialog.scss',
})
export class GestionarDespachoDialog {
  private readonly inventario = inject(InventarioPlataformaService);
  private readonly archivos = inject(ArchivosService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly modalRef = inject(NzModalRef<GestionarDespachoDialog, boolean | undefined>);
  protected readonly data = inject<GestionarDespachoDialogData>(NZ_MODAL_DATA);

  protected readonly despacho = signal<DespachoBodega>(this.data.despacho);
  protected readonly esPendiente = computed(() => this.despacho().estado === 'solicitado');
  /** Hubo cambios (salidas de stock) aunque la solicitud siga pendiente: la bandeja se recarga al cerrar. */
  private huboCambios = false;

  protected readonly archivo = signal<File | null>(null);
  /** MSDS (hoja de datos de seguridad): opcional, se adjunta cuando el despacho incluye químicos. */
  protected readonly msds = signal<File | null>(null);
  protected readonly notaBodega = signal('');
  protected readonly referenciaAs2 = signal('');
  protected readonly motivoRechazo = signal('');
  protected readonly submitting = signal(false);
  protected readonly registrando = signal<number | null>(null);
  /** Cantidad a sacar de stock por ítem (por `orden`); por omisión, lo que falta por respaldar. */
  protected readonly cantidades = signal<Record<number, string>>({});

  protected readonly movimientos = computed<MovimientoKardex[]>(() => {
    const m = this.despacho().movimientos;
    return Array.isArray(m) ? m : [];
  });
  protected readonly puedeDespachar = computed(() => !!this.archivo());
  protected readonly puedeRechazar = computed(
    () => this.motivoRechazo().trim().length > 0 && this.movimientos().length === 0,
  );
  protected readonly formatear = formatearCantidad;

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    this.inventario.despacho(this.data.despacho.id).subscribe({
      next: d => this.despacho.set(d),
      error: err => this.notify.error('Error', mensajeErrorInventario(err, 'No se pudo cargar la solicitud.')),
    });
  }

  /** Lo ya sacado de stock para el artículo del ítem. */
  protected respaldado(item: ItemDespacho): number {
    const id = item.articulo?.id;
    return id ? this.movimientos().filter(m => m.articuloId === id).reduce((t, m) => t + m.cantidad, 0) : 0;
  }

  protected cantidadSugerida(item: ItemDespacho): string {
    const escrita = this.cantidades()[item.orden];
    if (escrita !== undefined) return escrita;
    return String(Math.max(0, +(item.cantidad - this.respaldado(item)).toFixed(3)));
  }

  protected cambiarCantidad(item: ItemDespacho, valor: string): void {
    this.cantidades.update(c => ({ ...c, [item.orden]: valor }));
  }

  protected registrarSalida(item: ItemDespacho): void {
    const articulo = item.articulo;
    const cantidad = Number(this.cantidadSugerida(item));
    if (!articulo || this.registrando() !== null || !Number.isFinite(cantidad) || cantidad <= 0) return;
    this.registrando.set(item.orden);
    this.inventario
      .registrarSalidaDeDespacho(this.despacho().id, {
        articuloId: articulo.id,
        bodegaId: this.despacho().bodega.id,
        cantidad,
        observacion: `Despacho ${this.despacho().numero}`,
      })
      .subscribe({
        next: d => {
          this.registrando.set(null);
          this.huboCambios = true;
          this.despacho.set(d);
          this.cantidades.update(c => {
            const { [item.orden]: _quitada, ...resto } = c;
            return resto;
          });
          this.notify.success('Salida registrada', `${articulo.nombre}: ${formatearCantidad(cantidad)}`);
        },
        error: err => {
          this.registrando.set(null);
          this.notify.error('No se pudo registrar la salida', mensajeErrorInventario(err, 'Intente de nuevo.'));
        },
      });
  }

  protected seleccionarArchivo(files: FileList | null): void {
    this.archivo.set(files?.[0] ?? null);
  }

  protected seleccionarMsds(files: FileList | null): void {
    this.msds.set(files?.[0] ?? null);
  }

  protected despachar(): void {
    const respaldo = this.archivo();
    if (!respaldo || this.submitting()) return;
    this.submitting.set(true);
    const msds = this.msds();
    // Primero se suben los archivos al módulo de archivos y luego se registra el despacho con sus ids.
    this.archivos
      .subir(respaldo, MODULO_ARCHIVO_DESPACHO)
      .pipe(
        switchMap(r => {
          const hoja$: Observable<ArchivoSubido | null> = msds
            ? this.archivos.subir(msds, MODULO_ARCHIVO_DESPACHO)
            : of(null);
          return hoja$.pipe(map(m => ({ r, m })));
        }),
        switchMap(({ r, m }) =>
          this.inventario.realizarDespacho(this.despacho().id, {
            archivoRespaldoId: r.id,
            ...(m ? { archivoMsdsId: m.id } : {}),
            ...(this.referenciaAs2().trim() ? { referenciaAs2: this.referenciaAs2().trim() } : {}),
            ...(this.notaBodega().trim() ? { notaBodega: this.notaBodega().trim() } : {}),
          }),
        ),
      )
      .subscribe({
        next: () => {
          this.notify.success('Despacho registrado', `Solicitud ${this.despacho().numero} despachada.`);
          this.modalRef.close(true);
        },
        error: err => {
          this.submitting.set(false);
          this.notify.error('No se pudo registrar el despacho', mensajeErrorInventario(err, 'Intente de nuevo.'));
        },
      });
  }

  protected rechazar(): void {
    if (!this.puedeRechazar() || this.submitting()) return;
    this.submitting.set(true);
    this.inventario.rechazarDespacho(this.despacho().id, { motivo: this.motivoRechazo().trim() }).subscribe({
      next: () => {
        this.notify.success('Solicitud rechazada', 'Se devolvió el pedido a Facturación.');
        this.modalRef.close(true);
      },
      error: err => {
        this.submitting.set(false);
        this.notify.error('No se pudo rechazar', mensajeErrorInventario(err, 'Intente de nuevo.'));
      },
    });
  }

  protected descargar(archivoId: string, nombre: string): void {
    this.archivos.contenido(archivoId).subscribe({
      next: blob => this.archivos.guardarComo(blob, nombre),
      error: () => this.notify.error('No se pudo descargar', 'Intente de nuevo.'),
    });
  }

  protected cerrar(): void {
    this.modalRef.close(this.huboCambios ? true : undefined);
  }
}
