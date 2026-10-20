import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, map, type Observable } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillChipGroupComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSpinnerComponent,
  DynadrillTabsComponent,
  type DynadrillTab,
} from '@digitec-it-projects/dynadrill-ui';
import { EntityCard } from '../../../../shared/components/entity-card/entity-card';
import type {
  RecordAction,
  RecordStatus,
} from '../../../../shared/components/record-card/record-card';
import { AuthService } from '../../../../core/services/auth.service';
import { TIPO_PERSONA_LABELS } from '../../../../shared/models/catalogos.model';
import { mensajeDeError } from '../../pedidos-comercial/models/pedido-comercial.model';
import type {
  ClientePlataforma,
  PersonaPlataforma,
} from '../../pedidos-comercial/models/catalogos-plataforma.model';
import { CatalogosPlataformaService } from '../../pedidos-comercial/services/catalogos-plataforma.service';
import { PersonaFormDialog, PersonaFormDialogData } from '../../components/persona-form-dialog';
import { ClienteFormDialog, ClienteFormDialogData } from '../../components/cliente-form-dialog';

/**
 * Personas de contacto y clientes de un Pedido (FACT-001), del catálogo de plataforma. Las acciones de la pantalla se muestran según el
 * permiso de la persona (crear, editar, inactivar); el backend no borra: un registro inactivo ya no se ofrece en pedidos nuevos y se puede reactivar.
 */
@Component({
  selector: 'app-catalogos-ventas-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillButtonComponent,
    DynadrillChipGroupComponent,
    DynadrillDataTableComponent,
    EntityCard,
    DynadrillIconButtonComponent,
    DynadrillSpinnerComponent,
    DynadrillTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalogos-ventas-page.html',
  styleUrl: './catalogos-ventas-page.scss',
})
export class CatalogosVentasPage {
  private readonly catalogosService = inject(CatalogosPlataformaService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  /** Móvil (<840px): tarjetas + botón flotante, como Figma "M · Catálogos". En escritorio, tablas. */
  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 840px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly loading = signal(true);
  protected readonly personas = signal<PersonaPlataforma[]>([]);
  protected readonly clientes = signal<ClientePlataforma[]>([]);

  protected readonly puedeCrearPersona = computed(() => this.auth.can('catalogos.personas.crear'));
  protected readonly puedeEditarPersona = computed(() =>
    this.auth.can('catalogos.personas.editar'),
  );
  protected readonly puedeInactivarPersona = computed(() =>
    this.auth.can('catalogos.personas.inactivar'),
  );
  protected readonly puedeCrearCliente = computed(() => this.auth.can('catalogos.clientes.crear'));
  protected readonly puedeEditarCliente = computed(() =>
    this.auth.can('catalogos.clientes.editar'),
  );
  protected readonly puedeInactivarCliente = computed(() =>
    this.auth.can('catalogos.clientes.inactivar'),
  );

  /** Pestañas en vez de dos cards apiladas — evita tener que bajar para ver a los clientes. */
  protected readonly tabs: DynadrillTab[] = [
    { label: 'Personas de contacto' },
    { label: 'Clientes' },
  ];
  protected readonly activeTabIndex = signal(0);

  // ── Personas ──
  /** El filtro de Tipo vive en el propio header de columna (nz-table nativo) — ver `filters` abajo. */
  protected readonly personasColumns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'nombre', header: 'Nombre', sortable: true, searchable: true },
    {
      key: 'tipoBadge',
      header: 'Tipo',
      type: 'badge',
      filters: [...new Set(this.personas().map((p) => p.tipo))]
        .sort()
        .map((t) => ({ text: TIPO_PERSONA_LABELS[t], value: TIPO_PERSONA_LABELS[t] })),
    },
    { key: 'activoBadge', header: 'Estado', type: 'badge' },
  ]);

  protected readonly personasRows = computed(() =>
    this.personas().map((p) => ({
      id: p.id,
      activo: p.activo,
      nombre: p.nombre,
      tipoBadge: { text: TIPO_PERSONA_LABELS[p.tipo], tone: 'brand' as const },
      activoBadge: p.activo
        ? { text: 'Activo', tone: 'success' as const }
        : { text: 'Inactivo', tone: 'neutral' as const },
    })),
  );

  // Móvil: chips por tipo de persona + tarjetas (Figma "M · Catálogos · Personas de contacto").
  private static readonly TODOS = 'Todos';
  protected readonly tipoChips = [CatalogosVentasPage.TODOS, ...Object.values(TIPO_PERSONA_LABELS)];
  protected readonly tipoFiltro = signal<string>(CatalogosVentasPage.TODOS);
  protected readonly tipoSeleccionado = computed(() => [this.tipoFiltro()]);

  protected onTipoChip(selected: string[]): void {
    this.tipoFiltro.set(selected[0] ?? CatalogosVentasPage.TODOS);
  }

  /** Tarjetas móviles: mismas acciones que la tabla de escritorio (editar / eliminar). */
  protected readonly personasCards = computed(() =>
    this.personas()
      .filter(
        (p) =>
          this.tipoFiltro() === CatalogosVentasPage.TODOS ||
          TIPO_PERSONA_LABELS[p.tipo] === this.tipoFiltro(),
      )
      .map((p) => ({
        id: p.id,
        title: p.nombre,
        lines: [] as string[],
        tags: [
          { text: TIPO_PERSONA_LABELS[p.tipo], tone: 'brand' },
          p.activo ? { text: 'Activo', tone: 'success' } : { text: 'Inactivo', tone: 'neutral' },
        ] as RecordStatus[],
        actions: [
          ...(this.puedeEditarPersona()
            ? [
                {
                  icon: 'edit',
                  label: `Editar a ${p.nombre}`,
                  run: () => this.editarPersona({ id: p.id }),
                },
              ]
            : []),
          ...(this.puedeInactivarPersona() ? [this.accionActivarPersona(p)] : []),
        ] as RecordAction[],
      })),
  );

  protected readonly clientesCards = computed(() =>
    this.clientes().map((c) => ({
      id: c.id,
      title: c.nombreComercial,
      lines: [c.nombreFiscal, `${c.tipoIdentificacion.toUpperCase()} · ${c.identificacion}`].filter(
        (l): l is string => !!l,
      ),
      tags: [
        c.activo ? { text: 'Activo', tone: 'success' } : { text: 'Inactivo', tone: 'neutral' },
      ] as RecordStatus[],
      actions: [
        ...(this.puedeEditarCliente()
          ? [
              {
                icon: 'edit',
                label: `Editar a ${c.nombreComercial}`,
                run: () => this.editarCliente({ id: c.id }),
              },
            ]
          : []),
        ...(this.puedeInactivarCliente() ? [this.accionActivarCliente(c)] : []),
      ] as RecordAction[],
    })),
  );

  // ── Clientes ──
  /** El filtro de Tipo vive en el propio header de columna (nz-table nativo) — ver `filters` abajo. */
  protected readonly clientesColumns = computed<DynadrillDataTableColumn[]>(() => [
    { key: 'nombreComercial', header: 'Nombre comercial', sortable: true, searchable: true },
    { key: 'nombreFiscal', header: 'Nombre fiscal', searchable: true },
    {
      key: 'tipoBadge',
      header: 'Tipo',
      type: 'badge',
      filters: [...new Set(this.clientes().map((c) => c.tipoIdentificacion.toUpperCase()))]
        .sort()
        .map((t) => ({ text: t, value: t })),
    },
    { key: 'identificacion', header: 'Identificación', searchable: true },
    { key: 'activoBadge', header: 'Estado', type: 'badge' },
  ]);

  protected readonly clientesRows = computed(() =>
    this.clientes().map((c) => ({
      id: c.id,
      activo: c.activo,
      nombreComercial: c.nombreComercial,
      nombreFiscal: c.nombreFiscal ?? '—',
      tipoBadge: { text: c.tipoIdentificacion.toUpperCase(), tone: 'brand' as const },
      identificacion: c.identificacion,
      activoBadge: c.activo
        ? { text: 'Activo', tone: 'success' as const }
        : { text: 'Inactivo', tone: 'neutral' as const },
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({
      personas: this.catalogosService.personas(),
      clientes: this.catalogosService.clientes(),
    }).subscribe({
      next: ({ personas, clientes }) => {
        this.personas.set(personas);
        this.clientes.set(clientes);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudieron cargar los catálogos.'));
      },
    });
  }

  // ── Acciones — Personas ──

  protected nuevaPersona(): void {
    this.abrirPersonaDialog();
  }

  protected editarPersona(row: Record<string, unknown>): void {
    const persona = this.personas().find((p) => p.id === row['id']);
    if (persona) this.abrirPersonaDialog(persona);
  }

  private abrirPersonaDialog(persona?: PersonaPlataforma): void {
    const ref = this.dialog.open<PersonaFormDialog, PersonaFormDialogData>({
      title: persona ? 'Editar persona' : 'Nueva persona',
      content: PersonaFormDialog,
      data: { persona },
      footer: false,
    });
    ref.afterClose.subscribe((guardado) => {
      if (guardado) this.reload();
    });
  }

  /** Inactivar pide confirmación; reactivar no (no pierde nada). */
  protected async cambiarEstadoPersona(row: Record<string, unknown>): Promise<void> {
    const id = String(row['id']);
    if (row['activo']) {
      const confirmado = await this.dialog.confirm({
        title: `¿Inactivar a ${row['nombre']}?`,
        content:
          'Ya no se ofrecerá en los pedidos nuevos; los pedidos que ya lo usan no cambian. Puede reactivarlo cuando quiera.',
        okText: 'Inactivar',
        danger: true,
      });
      if (!confirmado) return;
    }
    const peticion: Observable<unknown> = row['activo']
      ? this.catalogosService.inactivarPersona(id)
      : this.catalogosService.actualizarPersona(id, { activo: true });
    peticion.subscribe({
      next: () => {
        this.notify.success(
          row['activo'] ? 'Inactivada' : 'Reactivada',
          `${row['nombre']} quedó ${row['activo'] ? 'inactiva' : 'activa'}.`,
        );
        this.reload();
      },
      error: (err) =>
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cambiar el estado.')),
    });
  }

  private accionActivarPersona(p: PersonaPlataforma): RecordAction {
    return {
      icon: p.activo ? 'delete' : 'check',
      label: `${p.activo ? 'Inactivar' : 'Reactivar'} a ${p.nombre}`,
      run: () => this.cambiarEstadoPersona({ id: p.id, nombre: p.nombre, activo: p.activo }),
    };
  }

  // ── Acciones — Clientes ──

  protected nuevoCliente(): void {
    this.abrirClienteDialog();
  }

  protected editarCliente(row: Record<string, unknown>): void {
    const cliente = this.clientes().find((c) => c.id === row['id']);
    if (cliente) this.abrirClienteDialog(cliente);
  }

  private abrirClienteDialog(cliente?: ClientePlataforma): void {
    const ref = this.dialog.open<ClienteFormDialog, ClienteFormDialogData>({
      title: cliente ? 'Editar cliente' : 'Nuevo cliente',
      content: ClienteFormDialog,
      data: { cliente },
      footer: false,
    });
    ref.afterClose.subscribe((guardado) => {
      if (guardado) this.reload();
    });
  }

  protected async cambiarEstadoCliente(row: Record<string, unknown>): Promise<void> {
    const id = String(row['id']);
    if (row['activo']) {
      const confirmado = await this.dialog.confirm({
        title: `¿Inactivar a ${row['nombreComercial']}?`,
        content:
          'Ya no se ofrecerá en los pedidos nuevos; los pedidos y listas de precios que ya lo usan no cambian. Puede reactivarlo cuando quiera.',
        okText: 'Inactivar',
        danger: true,
      });
      if (!confirmado) return;
    }
    const peticion: Observable<unknown> = row['activo']
      ? this.catalogosService.inactivarCliente(id)
      : this.catalogosService.actualizarCliente(id, { activo: true });
    peticion.subscribe({
      next: () => {
        this.notify.success(
          row['activo'] ? 'Inactivado' : 'Reactivado',
          `${row['nombreComercial']} quedó ${row['activo'] ? 'inactivo' : 'activo'}.`,
        );
        this.reload();
      },
      error: (err) =>
        this.notify.error('Error', mensajeDeError(err, 'No se pudo cambiar el estado.')),
    });
  }

  private accionActivarCliente(c: ClientePlataforma): RecordAction {
    return {
      icon: c.activo ? 'delete' : 'check',
      label: `${c.activo ? 'Inactivar' : 'Reactivar'} a ${c.nombreComercial}`,
      run: () =>
        this.cambiarEstadoCliente({
          id: c.id,
          nombreComercial: c.nombreComercial,
          activo: c.activo,
        }),
    };
  }
}
