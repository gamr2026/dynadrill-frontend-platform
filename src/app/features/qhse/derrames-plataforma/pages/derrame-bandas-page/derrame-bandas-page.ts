import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DynadrillBannerComponent,
  DynadrillButtonComponent,
  DynadrillCheckboxComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTagComponent,
} from '@digitec-it-projects/dynadrill-ui';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { mensajeDeError } from '../../../../../shared/utils/mensaje-error.util';
import { leerBarriles, type BandaConfigurable } from '../../models/derrame';
import { DerrameService } from '../../services/derrame.service';

/** Lo que se edita de una banda: los números van como texto del campo hasta que se guardan. */
interface Borrador {
  nombre: string;
  desde: string;
  hasta: string;
  exigeNotificacionMae: boolean;
  escalaAEmergencia: boolean;
  porConfirmar: boolean;
  activo: boolean;
}

const aBorrador = (b: BandaConfigurable): Borrador => ({
  nombre: b.nombre,
  desde: String(b.desdeBarriles),
  hasta: b.hastaBarriles === null ? '' : String(b.hastaBarriles),
  exigeNotificacionMae: b.exigeNotificacionMae,
  escalaAEmergencia: b.escalaAEmergencia,
  porConfirmar: b.porConfirmar,
  activo: b.activo,
});

/**
 * Configuración de las bandas de volumen de los derrames (permiso `qhse.derrames.configurar`: Gerente HSE y administradores). Los umbrales
 * son un supuesto de la demo y siguen «por confirmar con Dynadrill» hasta que se marquen como confirmados. El backend impide rangos
 * inválidos y bandas activas solapadas, y lo explica.
 */
@Component({
  selector: 'app-derrame-bandas-page',
  imports: [
    PageHeader,
    DynadrillBannerComponent,
    DynadrillButtonComponent,
    DynadrillCheckboxComponent,
    DynadrillInputComponent,
    DynadrillTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './derrame-bandas-page.html',
  styleUrl: './derrame-bandas-page.scss',
})
export class DerrameBandasPage {
  private readonly servicio = inject(DerrameService);
  private readonly notify = inject(DynadrillNotificationService);
  private readonly router = inject(Router);

  protected readonly cargando = signal(true);
  protected readonly bandas = signal<BandaConfigurable[]>([]);
  protected readonly borradores = signal<Record<string, Borrador>>({});
  protected readonly guardando = signal<string | null>(null);

  constructor() {
    this.servicio.bandas().subscribe({
      next: (b) => {
        this.bandas.set(b);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error('Error', mensajeDeError(err, 'No se pudieron cargar las bandas.'));
      },
    });
  }

  protected borrador(b: BandaConfigurable): Borrador {
    return this.borradores()[b.id] ?? aBorrador(b);
  }

  protected cambiar(b: BandaConfigurable, parcial: Partial<Borrador>): void {
    this.borradores.update((m) => ({ ...m, [b.id]: { ...this.borrador(b), ...parcial } }));
  }

  protected hayCambios(b: BandaConfigurable): boolean {
    const actual = this.borrador(b);
    const original = aBorrador(b);
    return (Object.keys(original) as (keyof Borrador)[]).some((k) => actual[k] !== original[k]);
  }

  /** Nombre con texto, «desde» válido y, si hay «hasta», mayor que «desde». */
  protected esValida(b: BandaConfigurable): boolean {
    const d = this.borrador(b);
    const desde = leerBarriles(d.desde);
    const hasta = d.hasta.trim() ? leerBarriles(d.hasta) : null;
    if (!d.nombre.trim() || desde === null) return false;
    if (d.hasta.trim() && hasta === null) return false;
    return hasta === null || hasta > desde;
  }

  protected descartar(b: BandaConfigurable): void {
    this.borradores.update((m) => {
      const { [b.id]: _descartado, ...resto } = m;
      return resto;
    });
  }

  protected guardar(b: BandaConfigurable): void {
    if (!this.hayCambios(b) || !this.esValida(b) || this.guardando()) return;
    const d = this.borrador(b);
    this.guardando.set(b.id);
    this.servicio
      .actualizarBanda(b.id, {
        nombre: d.nombre.trim(),
        desdeBarriles: leerBarriles(d.desde) ?? 0,
        hastaBarriles: d.hasta.trim() ? leerBarriles(d.hasta) : null,
        exigeNotificacionMae: d.exigeNotificacionMae,
        escalaAEmergencia: d.escalaAEmergencia,
        porConfirmar: d.porConfirmar,
        activo: d.activo,
      })
      .subscribe({
        next: (actualizada) => {
          this.guardando.set(null);
          this.bandas.update((lista) => lista.map((x) => (x.id === b.id ? actualizada : x)));
          this.descartar(b);
          this.notify.success('Guardado', `La banda «${actualizada.nombre}» quedó actualizada.`);
        },
        error: (err) => {
          this.guardando.set(null);
          this.notify.error(
            'No se pudo guardar',
            mensajeDeError(err, 'No se pudo guardar la banda.'),
          );
        },
      });
  }

  protected volver(): void {
    void this.router.navigate(['/dashboard/qhse/derrames']);
  }
}
