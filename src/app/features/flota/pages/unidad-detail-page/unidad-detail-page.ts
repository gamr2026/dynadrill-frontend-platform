import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillNotificationService,
  DynadrillProgressComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  type DynadrillTagVariant,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { LecturaDialog, type LecturaDialogData } from '../../components/lectura-dialog';
import { PreventivoDialog, type PreventivoDialogData } from '../../components/preventivo-dialog';
import { UnidadFormDialog, type UnidadFormDialogData } from '../../components/unidad-form-dialog';
import {
  CATEGORIA_PESO_LABEL,
  FUENTE_LECTURA_LABEL,
  METRICA_LABEL,
  TIPO_UNIDAD_LABEL,
  type AlertaPreventivaFlota,
  type LecturaFlota,
  type NivelAlertaFlota,
  type PreventivoFlota,
  type UnidadFlota,
} from '../../models/unidad-flota.model';
import { FlotaUnidadesService } from '../../services/flota-unidades.service';
import { formatoFecha, formatoNumero, mensajeDeError } from '../../utils/flota.util';

const TONO: Record<NivelAlertaFlota, DynadrillTagVariant> = { rojo: 'error', amarillo: 'warning', verde: 'success' };
const ETIQUETA: Record<NivelAlertaFlota, string> = { rojo: 'Vencido', amarillo: 'Próximo', verde: 'Al día' };

/** Ficha de una unidad: datos, alertas del preventivo, historial de lecturas y de mantenimientos. */
@Component({
  selector: 'app-unidad-detail-page',
  imports: [
    RouterLink,
    PageHeader,
    DynadrillButtonComponent,
    DynadrillIconComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
    DynadrillProgressComponent,
    DynadrillDataTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidad-detail-page.html',
  styleUrl: './unidad-detail-page.scss',
})
export class UnidadDetailPage {
  private readonly flota = inject(FlotaUnidadesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  /** `:id` de la ruta (enlazado con `withComponentInputBinding`). */
  readonly id = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly unidad = signal<UnidadFlota | null>(null);
  protected readonly alertas = signal<AlertaPreventivaFlota[]>([]);
  protected readonly lecturas = signal<LecturaFlota[]>([]);
  protected readonly preventivos = signal<PreventivoFlota[]>([]);

  protected readonly puedeEditar = computed(() => this.auth.can('flota.unidades.editar'));
  protected readonly puedeInactivar = computed(() => this.auth.can('flota.unidades.inactivar'));
  protected readonly puedeLeer = computed(() => this.auth.can('flota.lecturas.registrar'));
  protected readonly puedePreventivo = computed(() => this.auth.can('flota.preventivos.registrar'));

  /** Las auxiliares se controlan por tiempo: no llevan lecturas. */
  protected readonly llevaLecturas = computed(() => this.unidad()?.tipo !== 'auxiliar');

  protected readonly tipoTexto = computed(() => {
    const u = this.unidad();
    if (!u) return '';
    return u.categoriaPeso ? `${TIPO_UNIDAD_LABEL[u.tipo]} · ${CATEGORIA_PESO_LABEL[u.categoriaPeso]}` : TIPO_UNIDAD_LABEL[u.tipo];
  });

  protected readonly lecturaTexto = computed(() => {
    const u = this.unidad();
    if (!u) return '—';
    const l = u.tipo === 'servicio' ? u.horometro : u.tipo === 'transporte' ? u.odometro : null;
    return l ? `${formatoNumero(l.valor)} ${u.tipo === 'servicio' ? 'h' : 'km'}` : 'Sin lecturas';
  });

  protected readonly datos = computed(() => {
    const u = this.unidad();
    if (!u) return [];
    const v = u.vehiculo;
    return [
      { etiqueta: 'Tipo', valor: this.tipoTexto() },
      { etiqueta: 'Lectura actual', valor: this.lecturaTexto() },
      { etiqueta: 'Placa', valor: v?.placa ?? '—' },
      { etiqueta: 'Marca / modelo', valor: [v?.marca, v?.modelo, v?.anio].filter(Boolean).join(' ') || '—' },
      { etiqueta: 'Proveedor de mantenimiento', valor: u.proveedorMantenimiento?.nombre ?? 'Interno (Dynadrill)' },
      { etiqueta: 'Responsable patrimonial', valor: u.responsablePatrimonial?.nombre ?? '—' },
      { etiqueta: 'Fecha de matrícula', valor: formatoFecha(u.documentos.fechaMatricula) },
      { etiqueta: 'Caducidad de matrícula', valor: formatoFecha(u.documentos.caducidadMatricula) },
      { etiqueta: 'Caducidad de la póliza', valor: formatoFecha(u.documentos.caducidadPoliza) },
      { etiqueta: 'Vigencia de otro documento', valor: formatoFecha(u.documentos.vigenciaOtroDocumento) },
    ];
  });

  protected readonly alertasVista = computed(() =>
    this.alertas().map(a => {
      const unidad = METRICA_LABEL[a.metrica];
      return {
        descripcion: a.descripcion,
        etiqueta: ETIQUETA[a.nivel],
        tono: TONO[a.nivel],
        consumido: Math.max(a.consumido, 0),
        intervalo: a.intervalo,
        estado: progreso(a),
        texto:
          a.restante > 0
            ? `Faltan ${formatoNumero(a.restante)} ${unidad}`
            : a.enVentana
              ? `En ventana de tolerancia (${formatoNumero(-a.restante)} ${unidad} sobre lo previsto)`
              : `Vencido por ${formatoNumero(-a.restante)} ${unidad}`,
      };
    }),
  );

  protected readonly columnasLecturas: DynadrillDataTableColumn[] = [
    { key: 'fecha', header: 'Fecha' },
    { key: 'tipo', header: 'Medida' },
    { key: 'valor', header: 'Valor' },
    { key: 'fuente', header: 'Origen' },
    { key: 'registradaPor', header: 'Registrada por' },
  ];

  protected readonly filasLecturas = computed(() =>
    this.lecturas().map(l => ({
      id: l.id,
      fecha: new Date(l.leidaAt).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }),
      tipo: l.tipo === 'horometro' ? 'Horómetro' : 'Kilometraje',
      valor: `${formatoNumero(l.valor)} ${l.tipo === 'horometro' ? 'h' : 'km'}`,
      fuente: FUENTE_LECTURA_LABEL[l.fuente] ?? l.fuente,
      registradaPor: l.registradaPor?.nombre ?? '—',
    })),
  );

  protected readonly columnasPreventivos: DynadrillTagColumns = [
    { key: 'fecha', header: 'Fecha' },
    { key: 'servicio', header: 'Servicio' },
    { key: 'valor', header: 'Lectura' },
    { key: 'ejecutado', header: 'Lo hizo' },
    { key: 'responsable', header: 'Responsable' },
    { key: 'observaciones', header: 'Observaciones' },
  ];

  protected readonly filasPreventivos = computed(() =>
    this.preventivos().map(p => {
      const u = this.unidad();
      return {
        id: p.id,
        fecha: formatoFecha(p.fecha),
        servicio: p.tipoServicio ? `Tipo ${p.tipoServicio.toUpperCase()}` : 'Preventivo',
        valor: p.valor === null ? '—' : `${formatoNumero(p.valor)} ${u?.tipo === 'servicio' ? 'h' : 'km'}`,
        ejecutado: p.ejecutadoPor === 'tercero' ? (p.proveedor?.nombre ?? 'Tercero') : 'Interno',
        responsable: p.responsable?.nombre ?? '—',
        observaciones: p.observaciones ?? '—',
      };
    }),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    queueMicrotask(() => this.recargar());
  }

  protected recargar(): void {
    this.loading.set(true);
    const id = this.id();
    this.flota.obtener(id).subscribe({
      next: u => {
        this.unidad.set(u);
        this.loading.set(false);
        if (u.tipo !== 'auxiliar') this.flota.lecturas(id).subscribe({ next: l => this.lecturas.set(l), error: () => this.lecturas.set([]) });
        this.flota.preventivos(id).subscribe({ next: p => this.preventivos.set(p), error: () => this.preventivos.set([]) });
        this.flota.alertas().subscribe({
          next: a => this.alertas.set(a.filter(x => x.unidad.id === id)),
          error: () => this.alertas.set([]),
        });
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudo cargar la unidad.');
        void this.router.navigate(['/dashboard/flota/unidades']);
      },
    });
  }

  protected editar(): void {
    const u = this.unidad();
    if (!u) return;
    this.dialog
      .open<UnidadFormDialog, UnidadFormDialogData>({ title: `Editar ${u.codigo}`, content: UnidadFormDialog, data: { unidad: u }, footer: false })
      .afterClose.subscribe(r => r && this.recargar());
  }

  protected registrarLectura(): void {
    const u = this.unidad();
    if (!u) return;
    this.dialog
      .open<LecturaDialog, LecturaDialogData>({ title: `Registrar lectura — ${u.codigo}`, content: LecturaDialog, data: { unidad: u }, footer: false })
      .afterClose.subscribe(r => r && this.recargar());
  }

  protected registrarPreventivo(): void {
    const u = this.unidad();
    if (!u) return;
    this.dialog
      .open<PreventivoDialog, PreventivoDialogData>({ title: `Registrar mantenimiento — ${u.codigo}`, content: PreventivoDialog, data: { unidad: u }, footer: false })
      .afterClose.subscribe(r => r && this.recargar());
  }

  protected async cambiarActiva(): Promise<void> {
    const u = this.unidad();
    if (!u) return;
    const baja = u.activa;
    const confirmado = await this.dialog.confirm({
      title: baja ? 'Dar de baja la unidad' : 'Reactivar la unidad',
      content: baja
        ? `${u.codigo} dejará de aparecer en los listados y no recibirá lecturas ni mantenimientos nuevos. ¿Desea continuar?`
        : `${u.codigo} volverá a estar activa. ¿Desea continuar?`,
      okText: baja ? 'Dar de baja' : 'Reactivar',
      danger: baja,
    });
    if (!confirmado) return;
    this.flota.cambiarActiva(u.id, !baja).subscribe({
      next: nueva => {
        this.unidad.set(nueva);
        this.notify.success(baja ? 'Unidad dada de baja' : 'Unidad reactivada', nueva.codigo);
      },
      error: (e: HttpErrorResponse) => this.notify.error('No se pudo actualizar', mensajeDeError(e, 'No se pudo cambiar el estado de la unidad.')),
    });
  }
}

type DynadrillTagColumns = DynadrillDataTableColumn[];

function progreso(a: AlertaPreventivaFlota): 'normal' | 'active' | 'exception' | 'success' {
  return a.nivel === 'rojo' ? 'exception' : a.nivel === 'amarillo' ? 'active' : 'success';
}
