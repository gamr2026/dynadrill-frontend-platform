import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import { catchError, of, switchMap, timer } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillContextCardComponent,
  DynadrillDatetimePickerComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillTagComponent,
  DynadrillUploadZoneComponent,
  type DynadrillContextCardItem,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../../core/services/auth.service';
import { DocumentoPdfService } from '../../../../../shared/documentos';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import { CatalogosPlataformaService } from '../../../../facturacion/pedidos-comercial/services/catalogos-plataforma.service';
import { GuiaDesechosHoja } from '../../components/guia-desechos-hoja';
import {
  ESTADO_DESECHO_ETIQUETA,
  ROL_FIRMA_ACCION,
  ROL_FIRMA_ETIQUETA,
  TIPO_DOCUMENTO_ETIQUETA,
  PERMISO_DESECHOS_GESTIONAR,
  avisoCertificado,
  documentoDe,
  etiquetaContenedor,
  fechaCorta,
  fechaIso,
  firmaPideFirmante,
  lecturaDeFirma,
  textoLimite,
  tonoLimite,
  totalGalones,
  type DesechoDetalle,
  type DocumentoDesecho,
  type FirmaDesecho,
  type GuiaDesecho,
  type RolFirma,
  type TipoDocumentoDesecho,
} from '../../models/desecho';
import { DesechoService } from '../../services/desecho.service';

/** El archivo real que entrega la zona de carga (a veces viene dentro de `originFileObj`). */
const archivoDe = (f: NzUploadFile): File =>
  (f.originFileObj as File | undefined) ?? (f as unknown as File);

/** HSE-AMBIENTAL-001 — manifiesto único (tres firmas), manifiesto firmado y certificado de disposición final. */
@Component({
  selector: 'app-desecho-detail-page',
  imports: [
    DatePipe,
    DynadrillScreenHeaderComponent,
    DynadrillContextCardComponent,
    DynadrillButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillDatetimePickerComponent,
    DynadrillTagComponent,
    DynadrillUploadZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './desecho-detail-page.html',
  styleUrl: './desecho-detail-page.scss',
})
export class DesechoDetailPage {
  private readonly servicio = inject(DesechoService);
  private readonly catalogos = inject(CatalogosPlataformaService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly auth = inject(AuthService);
  private readonly documentoPdf = inject(DocumentoPdfService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private destruido = false;

  protected readonly estadoLabels = ESTADO_DESECHO_ETIQUETA;
  protected readonly etiquetaRol = ROL_FIRMA_ETIQUETA;
  protected readonly accionRol = ROL_FIRMA_ACCION;
  protected readonly etiquetaDocumento = TIPO_DOCUMENTO_ETIQUETA;
  protected readonly fechaCorta = fechaCorta;
  protected readonly lectura = lecturaDeFirma;
  protected readonly pideFirmante = firmaPideFirmante;
  protected readonly textoLimite = textoLimite;

  protected readonly loading = signal(true);
  protected readonly desecho = signal<DesechoDetalle | null>(null);
  /** La acción en curso (para bloquear los botones mientras el servidor responde). */
  protected readonly enviando = signal<string | null>(null);
  protected readonly verificando = signal<TipoDocumentoDesecho | null>(null);

  protected readonly puedeGestionar = computed(() => this.auth.can(PERMISO_DESECHOS_GESTIONAR));

  // ── Manifiesto: se genera con estos datos; el mismo formulario completa el transporte y las horas después ──
  protected readonly manifiestoNumero = signal('');
  protected readonly gestorNombre = signal('');
  protected readonly gestorLicenciaSuia = signal('');
  protected readonly clienteId = signal('');
  protected readonly solicitadoPor = signal('');
  protected readonly companiaTransportista = signal('');
  protected readonly conductorNombre = signal('');
  protected readonly conductorCedula = signal('');
  protected readonly vehiculo = signal('');
  protected readonly placas = signal('');
  protected readonly horaSalida = signal<Date | null>(null);
  protected readonly horaLlegada = signal<Date | null>(null);
  protected readonly clientes = signal<DynadrillSelectOption[]>([]);
  protected readonly editandoGuia = signal(false);

  // ── Firmas ──
  protected readonly firmando = signal<RolFirma | null>(null);
  protected readonly firmanteNombre = signal('');
  protected readonly firmanteCedula = signal('');

  // ── Documentos ──
  protected readonly manifiestoFirmadoArchivo = signal<File | null>(null);
  protected readonly manifiestoFirmadoReferencia = signal('');
  protected readonly certificadoArchivo = signal<File | null>(null);
  protected readonly certificadoReferencia = signal('');
  protected readonly certificadoFecha = signal<Date | null>(new Date());

  protected readonly contextItems = computed<DynadrillContextCardItem[]>(() => {
    const d = this.desecho();
    if (!d) return [];
    const m = d.manifiesto;
    return [
      { label: 'Desecho', value: d.codigo },
      { label: 'Contenedor', value: etiquetaContenedor(d.contenedor) },
      ...(d.cretib.length ? [{ label: 'Características CRETIB', value: d.cretib.join(', ') }] : []),
      { label: 'Ítems', value: `${d.items.length} (${totalGalones(d.items)} gal)` },
      ...(d.ubicacion ? [{ label: 'Ubicación', value: d.ubicacion }] : []),
      { label: 'Generado por', value: d.generadoPor ?? '—' },
      { label: 'Estado', value: ESTADO_DESECHO_ETIQUETA[d.estado.codigo] },
      {
        label: 'Límite de almacenamiento (12 meses)',
        value:
          d.estado.codigo === 'dispuesto'
            ? fechaCorta(d.limiteAlmacenamientoHasta)
            : `${fechaCorta(d.limiteAlmacenamientoHasta)} — ${textoLimite(d)}`,
      },
      ...(d.derrame ? [{ label: 'Derrame de origen', value: d.derrame.codigo }] : []),
      ...(m?.cliente
        ? [{ label: 'Cliente', value: `${m.cliente.nombre} — RUC ${m.cliente.identificacion}` }]
        : []),
      ...(m?.transportista.conductor
        ? [
            {
              label: 'Transportista',
              value: `${m.transportista.conductor} — ${m.transportista.vehiculo ?? '—'} (${m.transportista.placas ?? '—'})`,
            },
          ]
        : []),
    ];
  });

  protected readonly tonoLimiteDesecho = computed(() => {
    const d = this.desecho();
    return d ? tonoLimite(d) : 'neutral';
  });

  protected readonly dispuesto = computed(() => this.desecho()?.estado.codigo === 'dispuesto');

  protected readonly puedeGenerarManifiesto = computed(
    () =>
      this.manifiestoNumero().trim().length > 0 &&
      this.gestorNombre().trim().length > 0 &&
      this.gestorLicenciaSuia().trim().length > 0 &&
      this.enviando() === null,
  );

  /** El manifiesto está abierto (sin las tres firmas): todavía se completan el transporte y las horas. */
  protected readonly guiaEditable = computed(() => {
    const d = this.desecho();
    return !!d?.manifiesto && !d.manifiesto.firmasCompletas && d.estado.codigo !== 'dispuesto';
  });

  protected readonly puedeSubirDocumentos = computed(() => {
    const d = this.desecho();
    return (
      this.puedeGestionar() &&
      !!d?.manifiesto?.firmasCompletas &&
      d.estado.codigo === 'con_manifiesto'
    );
  });

  protected readonly manifiestoFirmado = computed(() => {
    const d = this.desecho();
    return d ? documentoDe(d, 'manifiesto_firmado') : null;
  });

  protected readonly certificado = computed(() => {
    const d = this.desecho();
    return d ? documentoDe(d, 'certificado_disposicion') : null;
  });

  protected readonly avisoPlazo = computed(() => {
    const d = this.desecho();
    return d?.manifiesto ? avisoCertificado(d.manifiesto, this.dispuesto()) : null;
  });

  protected readonly puedeRegistrarCertificado = computed(
    () =>
      this.certificadoArchivo() !== null &&
      this.certificadoFecha() !== null &&
      this.enviando() === null,
  );

  protected readonly puedeConfirmarFirma = computed(() => {
    const rol = this.firmando();
    if (!rol || this.enviando() !== null) return false;
    return (
      !firmaPideFirmante(rol) ||
      (this.firmanteNombre().trim().length > 0 && this.firmanteCedula().trim().length > 0)
    );
  });

  constructor() {
    this.destroyRef.onDestroy(() => (this.destruido = true));
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.servicio.detalle(id).subscribe({
      next: (d) => {
        this.aplicar(d);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cargar el desecho.'));
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────── manifiesto

  protected cargarClientes(): void {
    if (this.clientes().length) return;
    this.catalogos
      .clientes()
      .pipe(catchError(() => of([])))
      .subscribe((lista) =>
        this.clientes.set(lista.map((c) => ({ value: c.id, label: c.nombreComercial }))),
      );
  }

  private guiaDelFormulario(): GuiaDesecho {
    const texto = (v: string): string => v.trim();
    return {
      ...(this.clienteId() ? { clienteId: this.clienteId() } : {}),
      solicitadoPor: texto(this.solicitadoPor()),
      transportistaCompania: texto(this.companiaTransportista()),
      conductorNombre: texto(this.conductorNombre()),
      conductorCedula: texto(this.conductorCedula()),
      vehiculo: texto(this.vehiculo()),
      placas: texto(this.placas()),
      ...(this.horaSalida() ? { horaSalida: this.horaSalida()?.toISOString() } : {}),
      ...(this.horaLlegada() ? { horaLlegada: this.horaLlegada()?.toISOString() } : {}),
    };
  }

  protected generarManifiesto(): void {
    const d = this.desecho();
    if (!d || !this.puedeGenerarManifiesto()) return;
    this.enviar(
      'manifiesto',
      () =>
        this.servicio.generarManifiesto(d.id, {
          numero: this.manifiestoNumero().trim(),
          gestorNombre: this.gestorNombre().trim(),
          gestorLicenciaSuia: this.gestorLicenciaSuia().trim(),
          ...this.guiaDelFormulario(),
        }),
      'Manifiesto generado.',
    );
  }

  protected editarGuia(): void {
    const m = this.desecho()?.manifiesto;
    if (!m) return;
    this.cargarClientes();
    this.solicitadoPor.set(m.solicitadoPor ?? '');
    this.companiaTransportista.set(m.transportista.compania ?? '');
    this.conductorNombre.set(m.transportista.conductor ?? '');
    this.conductorCedula.set(m.transportista.cedulaConductor ?? '');
    this.vehiculo.set(m.transportista.vehiculo ?? '');
    this.placas.set(m.transportista.placas ?? '');
    this.horaSalida.set(m.horaSalida ? new Date(m.horaSalida) : null);
    this.horaLlegada.set(m.horaLlegada ? new Date(m.horaLlegada) : null);
    this.editandoGuia.set(true);
  }

  protected guardarGuia(): void {
    const d = this.desecho();
    if (!d || this.enviando() !== null) return;
    this.enviar(
      'guia',
      () => this.servicio.actualizarGuia(d.id, this.guiaDelFormulario()),
      'Guía actualizada.',
    );
  }

  // ───────────────────────────────────────────────────────────────────────────────── firmas

  protected iniciarFirma(rol: RolFirma): void {
    if (!firmaPideFirmante(rol)) {
      this.confirmarFirma(rol);
      return;
    }
    this.firmanteNombre.set('');
    this.firmanteCedula.set('');
    this.firmando.set(rol);
  }

  protected cancelarFirma(): void {
    this.firmando.set(null);
  }

  protected confirmarFirma(rol: RolFirma | null = this.firmando()): void {
    const d = this.desecho();
    if (!d || !rol || this.enviando() !== null) return;
    const firmante = firmaPideFirmante(rol)
      ? {
          firmanteNombre: this.firmanteNombre().trim(),
          firmanteCedula: this.firmanteCedula().trim(),
        }
      : undefined;
    this.enviar(
      `firma-${rol}`,
      () => this.servicio.firmar(d.id, rol, firmante),
      'Firma registrada.',
    );
  }

  protected textoFirma(f: FirmaDesecho): string {
    if (f.firmanteNombre)
      return `Confirmado: ${f.firmanteNombre} (cédula ${f.firmanteCedula}) — registrado por ${f.registradoPor}`;
    return `Confirmado por ${f.registradoPor}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────── documentos

  protected onManifiestoFirmado(f: NzUploadFile): void {
    this.manifiestoFirmadoArchivo.set(archivoDe(f));
  }

  protected onCertificado(f: NzUploadFile): void {
    this.certificadoArchivo.set(archivoDe(f));
  }

  protected cargarManifiestoFirmado(): void {
    const d = this.desecho();
    const archivo = this.manifiestoFirmadoArchivo();
    if (!d || !archivo || this.enviando() !== null) return;
    this.enviar(
      'manifiesto-firmado',
      () =>
        this.servicio.cargarManifiestoFirmado(d.id, archivo, this.manifiestoFirmadoReferencia()),
      'Manifiesto firmado cargado.',
    );
  }

  protected registrarCertificado(): void {
    const d = this.desecho();
    const archivo = this.certificadoArchivo();
    const fecha = this.certificadoFecha();
    if (!d || !archivo || !fecha || this.enviando() !== null) return;
    this.enviar(
      'certificado',
      () =>
        this.servicio.registrarCertificado(
          d.id,
          archivo,
          fechaIso(fecha),
          this.certificadoReferencia(),
        ),
      'Certificado registrado: el desecho quedó dispuesto.',
    );
  }

  protected volverALeer(doc: DocumentoDesecho): void {
    const d = this.desecho();
    if (!d || this.verificando()) return;
    this.verificando.set(doc.tipo);
    this.servicio.verificar(d.id, doc.tipo).subscribe({
      next: (nuevo) => {
        this.verificando.set(null);
        this.aplicar(nuevo);
      },
      error: (err) => {
        this.verificando.set(null);
        this.notify.error(
          'No se pudo leer',
          mensajeDeError(err, 'No se pudo volver a leer la firma.'),
        );
      },
    });
  }

  protected verArchivo(doc: DocumentoDesecho): void {
    this.servicio.abrir(doc.archivoId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (err) =>
        this.notify.error(
          'No se pudo abrir',
          mensajeDeError(err, 'No se pudo abrir el documento.'),
        ),
    });
  }

  protected verPdf(): void {
    const desecho = this.desecho();
    if (!desecho) return;
    this.documentoPdf.abrir({
      titulo: `Guía de remisión de desechos — ${desecho.codigo}`,
      component: GuiaDesechosHoja,
      inputs: { desecho },
      nombreArchivo: `Guía de remisión de desechos ${desecho.codigo}`,
    });
  }

  protected back(): void {
    this.router.navigate(['/dashboard/qhse/desechos']);
  }

  // ───────────────────────────────────────────────────────────────────────────────── internos

  /** Ejecuta una acción del servidor; el backend devuelve el detalle nuevo y su mensaje de error se muestra tal cual. */
  private enviar(
    clave: string,
    accion: () => ReturnType<DesechoService['detalle']>,
    exito: string,
  ): void {
    this.enviando.set(clave);
    accion().subscribe({
      next: (d) => {
        this.enviando.set(null);
        this.aplicar(d);
        this.notify.success('Listo', exito);
      },
      error: (err) => {
        this.enviando.set(null);
        this.notify.error(
          'No se pudo guardar',
          mensajeDeError(err, 'No se pudo guardar el cambio.'),
        );
      },
    });
  }

  private aplicar(d: DesechoDetalle): void {
    this.desecho.set(d);
    // el cliente solo se elige al generar el manifiesto: se piden los clientes cuando se va a mostrar el formulario
    if (!d.manifiesto && this.puedeGestionar()) this.cargarClientes();
    this.firmando.set(null);
    this.editandoGuia.set(false);
    this.manifiestoFirmadoArchivo.set(null);
    this.manifiestoFirmadoReferencia.set('');
    this.certificadoArchivo.set(null);
    this.certificadoReferencia.set('');
    this.sondear(d.id);
  }

  /** La lectura de la firma tarda unos segundos: se vuelve a consultar mientras haya resultados pendientes (hasta ~40 s). */
  private sondear(id: string, intento = 0): void {
    const d = this.desecho();
    if (this.destruido || intento >= 14 || !d?.documentos.some((x) => x.verificacionAt === null))
      return;
    timer(3000)
      .pipe(switchMap(() => this.servicio.detalle(id)))
      .subscribe({
        next: (nuevo) => {
          if (this.destruido) return;
          this.desecho.set(nuevo);
          this.sondear(id, intento + 1);
        },
        error: () => undefined,
      });
  }
}
