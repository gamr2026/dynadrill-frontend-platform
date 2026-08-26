import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillButtonComponent,
  DynadrillDialogService,
  DynadrillIconComponent,
  DynadrillIconName,
  DynadrillMenuComponent,
  DynadrillMenuItem,
  DynadrillSpinnerComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { AuthService } from '../../core/services/auth.service';
import { SidebarStateService } from '../sidebar-state.service';
import { ReportarDialog } from '../../features/qhse/shared/components/reportar-dialog';

@Component({
  selector: 'app-sidebar',
  imports: [DynadrillMenuComponent, DynadrillButtonComponent, DynadrillIconComponent, DynadrillSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DynadrillDialogService);
  protected readonly sidebarState = inject(SidebarStateService);

  /** Solo visible en mobile (ver sidebar.scss) — en desktop "Reportar" vive en el header. */
  protected openReportar(): void {
    this.sidebarState.close();
    this.dialogService.open<ReportarDialog>({ title: 'Reportar', content: ReportarDialog, size: 'small', footer: false });
  }

  /**
   * El módulo de Mantenimiento solo aparece para quien tiene un rol de ese
   * flujo. Por ahora, de los tres roles de Mantenimiento, solo el Jefe ve
   * el resto de la aplicación (Administración, Operativo, QHSE) — Operador
   * de Mantenimiento ve ÚNICAMENTE su propia pantalla: nada de otros
   * módulos, ni Administración.
   */
  protected readonly items = computed<DynadrillMenuItem[]>(() => {
    const roleName = this.auth.currentUser()?.roleName;
    const dashboard: DynadrillMenuItem = { label: 'Dashboard', icon: 'home', link: '/dashboard' };

    if (roleName === 'Operador de Mantenimiento') {
      return [dashboard, { label: 'Mis tareas', icon: 'tool' as DynadrillIconName, link: '/dashboard/mantenimiento/mis-tareas' }];
    }

    if (roleName === 'Operador') {
      return [
        dashboard,
        {
          label: 'Módulos',
          icon: 'modules',
          children: [
            {
              label: 'Operativo',
              icon: 'file-text',
              children: [
                { label: 'Pumping', link: '/modulos/operativo/pumping' },
                { label: 'FCR', link: '/modulos/operativo/fcr' },
              ],
            },
            {
              label: 'Mantenimiento',
              icon: 'tool' as DynadrillIconName,
              link: '/dashboard/mantenimiento/operativo',
            },
          ],
        },
      ];
    }

    if (roleName === 'Supervisor') {
      /**
       * HSE-SITIO-001 asigna "Firmar PTW y Actas" al Supervisor Operativo
       * (a diferencia de IPERC, donde el Supervisor solo participa de
       * forma informativa) — por eso entra a Recibimiento de Sitio pero no
       * a Matrices IPERC.
       */
      return [
        dashboard,
        { label: 'Recibimiento de Sitio (PTW)', icon: 'alert' as DynadrillIconName, link: '/dashboard/qhse/ptw' },
        {
          label: 'Módulos',
          icon: 'modules',
          children: [
            {
              label: 'Operativo',
              icon: 'file-text',
              children: [
                { label: 'Pumping', link: '/modulos/operativo/pumping' },
                { label: 'FCR', link: '/modulos/operativo/fcr' },
              ],
            },
          ],
        },
      ];
    }

    const maintenance: DynadrillMenuItem[] =
      roleName === 'Jefe de Mantenimiento'
        ? [{
            label: 'Mantenimiento',
            icon: 'tool' as DynadrillIconName,
            children: [
              { label: 'Bandeja', link: '/dashboard/mantenimiento' },
              { label: 'Indicadores', link: '/dashboard/mantenimiento/kpis' },
            ],
          }]
        : [];

    /**
     * Acceso provisional: mismo rol que ya administra Unidades en
     * Mantenimiento (ver inventario.routes.ts) — a definir si más
     * adelante existe un rol propio de Inventario.
     */
    const inventario: DynadrillMenuItem[] =
      roleName === 'Jefe de Mantenimiento'
        ? [{
            label: 'Inventario',
            icon: 'tool' as DynadrillIconName,
            children: [
              { label: 'Artículos', link: '/dashboard/inventario/articulos' },
              { label: 'Vehículos', link: '/dashboard/inventario/vehiculos' },
            ],
          }]
        : [];

    /**
     * A diferencia de Operativo (visible para cualquier rol "de oficina"),
     * QHSE sí se gatea por rol desde el sidebar — igual que Mantenimiento.
     * Mismas 3 categorías funcionales que la propuesta de composición UI
     * ya validada con el equipo de diseño (Registros/Bitácora, Flujos por
     * fases, Eventos críticos) — 10 ítems planos eran difíciles de escanear.
     * Labels acortados a propósito: el sidebar es angosto y cada nivel de
     * anidamiento le resta espacio horizontal al texto.
     */
    const hse: DynadrillMenuItem[] =
      roleName === 'Técnico HSE' || roleName === 'Coordinador HSE' || roleName === 'Gerente HSE'
        ? [{
            label: 'QHSE',
            icon: 'alert' as DynadrillIconName,
            children: [
              { label: 'Indicadores', link: '/dashboard/qhse/dashboard' },
              {
                label: 'Planificación',
                children: [
                  { label: 'IPERC', link: '/dashboard/qhse/iperc' },
                  { label: 'PTW / Recibimiento', link: '/dashboard/qhse/ptw' },
                ],
              },
              {
                label: 'Registros de campo',
                children: [
                  { label: 'Inspecciones', link: '/dashboard/qhse/inspecciones' },
                  { label: 'Desechos', link: '/dashboard/qhse/desechos' },
                ],
              },
              {
                /**
                 * SWA, Derrames, Emergencias e Investigaciones compartían
                 * exactamente el mismo diseño (header + KPIs + grilla de
                 * tarjetas) — 4 entradas de sidebar para, en esencia, la
                 * misma pantalla. Ahora es una sola bandeja con pestañas
                 * (EventosCriticosListPage). STOP se queda aparte: es
                 * observación preventiva, no un evento ya ocurrido.
                 */
                label: 'Eventos críticos',
                children: [
                  { label: 'STOP', link: '/dashboard/qhse/stop' },
                  { label: 'Incidentes y Emergencias', link: '/dashboard/qhse/eventos' },
                ],
              },
            ],
          }]
        : [];

    return [
      dashboard,
      {
        label: 'Administración',
        icon: 'settings',
        children: [{ label: 'Usuarios', icon: 'users', link: '/dashboard/usuarios' }],
      },
      {
        label: 'Módulos',
        icon: 'modules',
        children: [
          {
            label: 'Operativo',
            icon: 'file-text',
            children: [
              { label: 'Pumping', link: '/modulos/operativo/pumping' },
              { label: 'FCR', link: '/modulos/operativo/fcr' },
            ],
          },
          ...maintenance,
          ...inventario,
          ...hse,
        ],
      },
    ];
  });

  protected readonly loggingOut = signal(false);

  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
