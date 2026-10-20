import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { ArchivosService } from '../../services/archivos.service';
import { PrefacturasComercialService } from '../../services/prefacturas-comercial.service';
import { OrdenesTrabajoComercialService } from '../../services/ordenes-trabajo-comercial.service';
import { csvAs2 } from '../../models/orden-trabajo';
import {
  PrefacturaAccionDialog,
  type PrefacturaAccionDialogData,
  type TipoAccionPrefactura,
} from '../prefactura-accion-dialog/prefactura-accion-dialog';
import {
  PrefacturaFirmaDialog,
  type PrefacturaFirmaDialogData,
} from '../prefactura-firma-dialog/prefactura-firma-dialog';
import { formatoDia, formatoMoneda, type PedidoDetalle } from '../../models/pedido-comercial.model';
import {
  ESTADO_PREFACTURA_TONO,
  AVISO_VERIFICACION,
  INTERVALO_SONDEO_MS,
  LIMITE_SONDEO_MS,
  PERMISOS_PREFACTURAS,
  accionesDisponibles,
  debeSondear,
  estadoVerificacion,
  esVigente,
  etiquetaDevueltoA,
  etiquetaEstadoPrefactura,
  etiquetaFirmante,
  etiquetaFuente,
  etiquetaMedio,
  mensajeErrorPrefactura,
  prefacturaActual,
  rotuloAccion,
  type AccionPrefactura,
  type FirmaPrefactura,
  type Prefactura,
} from '../../models/prefactura-comercial';

/** Prefactura del pedido: estado, acciones según permisos, líneas, totales, advertencias, firmas e historial de versiones. */
@Component({
  selector: 'app-prefactura-seccion',
  imports: [
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prefactura-seccion.html',
  styleUrl: './prefactura-seccion.scss',
})
export class PrefacturaSeccion {
  private readonly servicio = inject(PrefacturasComercialService);
  private readonly archivos = inject(ArchivosService);
  private readonly ordenes = inject(OrdenesTrabajoComercialService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);

  readonly pedido = input.required<PedidoDetalle>();
  /** Tras cualquier acción el pedido (estado, historial, pasos) pudo cambiar: la página lo recarga. */
  readonly cambioDePedido = output<void>();

  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly versiones = signal<Prefactura[]>([]);
  protected readonly actual = signal<Prefactura | null>(null);

  protected readonly acciones = computed(() =>
    accionesDisponibles(this.actual(), (p) => this.auth.can(p)),
  );
  protected readonly historial = computed(() =>
    this.versiones().filter((v) => v.id !== this.actual()?.id),
  );
  protected readonly vigente = computed(
    () => !!this.actual() && esVigente(this.actual() as Prefactura),
  );

  private readonly destroyRef = inject(DestroyRef);
  private sondeo: ReturnType<typeof setInterval> | null = null;
  private inicioSondeo = 0;
  protected readonly sondeoAgotado = signal(false);
  protected readonly aviso = AVISO_VERIFICACION;
  protected readonly puedeVerificar = computed(() => this.auth.can(PERMISOS_PREFACTURAS.firmar));
  protected readonly verificando = signal<string | null>(null);

  constructor() {
    queueMicrotask(() => this.cargar());
    this.destroyRef.onDestroy(() => this.detenerSondeo());
  }

  /**
   * La lectura de las firmas corre sola en segundo plano (1 a ~20 s): mientras falte algún resultado se consulta la
   * prefactura cada 3 s, hasta un máximo de ~90 s. Nunca bloquea ni condiciona ninguna acción.
   */
  private evaluarSondeo(reiniciar = false): void {
    const firmas = this.actual()?.firmas ?? [];
    if (reiniciar || this.inicioSondeo === 0) this.inicioSondeo = Date.now();
    if (reiniciar) this.sondeoAgotado.set(false);
    if (!debeSondear(firmas, this.inicioSondeo, Date.now())) {
      this.detenerSondeo();
      this.sondeoAgotado.set(
        firmas.some((f) => f.verificacionAt === null) &&
          Date.now() - this.inicioSondeo >= LIMITE_SONDEO_MS,
      );
      return;
    }
    if (this.sondeo) return;
    this.sondeo = setInterval(() => this.consultarSondeo(), INTERVALO_SONDEO_MS);
  }

  private consultarSondeo(): void {
    const a = this.actual();
    if (!a) return this.detenerSondeo();
    this.servicio.detalle(a.id).subscribe({
      next: (d) => {
        this.actual.set(d);
        this.evaluarSondeo();
      },
      error: () => this.evaluarSondeo(),
    });
  }

  private detenerSondeo(): void {
    if (this.sondeo) clearInterval(this.sondeo);
    this.sondeo = null;
  }

  protected volverAVerificar(f: FirmaPrefactura): void {
    const a = this.actual();
    if (!a || this.verificando()) return;
    this.verificando.set(f.id);
    this.servicio.verificarFirma(a.id, f.id).subscribe({
      next: (p) => {
        this.verificando.set(null);
        this.actual.set(p);
        this.evaluarSondeo(true);
      },
      error: (err) => {
        this.verificando.set(null);
        this.notify.error(
          'No se pudo verificar',
          mensajeErrorPrefactura(err, 'No se pudo volver a verificar la firma. Intente de nuevo.'),
        );
      },
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.delPedido(this.pedido().id).subscribe({
      next: (vs) => {
        this.versiones.set(vs);
        const a = prefacturaActual(vs);
        if (!a) {
          this.actual.set(null);
          this.cargando.set(false);
          return;
        }
        this.servicio.detalle(a.id).subscribe({
          next: (d) => {
            this.actual.set(d);
            this.cargando.set(false);
            this.evaluarSondeo(true);
          },
          error: (err) => this.fallarCarga(err),
        });
      },
      error: (err) => this.fallarCarga(err),
    });
  }

  private fallarCarga(err: unknown): void {
    this.cargando.set(false);
    this.error.set(
      mensajeErrorPrefactura(err, 'No se pudo cargar la prefactura. Intente de nuevo.'),
    );
  }

  protected ejecutar(a: AccionPrefactura): void {
    const p = this.actual();
    this.errorAccion.set(null);
    switch (a) {
      case 'generar':
        return this.llamar(this.servicio.generar(this.pedido().id), 'Prefactura generada');
      case 'recalcular':
        return p
          ? this.llamar(this.servicio.recalcular(p.id), 'Prefactura recalculada')
          : undefined;
      case 'ticket':
        return p ? this.abrirAccion('ticket', 'Número de ticket de AS2', p) : undefined;
      case 'enviar':
        return p ? this.abrirAccion('enviar', 'Enviar al cliente', p) : undefined;
      case 'firmada':
        return p ? this.abrirAccion('firmada', 'Dar por firmada', p) : undefined;
      case 'rechazar':
        return p ? this.abrirAccion('rechazar', 'Registrar rechazo', p) : undefined;
      case 'firma':
        return p ? this.abrirFirma(p) : undefined;
    }
  }

  private llamar(obs: ReturnType<PrefacturasComercialService['generar']>, titulo: string): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    obs.subscribe({
      next: () => {
        this.ocupado.set(false);
        this.notify.success(titulo);
        this.cargar();
        this.cambioDePedido.emit();
      },
      error: (err) => {
        this.ocupado.set(false);
        this.errorAccion.set(
          mensajeErrorPrefactura(err, 'No se pudo completar la acción. Intente de nuevo.'),
        );
      },
    });
  }

  private abrirAccion(tipo: TipoAccionPrefactura, titulo: string, p: Prefactura): void {
    const ref = this.dialog.open<PrefacturaAccionDialog, PrefacturaAccionDialogData>({
      title: titulo,
      content: PrefacturaAccionDialog,
      data: { tipo, prefacturaId: p.id, ticketActual: p.ticketNumero },
      footer: false,
      width: '480px',
    });
    ref.afterClose.subscribe((r: Prefactura | undefined) => {
      if (r) {
        this.cargar();
        this.cambioDePedido.emit();
      }
    });
  }

  private abrirFirma(p: Prefactura): void {
    const rep = this.pedido().responsables.representanteCampo;
    const ref = this.dialog.open<PrefacturaFirmaDialog, PrefacturaFirmaDialogData>({
      title: 'Registrar firma',
      content: PrefacturaFirmaDialog,
      data: { prefacturaId: p.id, representanteCampo: { id: rep.id, nombre: rep.nombre } },
      footer: false,
      width: '520px',
    });
    ref.afterClose.subscribe((r: Prefactura | undefined) => {
      if (r) {
        this.cargar();
        this.cambioDePedido.emit();
      }
    });
  }

  /** Plantilla de carga a AS2 ("AS2 Prefactura Cliente"): descarga las líneas de la prefactura firmada como CSV. */
  protected exportarAs2(): void {
    const p = this.actual();
    if (!p || this.ocupado()) return;
    this.ocupado.set(true);
    this.errorAccion.set(null);
    this.ordenes.exportacionAs2(p.id).subscribe({
      next: (e) => {
        this.ocupado.set(false);
        const nombre = `AS2-carga-${e.ticketNumero ?? 'prefactura'}.csv`;
        this.archivos.guardarComo(
          new Blob([csvAs2(e.filas)], { type: 'text/csv;charset=utf-8' }),
          nombre,
        );
        if (e.advertencias.length)
          this.notify.warning('Exportado con avisos', e.advertencias.join(' '));
        else this.notify.success('Exportado', 'Plantilla de carga a AS2 descargada.');
      },
      error: (err) => {
        this.ocupado.set(false);
        this.errorAccion.set(
          mensajeErrorPrefactura(err, 'No se pudo exportar a AS2. Intente de nuevo.'),
        );
      },
    });
  }

  protected descargar(f: FirmaPrefactura): void {
    this.archivos.contenido(f.archivoId).subscribe({
      next: (blob) => this.archivos.guardarComo(blob, f.archivoNombre ?? `firma-${f.firmanteTipo}`),
      error: () =>
        this.notify.error(
          'No se pudo descargar',
          'No se pudo descargar el documento firmado. Intente de nuevo.',
        ),
    });
  }

  protected readonly rotulo = rotuloAccion;
  protected readonly dia = formatoDia;
  protected readonly moneda = formatoMoneda;
  protected readonly estado = etiquetaEstadoPrefactura;
  protected readonly tono = (p: Prefactura) => ESTADO_PREFACTURA_TONO[p.estado] ?? 'neutral';
  protected readonly verif = (f: FirmaPrefactura) => estadoVerificacion(f, this.sondeoAgotado());
  protected readonly fuente = etiquetaFuente;
  protected readonly medio = etiquetaMedio;
  protected readonly devueltoA = etiquetaDevueltoA;
  protected readonly firmante = etiquetaFirmante;
  protected readonly esPrimaria = (a: AccionPrefactura) => a === 'generar' || a === 'enviar';
}
