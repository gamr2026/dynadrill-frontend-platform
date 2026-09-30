import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ShellActionsService } from '../../../layout/shell-actions.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { QhseIcon, type QhseIconName } from '../shared/components/qhse-icon';

interface Acceso {
  titulo: string;
  descripcion: string;
  icono: QhseIconName;
  link: string;
}

interface Hub {
  titulo: string;
  subtitulo: string;
  accesos: Acceso[];
  /** "Eventos críticos" trae el botón rojo de Reportar (Figma: M · QHSE · Eventos críticos hub). */
  conReportar?: boolean;
}

/** Tres hubs de QHSE (Figma: Planificación / Eventos críticos / Registros de campo) — los destinos de la barra inferior en móvil. */
const HUBS: Record<string, Hub> = {
  planificacion: {
    titulo: 'Planificación',
    subtitulo: 'Matrices, permisos y cumplimiento del SGI',
    accesos: [
      { titulo: 'IPERC', descripcion: 'Matriz Maestra de riesgos', icono: 'clipboard', link: '/dashboard/qhse/iperc' },
      { titulo: 'PTW / Recibimiento', descripcion: 'Permit to Work', icono: 'shield', link: '/dashboard/qhse/ptw' },
      { titulo: 'Documentos por pedido', descripcion: 'Formatos de QHSE', icono: 'file-text', link: '/dashboard/qhse/documentos' },
      { titulo: 'Cumplimiento legal', descripcion: 'Ambiente y SST', icono: 'book', link: '/dashboard/qhse/legal' },
      { titulo: 'Objetivos ambientales', descripcion: 'Revisión anual del SGA', icono: 'leaf', link: '/dashboard/qhse/objetivos-ambientales' },
    ],
  },
  registros: {
    titulo: 'Registros de campo',
    subtitulo: 'Inspecciones, desechos, aspectos ambientales, EPI y checklist de equipos',
    accesos: [
      { titulo: 'Inspecciones', descripcion: 'Eslingas, detectores, grúas', icono: 'clipboard', link: '/dashboard/qhse/inspecciones' },
      { titulo: 'Desechos', descripcion: 'Bitácora y manifiestos', icono: 'leaf', link: '/dashboard/qhse/desechos' },
      { titulo: 'Aspectos ambientales', descripcion: 'Impactos y controles', icono: 'droplet', link: '/dashboard/qhse/aspectos-ambientales' },
      { titulo: 'Entrega de EPI', descripcion: 'Solicitar → despachar', icono: 'helmet', link: '/dashboard/qhse/epi' },
      { titulo: 'Checklist de equipos', descripcion: 'Aprobación por unidad', icono: 'check', link: '/dashboard/qhse/checklist-equipos' },
    ],
  },
  eventos: {
    titulo: 'Eventos críticos',
    subtitulo: 'Observaciones de campo, paradas de trabajo e incidentes',
    conReportar: true,
    accesos: [
      { titulo: 'STOP', descripcion: 'Tarjetas de observación', icono: 'stop', link: '/dashboard/qhse/stop' },
      { titulo: 'Incidentes y Emergencias', descripcion: 'SWA, derrames, emergencias e investigaciones', icono: 'flame', link: '/dashboard/qhse/eventos' },
    ],
  },
};

/** Pantalla de accesos de un grupo de QHSE: título, subtítulo y tarjetas con ícono (Figma "M · QHSE · … (hub)"). */
@Component({
  selector: 'app-qhse-hub-page',
  imports: [PageHeader, RouterLink, QhseIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './qhse-hub-page.html',
  styleUrl: './qhse-hub-page.scss',
})
export class QhseHubPage {
  private readonly actions = inject(ShellActionsService);
  private readonly hubKey = toSignal(inject(ActivatedRoute).data.pipe(map(d => String(d['hub'] ?? 'planificacion'))), { initialValue: 'planificacion' });

  protected readonly hub = computed<Hub>(() => HUBS[this.hubKey()] ?? HUBS['planificacion']);

  protected reportar(): void {
    this.actions.openReportar();
  }
}
