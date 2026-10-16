import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { DocumentoPdfService } from '../../../../../shared/documentos';
import { AuthService } from '../../../../../core/services/auth.service';
import { ArchivosService } from '../../services/archivos.service';
import { GuiasComercialService } from '../../services/guias-comercial.service';
import { GuiaHoja } from '../guia-hoja/guia-hoja';
import { GuiaAccionDialog, type GuiaAccionDialogData } from '../guia-accion-dialog/guia-accion-dialog';
import { GuiaEmitirDialog, type GuiaEmitirDialogData } from '../guia-emitir-dialog/guia-emitir-dialog';
import { formatoDia, type PedidoDetalle } from '../../models/pedido-comercial.model';
import { AVISO_VERIFICACION, estadoVerificacion } from '../../models/prefactura-comercial';
import {
  AVISO_FIRMA_ELECTRONICA,
  ESTADO_FIRMA_ELECTRONICA,
  esPdfFirmado,
  validacionPendiente,
  ESTADO_GUIA_LABELS,
  ORIGEN_ITEM_LABELS,
  PERMISOS_GUIAS,
  mensajeErrorGuia,
  type AccionGuia,
  type DespachoEstado,
  type Guia,
} from '../../models/guia-comercial';

/**
 * Guías de remisión del pedido (lo que sale físicamente de bodega, sin precios) y las dos marcas de despacho a Bodega.
 * La guía se emite con el secuencial del portal; el PDF se descarga, Facturación lo firma electrónicamente y sube el firmado.
 */
@Component({
  selector: 'app-guias-seccion',
  imports: [DynadrillBannerComponent, DynadrillButtonComponent, DynadrillSpinnerComponent, DynadrillTagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guias-seccion.html',
  styleUrl: './guias-seccion.scss',
})
export class GuiasSeccion {
  private readonly servicio = inject(GuiasComercialService);
  private readonly archivos = inject(ArchivosService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly documentoPdf = inject(DocumentoPdfService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  readonly pedido = input.required<PedidoDetalle>();
  readonly cambioDePedido = output<void>();

  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly guias = signal<Guia[]>([]);
  protected readonly despacho = signal<DespachoEstado | null>(null);

  protected readonly puedeEmitir = computed(() => this.auth.can(PERMISOS_GUIAS.emitir));
  protected readonly puedeFirmar = computed(() => this.auth.can(PERMISOS_GUIAS.firmar));
  protected readonly puedeSolicitar = computed(
    () => this.auth.can(PERMISOS_GUIAS.solicitarDespacho) && this.pedido().estado === 'prefactura_generada',
  );
  protected readonly puedeRealizar = computed(
    () => this.auth.can(PERMISOS_GUIAS.realizarDespacho) && this.pedido().estado === 'por_despachar_bodega',
  );
  protected readonly vigentes = computed(() => this.guias().filter(g => g.estado === 'emitida'));
  protected readonly anuladas = computed(() => this.guias().filter(g => g.estado === 'anulada'));

  private readonly destroyRef = inject(DestroyRef);
  private sondeo: ReturnType<typeof setTimeout> | null = null;
  private intentos = 0;
  /** Se agotaron las consultas sin que llegara resultado (imagen, servicio caído...). */
  protected readonly sinResultado = signal(false);
  protected readonly aviso = AVISO_FIRMA_ELECTRONICA;
  protected readonly verificando = signal<string | null>(null);

  constructor() {
    queueMicrotask(() => this.cargar());
    this.destroyRef.onDestroy(() => this.detenerSondeo());
  }

  /**
   * La validación de la firma electrónica corre sola en segundo plano (unos segundos): mientras una guía firmada no
   * tenga resultado se vuelve a consultar cada 3 s, hasta 20 veces. Nunca bloquea ninguna acción.
   */
  private evaluarSondeo(): void {
    this.detenerSondeo();
    const pendiente = this.guias().some(validacionPendiente);
    this.sinResultado.set(pendiente && this.intentos >= 20);
    if (!pendiente || this.intentos >= 20) return;
    this.intentos++;
    this.sondeo = setTimeout(() => {
      this.servicio.delPedido(this.pedido().id).subscribe({
        next: gs => {
          this.guias.set(gs);
          this.evaluarSondeo();
        },
        error: () => this.evaluarSondeo(),
      });
    }, 3000);
  }

  private detenerSondeo(): void {
    if (this.sondeo) clearTimeout(this.sondeo);
    this.sondeo = null;
  }

  protected volverAValidar(g: Guia): void {
    if (this.verificando()) return;
    this.verificando.set(g.id);
    this.servicio.verificarFirmaElectronica(g.id).subscribe({
      next: n => {
        this.verificando.set(null);
        this.guias.update(gs => gs.map(x => (x.id === n.id ? n : x)));
        this.intentos = 0;
        this.evaluarSondeo();
      },
      error: err => {
        this.verificando.set(null);
        this.notify.error('No se pudo validar', mensajeErrorGuia(err, 'No se pudo validar la firma electrónica. Intente de nuevo.'));
      },
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.delPedido(this.pedido().id).subscribe({
      next: gs => {
        this.guias.set(gs);
        this.intentos = 0;
        this.sinResultado.set(false);
        this.evaluarSondeo();
        this.servicio.despacho(this.pedido().id).subscribe({
          next: d => {
            this.despacho.set(d);
            this.cargando.set(false);
          },
          error: () => {
            this.despacho.set(null);
            this.cargando.set(false);
          },
        });
      },
      error: err => {
        this.cargando.set(false);
        this.error.set(mensajeErrorGuia(err, 'No se pudieron cargar las guías. Intente de nuevo.'));
      },
    });
  }

  protected emitir(reemplazaAId?: string): void {
    const ref = this.dialog.open<GuiaEmitirDialog, GuiaEmitirDialogData>({
      title: 'Emitir guía de remisión',
      content: GuiaEmitirDialog,
      data: { pedidoId: this.pedido().id, reemplazaAId },
      footer: false,
      width: '900px',
    });
    ref.afterClose.subscribe((g: Guia | undefined) => {
      if (g) this.recargar();
    });
  }

  protected accion(accion: AccionGuia, guia: Guia): void {
    const titulos: Record<AccionGuia, string> = { reasignar: 'Cambiar el número de la guía', anular: 'Anular guía', firmada: 'Registrar guía firmada' };
    const ref = this.dialog.open<GuiaAccionDialog, GuiaAccionDialogData>({
      title: titulos[accion],
      content: GuiaAccionDialog,
      data: { accion, guia },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((g: Guia | undefined) => {
      if (g) this.recargar();
    });
  }

  /** Vista de impresión del formato DYN-AFN-RE-013 (`window.print()`): imprimir o «Guardar como PDF». */
  protected imprimir(g: Guia, descargar = false): void {
    const p = this.pedido();
    this.documentoPdf.abrir({
      titulo: `Guía de remisión ${g.codigo} — Vista de impresión`,
      component: GuiaHoja,
      inputs: { guia: g, campo: p.ubicacion.campo, pozo: p.ubicacion.pozo },
      nombreArchivo: `Guía de remisión ${g.codigo}`,
      descargar,
    });
  }

  protected descargarFirmada(g: Guia): void {
    if (!g.firmada) return;
    const nombre = g.firmada.archivoNombre ?? `guia-${g.codigo}-firmada`;
    this.archivos.contenido(g.firmada.archivoId).subscribe({
      next: blob => this.archivos.guardarComo(blob, nombre),
      error: () => this.notify.error('No se pudo descargar', 'No se pudo descargar la guía firmada. Intente de nuevo.'),
    });
  }

  protected solicitarDespacho(): void {
    this.llamarDespacho(this.servicio.solicitarDespacho(this.pedido().id), 'Despacho solicitado a Bodega');
  }

  protected realizarDespacho(): void {
    this.llamarDespacho(this.servicio.realizarDespacho(this.pedido().id), 'Despacho registrado');
  }

  private llamarDespacho(obs: ReturnType<GuiasComercialService['solicitarDespacho']>, titulo: string): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    obs.subscribe({
      next: () => {
        this.ocupado.set(false);
        this.notify.success(titulo);
        this.recargar();
      },
      error: err => {
        this.ocupado.set(false);
        this.errorAccion.set(mensajeErrorGuia(err, 'No se pudo completar la acción. Intente de nuevo.'));
      },
    });
  }

  private recargar(): void {
    this.cargar();
    this.cambioDePedido.emit();
  }

  protected readonly dia = formatoDia;
  protected readonly esPdf = esPdfFirmado;
  protected readonly manuscrita = (g: Guia) => {
    const e = estadoVerificacion({ verificacion: g.firmaManuscrita.verificacion, verificacionConfianza: g.firmaManuscrita.confianza, verificacionAt: g.firmaManuscrita.at, nombreCoincide: null }, this.sinResultado());
    // las guías firmadas antes de esta lectura nunca la tuvieron: se pide con "Volver a validar"
    return e.clave === 'sin_resultado' ? { ...e, texto: 'Sin resultado — use "Volver a validar"' } : e;
  };
  protected readonly avisoManuscrita = AVISO_VERIFICACION;
  protected readonly firmaElec = (g: Guia) => (g.firmaElectronica ? ESTADO_FIRMA_ELECTRONICA[g.firmaElectronica.estado] : null);
  protected readonly estado = (g: Guia) => ESTADO_GUIA_LABELS[g.estado];
  protected readonly tono = (g: Guia) => (g.estado === 'emitida' ? (g.firmada ? 'success' : 'info') : 'neutral');
  protected readonly origen = (o: keyof typeof ORIGEN_ITEM_LABELS) => ORIGEN_ITEM_LABELS[o];
}
