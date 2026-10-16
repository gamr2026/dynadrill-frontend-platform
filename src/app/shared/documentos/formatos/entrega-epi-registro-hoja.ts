import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { EntregaEpi, RenglonEpi } from '../../../features/qhse/entrega-epi/models/entrega-epi';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaDoc } from '../documento-format.util';

/** El formato trae 12 renglones; si la entrega tiene más elementos se imprimen todos. */
const RENGLONES_MINIMOS = 12;

/**
 * Formato DYN-SGI-RE-032 "Registro de entrega de EPI y ropa de trabajo", con la entrega del backend nuevo (el trabajador es una
 * cuenta: su cédula y cargo salen del perfil). En "Fecha / Firma recibido" va quien recibe (el trabajador) y en "entregado" quien
 * despachó (QHSE); la firma en sí se pone sobre el PDF. Abajo, "Recibe conforme Talento Humano".
 */
@Component({
  selector: 'app-doc-entrega-epi-registro',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entrega-epi-registro-hoja.html',
  // el mismo diseño que la hoja de la demo
  styleUrl: './entrega-epi-hoja.scss',
})
export class EntregaEpiRegistroHoja {
  readonly entrega = input.required<EntregaEpi>();

  protected readonly fecha = fechaDoc;

  protected readonly filas = computed<(RenglonEpi | null)[]>(() => {
    const items: (RenglonEpi | null)[] = [...this.entrega().renglones];
    while (items.length < RENGLONES_MINIMOS) items.push(null);
    return items;
  });

  /** Quien entrega: el nombre que quedó en el despacho. */
  protected readonly entregadoPor = computed(() => this.entrega().despachado?.nombre ?? '');
}
