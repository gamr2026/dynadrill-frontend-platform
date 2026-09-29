import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import type { NzUploadFile } from 'ng-zorro-antd/upload';
import * as XLSX from 'xlsx';
import {
  DynadrillButtonComponent,
  DynadrillIconButtonComponent,
  DynadrillInputComponent,
  DynadrillNotificationService,
  DynadrillTextComponent,
  DynadrillTextareaComponent,
  DynadrillUploadZoneComponent,
} from '@digitec-it-projects/dynadrill-ui';
import type { ItemEstimado } from '../../../facturacion/models/pedido.model';

/** Mismo encabezado que la plantilla real "AS2 Pedido Cliente.xlsx" (ver `nuevo-pedido-dialog.ts`) — un archivo descargado acá también se puede volver a cargar ahí, y viceversa. */
const CABECERA_PLANTILLA_AS2 = 'Codigo Producto AS2';
const MAX_PLANTILLA_BYTES = 5 * 1024 * 1024;

interface LineaDraft {
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: string;
  valorUnitario: string;
  descuentoPorcentaje: string;
}

const LINEA_VACIA: LineaDraft = { codigo: '', descripcion: '', unidad: '', cantidad: '1', valorUnitario: '0', descuentoPorcentaje: '0' };

function aDraft(it: ItemEstimado): LineaDraft {
  return {
    codigo: it.codigo,
    descripcion: it.descripcion,
    unidad: it.unidad,
    cantidad: String(it.cantidad),
    valorUnitario: String(it.valorUnitario),
    descuentoPorcentaje: it.descuentoPorcentaje != null ? String(it.descuentoPorcentaje) : '0',
  };
}

export interface SolicitarCambioItemsDialogData {
  pedidoCode: string;
  cliente: string;
  itemsActuales: ItemEstimado[];
  /** Supervisor: su propio cambio se aplica directo (sin pasar por aprobación) — cambia el texto de aviso y el label del botón. Operador (default): queda pendiente de aprobación. */
  aplicaInmediato?: boolean;
}

export interface SolicitarCambioItemsDialogResult {
  itemsPropuestos: ItemEstimado[];
  motivo: string;
}

/**
 * "El operador dispone todo el tiempo de una opción para visualizar y
 * solicitar la edición de los ítems del pedido ya definido por Ventas" — se
 * abre precargado con los ítems ACTUALES del pedido (Ventas), el Operador
 * los edita/agrega y explica el motivo; queda pendiente de aprobación del
 * Supervisor (ver aprobaciones-page.ts), que es quien de verdad actualiza el
 * pedido en Facturación.
 */
@Component({
  selector: 'app-solicitar-cambio-items-dialog',
  /** Pantalla completa en móvil (formulario largo) — ver styles.scss. */
  host: { class: 'app-dialog-fullscreen-mobile' },
  imports: [
    DecimalPipe,
    DynadrillTextComponent,
    DynadrillTextareaComponent,
    DynadrillInputComponent,
    DynadrillButtonComponent,
    DynadrillIconButtonComponent,
    DynadrillUploadZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitar-cambio-items-dialog.html',
  styleUrl: './solicitar-cambio-items-dialog.scss',
})
export class SolicitarCambioItemsDialog {
  private readonly modalRef = inject(NzModalRef<SolicitarCambioItemsDialog, SolicitarCambioItemsDialogResult | undefined>);
  private readonly notify = inject(DynadrillNotificationService);
  protected readonly data = inject<SolicitarCambioItemsDialogData>(NZ_MODAL_DATA);

  protected readonly lineas = signal<LineaDraft[]>(
    this.data.itemsActuales.length ? this.data.itemsActuales.map(aDraft) : [{ ...LINEA_VACIA }],
  );
  protected readonly motivo = signal('');

  protected readonly total = computed(() =>
    Math.round(this.lineas().reduce((s, l) => s + Number(l.cantidad) * Number(l.valorUnitario), 0) * 100) / 100,
  );

  private lineaValida(l: LineaDraft): boolean {
    return !!l.codigo.trim() && !!l.descripcion.trim() && Number(l.cantidad) > 0 && Number(l.valorUnitario) > 0;
  }

  protected readonly puedeEnviar = computed(
    () => this.motivo().trim().length > 0 && this.lineas().every(l => this.lineaValida(l)),
  );

  protected onCampoChange<K extends keyof LineaDraft>(index: number, campo: K, valor: LineaDraft[K]): void {
    this.lineas.update(ls => ls.map((l, i) => (i === index ? { ...l, [campo]: valor } : l)));
  }

  protected agregarLinea(): void {
    this.lineas.update(ls => [...ls, { ...LINEA_VACIA }]);
  }

  protected quitarLinea(index: number): void {
    this.lineas.update(ls => (ls.length > 1 ? ls.filter((_, i) => i !== index) : ls));
  }

  /**
   * Descarga los ítems actuales (los que ya cargó Ventas + lo que se haya
   * editado en esta misma sesión) en la misma plantilla AS2 que se usa al
   * crear el pedido — quien la reciba puede agregar registros nuevos abajo
   * y volver a cargarla acá.
   */
  protected descargarPlantilla(): void {
    const filas: (string | number)[][] = [
      ['Codigo Producto AS2', 'Codigo UN', 'Cantidad', 'Descripción', 'Precio', 'Porcentaje Descuento'],
      ...this.lineas().map(l => [l.codigo, l.unidad, l.cantidad, l.descripcion, l.valorUnitario, l.descuentoPorcentaje]),
    ];
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Ventas');
    XLSX.writeFile(libro, `Pedido ${this.data.pedidoCode} - items.xlsx`);
  }

  /** Botón "Cargar plantilla" (móvil): abre el selector de archivos y reutiliza el flujo de la zona de carga. */
  protected onPlantillaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (archivo) this.onCargarPlantilla(archivo as unknown as NzUploadFile);
    input.value = '';
  }

  /** Reemplaza TODAS las líneas actuales por las del archivo — mismo criterio que `onCargarPlantilla` de `nuevo-pedido-dialog.ts`. */
  protected onCargarPlantilla(file: NzUploadFile): void {
    const archivo = (file.originFileObj as File | undefined) ?? (file as unknown as File);
    if (!archivo || typeof archivo.size !== 'number') {
      this.notify.error('Archivo no reconocido', 'No se pudo leer el archivo seleccionado. Probá de nuevo.');
      return;
    }
    if (archivo.size > MAX_PLANTILLA_BYTES) {
      this.notify.error('Archivo demasiado grande', 'El archivo supera el máximo permitido de 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = evento => {
      try {
        const datos = new Uint8Array(evento.target!.result as ArrayBuffer);
        const libro = XLSX.read(datos, { type: 'array' });
        const hoja = libro.Sheets[libro.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: '', raw: false });

        const idxCabecera = filas.findIndex(f => (f[0] ?? '').toString().trim() === CABECERA_PLANTILLA_AS2);
        if (idxCabecera === -1) {
          this.notify.error(
            'Plantilla no reconocida',
            `No se encontró el encabezado "${CABECERA_PLANTILLA_AS2}" — ¿es la plantilla de AS2 Pedido Cliente?`,
          );
          return;
        }

        const nuevas: LineaDraft[] = [];
        for (const fila of filas.slice(idxCabecera + 1)) {
          const codigo = (fila[0] ?? '').toString().trim();
          if (!codigo) break; // primera fila vacía = fin de los datos
          nuevas.push({
            codigo,
            unidad: (fila[1] ?? '').toString().trim(),
            cantidad: (fila[2] ?? '').toString().trim() || '1',
            descripcion: (fila[3] ?? '').toString().trim(),
            valorUnitario: (fila[4] ?? '').toString().trim() || '0',
            descuentoPorcentaje: (fila[5] ?? '').toString().trim() || '0',
          });
        }

        if (!nuevas.length) {
          this.notify.error('Sin registros', 'La plantilla no trae ninguna línea después del encabezado.');
          return;
        }
        this.lineas.set(nuevas);
        this.notify.success('Plantilla cargada', `${nuevas.length} línea(s) cargada(s) desde el archivo.`);
      } catch {
        this.notify.error('Error al leer el archivo', 'No se pudo procesar el Excel. Verificá que no esté dañado.');
      }
    };
    reader.readAsArrayBuffer(archivo);
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) return;
    const itemsPropuestos: ItemEstimado[] = this.lineas().map(l => ({
      codigo: l.codigo.trim(),
      descripcion: l.descripcion.trim(),
      unidad: l.unidad.trim(),
      cantidad: Number(l.cantidad),
      valorUnitario: Number(l.valorUnitario),
      descuentoPorcentaje: Number(l.descuentoPorcentaje) || 0,
    }));
    this.modalRef.close({ itemsPropuestos, motivo: this.motivo().trim() });
  }

  protected cancelar(): void {
    this.modalRef.close(undefined);
  }
}
