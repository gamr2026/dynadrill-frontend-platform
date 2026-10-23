import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDatetimePickerComponent,
  DynadrillDrawerService,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  DynadrillTagComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { toLocalDateString } from '../../../shared/utils/date.util';
import { mensajeError } from '../../roles-permisos/models/roles-permisos.model';
import { UsersService } from '../../users/services/users.service';
import {
  LineaDeTiempoPanel,
  type LineaDeTiempoPanelData,
} from '../components/linea-de-tiempo-panel';
import {
  FILTROS_VACIOS,
  LIMITE_PAGINA,
  datosLegibles,
  errorDeFiltros,
  etiquetaEvento,
  etiquetaOrigen,
  etiquetaSujeto,
  hayFiltros,
  resumenPagina,
  type CatalogosAuditoria,
  type EventoAuditado,
  type FiltrosAuditoria,
} from '../models/auditoria.model';
import { AuditoriaService } from '../services/auditoria.service';

const opcion = (value: string, label: string): DynadrillSelectOption => ({ label, value });

/**
 * Auditoría: el registro inmutable de lo que pasó en el sistema (quién, qué, cuándo y sobre qué entidad), con búsqueda y la línea de
 * tiempo de cada entidad. Solo la ve el Superadmin (`auditoria.eventos.ver`).
 */
@Component({
  selector: 'app-auditoria-page',
  imports: [
    DatePipe,
    PageHeader,
    DynadrillButtonComponent,
    DynadrillDatetimePickerComponent,
    DynadrillIconButtonComponent,
    DynadrillInputComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auditoria-page.html',
  styleUrl: './auditoria-page.scss',
})
export class AuditoriaPage {
  private readonly servicio = inject(AuditoriaService);
  private readonly usuarios = inject(UsersService);
  private readonly drawer = inject(DynadrillDrawerService);

  protected readonly catalogos = signal<CatalogosAuditoria | null>(null);
  private readonly personas = signal<DynadrillSelectOption[]>([]);
  protected readonly filtros = signal<FiltrosAuditoria>({ ...FILTROS_VACIOS });
  protected readonly desde = signal<Date | null>(null);
  protected readonly hasta = signal<Date | null>(null);

  protected readonly eventos = signal<EventoAuditado[]>([]);
  protected readonly total = signal(0);
  protected readonly pagina = signal(1);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly buscado = signal(false);

  protected readonly errorFiltros = computed(() => errorDeFiltros(this.filtros()));
  protected readonly conFiltros = computed(() => hayFiltros(this.filtros()));
  protected readonly resumen = computed(() =>
    resumenPagina(this.pagina(), LIMITE_PAGINA, this.eventos().length, this.total()),
  );
  protected readonly hayAnterior = computed(() => this.pagina() > 1);
  protected readonly haySiguiente = computed(() => this.pagina() * LIMITE_PAGINA < this.total());

  protected readonly origenOpciones = computed(() =>
    (this.catalogos()?.origenes ?? []).map((o) => opcion(o, etiquetaOrigen(o))),
  );
  protected readonly tipoOpciones = computed(() =>
    (this.catalogos()?.tiposEvento ?? []).map((t) => opcion(t, `${etiquetaEvento(t)} · ${t}`)),
  );
  protected readonly sujetoOpciones = computed(() =>
    (this.catalogos()?.sujetoTipos ?? []).map((s) => opcion(s, etiquetaSujeto(s))),
  );
  protected readonly claveOpciones = computed(() =>
    (this.catalogos()?.claves ?? []).map((c) => opcion(c.codigo, c.descripcion)),
  );
  protected readonly actorOpciones = computed(() => this.personas());

  constructor() {
    this.servicio.catalogos().subscribe({
      next: (c) => this.catalogos.set(c),
      error: (err) =>
        this.error.set(mensajeError(err, 'No se pudieron cargar las opciones de búsqueda.')),
    });
    this.usuarios.list().subscribe({
      next: (lista) =>
        this.personas.set(
          lista
            .map((u) => opcion(u.id, u.name))
            .sort((a, b) => a.label.localeCompare(b.label, 'es')),
        ),
      // sin la lista de personas se puede buscar igual, solo sin el filtro por quién actuó
      error: () => this.personas.set([]),
    });
    this.buscar(1);
  }

  protected poner<K extends keyof FiltrosAuditoria>(campo: K, valor: unknown): void {
    this.filtros.update((f) => ({
      ...f,
      [campo]: (valor === '' || valor === undefined
        ? FILTROS_VACIOS[campo]
        : valor) as FiltrosAuditoria[K],
    }));
  }

  protected ponerFecha(campo: 'desde' | 'hasta', fecha: Date | null): void {
    (campo === 'desde' ? this.desde : this.hasta).set(fecha);
    this.poner(campo, fecha ? toLocalDateString(fecha) : null);
  }

  protected limpiar(): void {
    this.filtros.set({ ...FILTROS_VACIOS });
    this.desde.set(null);
    this.hasta.set(null);
    this.buscar(1);
  }

  protected buscarConFiltros(): void {
    if (this.errorFiltros()) return;
    this.buscar(1);
  }

  protected irA(delta: number): void {
    this.buscar(this.pagina() + delta);
  }

  private buscar(pagina: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.buscar(this.filtros(), pagina, LIMITE_PAGINA).subscribe({
      next: (r) => {
        this.eventos.set(r.items);
        this.total.set(r.total);
        this.pagina.set(r.pagina);
        this.cargando.set(false);
        this.buscado.set(true);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeError(err, 'No se pudo consultar la auditoría. Intente de nuevo.'));
      },
    });
  }

  protected verLineaDeTiempo(e: EventoAuditado): void {
    this.drawer.open<LineaDeTiempoPanel, LineaDeTiempoPanelData>({
      title: `Línea de tiempo · ${etiquetaSujeto(e.sujeto.tipo)}`,
      content: LineaDeTiempoPanel,
      data: {
        sujetoTipo: e.sujeto.tipo,
        sujetoId: e.sujeto.id,
        claves: this.catalogos()?.claves ?? [],
      },
      size: 'medium',
    });
  }

  protected readonly etiqueta = (e: EventoAuditado) => etiquetaEvento(e.tipo);
  protected readonly origen = etiquetaOrigen;
  protected readonly sujeto = etiquetaSujeto;
  protected readonly datos = (e: EventoAuditado) =>
    datosLegibles(e.datos, this.catalogos()?.claves ?? []);
}
