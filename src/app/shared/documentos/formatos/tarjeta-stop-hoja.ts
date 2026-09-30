import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  STOP_ACCIONES,
  STOP_CONDICIONES,
  type StopBloque,
  type StopCard,
  type StopItemEstado,
} from '../../../features/qhse/stop/models/stop-card.model';
import { fechaDoc, renglones } from '../documento-format.util';

/** Un bloque del formato (subcategoría con sus ítems), ya con el estado marcado por el observador. */
interface Subcategoria {
  titulo: string;
  items: { label: string; estado: StopItemEstado }[];
}

/**
 * Formato DYN-SGI-RE-008 "Tarjeta de observación" — dos páginas: ACCIONES y CONDICIONES, cada ítem con su casillero
 * Seg (seguro) / Ins (inseguro), "Qué observa" y "Acciones". Este formato no lleva sección de firmas: termina en
 * "Quién Reporta" (nombre, fecha, locación, operadora, contacto).
 */
@Component({
  selector: 'app-doc-tarjeta-stop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tarjeta-stop-hoja.html',
  styleUrl: './tarjeta-stop-hoja.scss',
})
export class TarjetaStopHoja {
  readonly tarjeta = input.required<StopCard>();

  protected readonly fecha = fechaDoc;
  protected readonly renglones = renglones;

  protected readonly acciones = computed(() => this.armar('acciones', STOP_ACCIONES));
  protected readonly condiciones = computed(() => this.armar('condiciones', STOP_CONDICIONES));

  private armar(bloque: StopBloque, definicion: Record<string, string[]>): Subcategoria[] {
    const checklist = this.tarjeta().checklist;
    return Object.entries(definicion).map(([titulo, labels]) => ({
      titulo,
      items: labels.map(label => ({
        label,
        estado: checklist.find(i => i.bloque === bloque && i.subcategoria === titulo && i.label === label)?.estado ?? null,
      })),
    }));
  }
}
