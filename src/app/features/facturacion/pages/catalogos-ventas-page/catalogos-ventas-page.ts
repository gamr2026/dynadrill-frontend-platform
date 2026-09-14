import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillIconButtonComponent,
  DynadrillNotificationService,
  DynadrillScreenHeaderComponent,
  DynadrillSelectComponent,
  DynadrillSpinnerComponent,
  type DynadrillSelectOption,
} from '@digitec-it-projects/dynadrill-ui';
import { CatalogosService } from '../../../../shared/services/catalogos.service';
import { ClienteCatalogo, PersonaContacto, TIPO_PERSONA_LABELS, TipoPersonaContacto } from '../../../../shared/models/catalogos.model';
import { PersonaFormDialog, PersonaFormDialogData } from '../../components/persona-form-dialog';
import { ClienteFormDialog, ClienteFormDialogData } from '../../components/cliente-form-dialog';

/**
 * CRUD de Ventas (FACT-001) sobre las personas de contacto y clientes de un
 * Pedido — antes campos de texto libre siempre vacíos, ahora catálogos
 * reales poblados desde datos_base_dynadrill.xlsx (ver seed-data del
 * backend). Solo Ventas gestiona esto (ver ModuleRoles.personasWrite).
 */
@Component({
  selector: 'app-catalogos-ventas-page',
  imports: [
    DynadrillScreenHeaderComponent,
    DynadrillButtonComponent,
    DynadrillDataTableComponent,
    DynadrillIconButtonComponent,
    DynadrillSelectComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalogos-ventas-page.html',
  styleUrl: './catalogos-ventas-page.scss',
})
export class CatalogosVentasPage {
  private readonly catalogosService = inject(CatalogosService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly notify = inject(DynadrillNotificationService);

  protected readonly loading = signal(true);
  protected readonly personas = signal<PersonaContacto[]>([]);
  protected readonly clientes = signal<ClienteCatalogo[]>([]);

  // ── Personas ──
  protected readonly filtroTipo = signal<TipoPersonaContacto | null>(null);
  protected readonly tipoOptions: DynadrillSelectOption[] = (Object.entries(TIPO_PERSONA_LABELS) as [TipoPersonaContacto, string][]).map(
    ([value, label]) => ({ label, value }),
  );

  protected readonly personasColumns: DynadrillDataTableColumn[] = [
    { key: 'nombre', header: 'Nombre', sortable: true, searchable: true },
    { key: 'tipoBadge', header: 'Tipo', type: 'badge' },
    { key: 'activoBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly personasFiltradas = computed(() => {
    const t = this.filtroTipo();
    return t ? this.personas().filter(p => p.tipo === t) : this.personas();
  });

  protected readonly personasRows = computed(() =>
    this.personasFiltradas().map(p => ({
      id: p.id,
      nombre: p.nombre,
      tipoBadge: { text: TIPO_PERSONA_LABELS[p.tipo], tone: 'brand' as const },
      activoBadge: p.activo ? { text: 'Activo', tone: 'success' as const } : { text: 'Inactivo', tone: 'neutral' as const },
    })),
  );

  // ── Clientes ──
  protected readonly filtroTipoIdentificacion = signal<string | null>(null);
  protected readonly tipoIdentificacionOptions = computed<DynadrillSelectOption[]>(() =>
    [...new Set(this.clientes().map(c => c.tipoIdentificacion))]
      .sort()
      .map(t => ({ label: t.toUpperCase(), value: t })),
  );

  protected readonly clientesColumns: DynadrillDataTableColumn[] = [
    { key: 'nombreComercial', header: 'Nombre comercial', sortable: true, searchable: true },
    { key: 'nombreFiscal', header: 'Nombre fiscal', searchable: true },
    { key: 'tipoBadge', header: 'Tipo', type: 'badge' },
    { key: 'identificacion', header: 'Identificación', searchable: true },
    { key: 'activoBadge', header: 'Estado', type: 'badge' },
  ];

  protected readonly clientesFiltrados = computed(() => {
    const t = this.filtroTipoIdentificacion();
    return t ? this.clientes().filter(c => c.tipoIdentificacion === t) : this.clientes();
  });

  protected readonly clientesRows = computed(() =>
    this.clientesFiltrados().map(c => ({
      id: c.id,
      nombreComercial: c.nombreComercial,
      nombreFiscal: c.nombreFiscal ?? '—',
      tipoBadge: { text: c.tipoIdentificacion.toUpperCase(), tone: 'brand' as const },
      identificacion: c.identificacion,
      activoBadge: c.activo ? { text: 'Activo', tone: 'success' as const } : { text: 'Inactivo', tone: 'neutral' as const },
    })),
  );

  protected readonly rowKeyFn = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    forkJoin({ personas: this.catalogosService.personas(), clientes: this.catalogosService.clientes() }).subscribe({
      next: ({ personas, clientes }) => {
        this.personas.set(personas);
        this.clientes.set(clientes);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Error', 'No se pudieron cargar los catálogos.');
      },
    });
  }

  // ── Acciones — Personas ──

  protected nuevaPersona(): void {
    this.abrirPersonaDialog();
  }

  protected editarPersona(row: Record<string, unknown>): void {
    const persona = this.personas().find(p => p.id === row['id']);
    if (persona) this.abrirPersonaDialog(persona);
  }

  private abrirPersonaDialog(persona?: PersonaContacto): void {
    const ref = this.dialog.open<PersonaFormDialog, PersonaFormDialogData>({
      title: persona ? 'Editar persona' : 'Nueva persona',
      content: PersonaFormDialog,
      data: { persona, tipoInicial: this.filtroTipo() ?? undefined },
      footer: false,
    });
    ref.afterClose.subscribe(guardado => {
      if (guardado) this.reload();
    });
  }

  protected async eliminarPersona(row: Record<string, unknown>): Promise<void> {
    const confirmado = await this.dialog.confirm({
      title: `¿Eliminar a ${row['nombre']}?`,
      content: 'Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      danger: true,
    });
    if (!confirmado) return;
    this.catalogosService.eliminarPersona(row['id'] as number).subscribe({
      next: () => {
        this.notify.success('Eliminado', 'Persona eliminada.');
        this.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo eliminar.'),
    });
  }

  // ── Acciones — Clientes ──

  protected nuevoCliente(): void {
    this.abrirClienteDialog();
  }

  protected editarCliente(row: Record<string, unknown>): void {
    const cliente = this.clientes().find(c => c.id === row['id']);
    if (cliente) this.abrirClienteDialog(cliente);
  }

  private abrirClienteDialog(cliente?: ClienteCatalogo): void {
    const ref = this.dialog.open<ClienteFormDialog, ClienteFormDialogData>({
      title: cliente ? 'Editar cliente' : 'Nuevo cliente',
      content: ClienteFormDialog,
      data: { cliente },
      footer: false,
    });
    ref.afterClose.subscribe(guardado => {
      if (guardado) this.reload();
    });
  }

  protected async eliminarCliente(row: Record<string, unknown>): Promise<void> {
    const confirmado = await this.dialog.confirm({
      title: `¿Eliminar a ${row['nombreComercial']}?`,
      content: 'Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      danger: true,
    });
    if (!confirmado) return;
    this.catalogosService.eliminarCliente(row['id'] as number).subscribe({
      next: () => {
        this.notify.success('Eliminado', 'Cliente eliminado.');
        this.reload();
      },
      error: () => this.notify.error('Error', 'No se pudo eliminar.'),
    });
  }
}
