import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  DynadrillButtonComponent,
  DynadrillDataTableColumn,
  DynadrillDataTableComponent,
  DynadrillDialogService,
  DynadrillSpinnerComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../../../core/services/auth.service';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import {
  PermisoConductorDialog,
  type PermisoConductorDialogData,
} from '../../components/permiso-conductor-dialog';
import type { ConductorEstado } from '../../models/inspeccion-flota.model';
import { FlotaInspeccionesService } from '../../services/flota-inspecciones.service';
import { formatoFecha } from '../../utils/flota.util';

/** Documentos con vigencia de los conductores: quién reúne las condiciones para conducir y qué vence pronto. */
@Component({
  selector: 'app-conductores-page',
  imports: [
    PageHeader,
    DynadrillDataTableComponent,
    DynadrillButtonComponent,
    DynadrillSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      eyebrow="Flota"
      title="Conductores"
      subtitle="Documentos con vigencia: sin ellos al día no se puede guardar la inspección del vehículo"
    />
    <dynadrill-spinner mode="overlay" [spinning]="cargando()" tip="Cargando conductores…">
      <dynadrill-data-table
        [columns]="columnas"
        [rows]="filas()"
        [rowKey]="clave"
        [pageSize]="10"
        [actionsTemplate]="acciones"
      />
    </dynadrill-spinner>
    <ng-template #acciones let-row>
      <div class="dyn-actions-row">
        @if (puedeGestionar()) {
          <dynadrill-button variant="secondary" size="small" (clicked)="registrar(row['id'])"
            >Registrar documento</dynadrill-button
          >
        }
      </div>
    </ng-template>
  `,
})
export class ConductoresPage {
  private readonly api = inject(FlotaInspeccionesService);
  private readonly dialog = inject(DynadrillDialogService);
  private readonly auth = inject(AuthService);

  protected readonly cargando = signal(true);
  protected readonly conductores = signal<ConductorEstado[]>([]);
  protected readonly puedeGestionar = computed(() => this.auth.can('flota.conductores.gestionar'));

  protected readonly columnas: DynadrillDataTableColumn[] = [
    { key: 'nombre', header: 'Conductor', sortable: true, searchable: true },
    { key: 'estado', header: 'Condiciones', type: 'badge' },
    { key: 'pendientes', header: 'Documentos por atender' },
  ];

  protected readonly filas = computed(() =>
    this.conductores().map((c) => {
      const vencidos = c.documentos.filter(
        (d) => d.estado === 'vencido' || d.estado === 'faltante',
      );
      const porVencer = c.documentos.filter((d) => d.estado === 'por_vencer');
      return {
        id: c.usuario.id,
        nombre: c.usuario.nombre,
        estado: c.reuneCondiciones
          ? { text: 'Reúne las condiciones', tone: 'success' as const }
          : { text: 'No reúne las condiciones', tone: 'error' as const },
        pendientes:
          [
            ...vencidos.map(
              (d) => `${d.tipo.nombre} (${d.estado === 'vencido' ? 'vencido' : 'sin registrar'})`,
            ),
            ...porVencer.map((d) => `${d.tipo.nombre} (vence ${formatoFecha(d.vigenteHasta)})`),
          ].join(' · ') || '—',
      };
    }),
  );

  protected readonly clave = (row: Record<string, unknown>): string => String(row['id']);

  constructor() {
    this.recargar();
  }

  private recargar(): void {
    this.cargando.set(true);
    this.api.conductores().subscribe({
      next: (c) => {
        this.conductores.set(c);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  protected registrar(usuarioId: string): void {
    const conductor = this.conductores().find((c) => c.usuario.id === usuarioId);
    if (!conductor) return;
    this.dialog
      .open<PermisoConductorDialog, PermisoConductorDialogData>({
        title: 'Registrar documento del conductor',
        content: PermisoConductorDialog,
        data: { conductor },
        footer: false,
      })
      .afterClose.subscribe((r) => r && this.recargar());
  }
}
