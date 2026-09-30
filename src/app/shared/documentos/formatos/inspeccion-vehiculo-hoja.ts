import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ChecklistEstado, VehicleInspection } from '../../../features/maintenance/models/vehicle-inspection.model';
import { DocumentoEncabezado } from '../documento-encabezado';
import { fechaDoc } from '../documento-format.util';

/** Un ítem numerado del formato: `clave` es el inicio del texto del ítem en el checklist de la app (antes del " — "). */
interface SlotItem {
  n: number;
  titulo: string;
  detalle: string;
  clave: string;
  /** Líneas de detalle bajo el ítem (herramientas del kit, etc.) — solo texto, sin casillero propio. */
  subs?: string[];
}

const COLUMNA_IZQUIERDA: SlotItem[] = [
  { n: 1, titulo: 'VIDRIOS.', detalle: 'En buenas condiciones, no rotos, limpios, sin obstrucciones.', clave: 'Vidrios' },
  { n: 2, titulo: 'SUSPENSIÓN.', detalle: 'Volante alineado, terminales, amortiguadores y paquetes.', clave: 'Suspensión' },
  { n: 3, titulo: 'ESPEJO RETROVISOR.', detalle: 'Adecuado, ajustado para clara visión.', clave: 'Espejo retrovisor' },
  { n: 4, titulo: 'LIMPIADOR DE PARABRISAS Y LAVADORES.', detalle: 'Trabajando apropiadamente.', clave: 'Limpiador de parabrisas' },
  { n: 5, titulo: 'CORNETA / PITO.', detalle: 'Opera con sonido alto y claro.', clave: 'Corneta' },
  { n: 6, titulo: 'FAROS DELANTEROS.', detalle: 'Trabajando. Alineados para evitar encandilar.', clave: 'Faros delanteros' },
  { n: 7, titulo: 'LUCES TRASERAS; STOP, DIRECCIONALES, LUZ DE REVERSA.', detalle: 'Funcionando.', clave: 'Luces traseras' },
  { n: 8, titulo: 'LUCES INTERIORES.', detalle: 'Techo, puertas, instrumentos, señales.', clave: 'Luces interiores' },
  { n: 9, titulo: 'FRENOS.', detalle: 'Ajustados, el emergente sostiene el vehículo en desnivel.', clave: 'Frenos' },
  { n: 10, titulo: 'LLANTAS.', detalle: 'Presión de aire, buen dibujo, libre de burbujas, de emergencia / repuesto.', clave: 'Llantas' },
  { n: 11, titulo: 'FUGAS.', detalle: 'Ausencia de fugas o liqueos.', clave: 'Fugas' },
  { n: 12, titulo: 'MOTOR.', detalle: 'No ruidos inusuales, buen entonamiento, no sobrecalienta.', clave: 'Motor' },
  { n: 13, titulo: 'BATERÍA.', detalle: 'Soportes, nivel de agua, protectores de bornes.', clave: 'Batería' },
  { n: 14, titulo: 'CINTURONES DE SEGURIDAD.', detalle: 'Operativos para todos los asientos (Ver Nota 1).', clave: 'Cinturones' },
  { n: 15, titulo: 'INSTRUMENTOS.', detalle: 'Trabajando bien, leen normalmente.', clave: 'Instrumentos' },
  { n: 16, titulo: 'SISTEMA DE ESCAPE.', detalle: 'Bien soportado, silencioso, atrapa chispas (para campo).', clave: 'Sistema de escape' },
  { n: 17, titulo: 'AIRE ACONDICIONADO.', detalle: 'Trabajando apropiadamente.', clave: 'Aire acondicionado' },
  { n: 18, titulo: 'TRANSMISIÓN.', detalle: 'Sin fugas, ni ruidos.', clave: 'Transmisión' },
  { n: 19, titulo: 'FLUIDOS.', detalle: 'Chequeo nivel de aceite, agua de batería, agua radiador, hidráulico.', clave: 'Fluidos' },
  { n: 20, titulo: 'CARROCERÍA.', detalle: 'No tiene daños, en buen estado.', clave: 'Carrocería' },
  { n: 21, titulo: 'MONITOR DE VELOCIDAD.', detalle: 'Instalado y funcionando.', clave: 'Monitor de velocidad' },
  { n: 22, titulo: 'MANTENIMIENTO PREVENTIVO.', detalle: 'Alineación y balanceo, Cambio de aceite, frenos.', clave: 'Mantenimiento preventivo' },
];

const COLUMNA_DERECHA: SlotItem[] = [
  { n: 23, titulo: 'ALARMA DE RETROCESO', detalle: '(Trabajando apropiadamente).', clave: 'Alarma de retroceso' },
  { n: 24, titulo: 'LINTERNA:', detalle: 'Operativa y baterías de respaldo.', clave: 'Linterna' },
  { n: 25, titulo: 'CONTACTOS:', detalle: 'Teléfonos / Plan de emergencia actualizados.', clave: 'Contactos' },
  { n: 26, titulo: 'MATERIAL DE ARRASTRE:', detalle: 'Cabo / Soga (5m de longitud y 1/2" diámetro mínimo), Otro: ________________', clave: 'Material de arrastre' },
  { n: 27, titulo: 'HERRAMIENTAS:', detalle: 'Contar con:', clave: 'Herramientas', subs: ['Llaves, destornilladores, pinzas, cables batería.', 'Gata / Llave de ruedas'] },
  { n: 28, titulo: 'BOTIQUÍN:', detalle: 'Cuente con los implementos básicos almenos:', clave: 'Botiquín', subs: ['Guantes quirúrgicos (2)', 'Alcohol o agua oxigenada', 'Vendajes (5)', 'Gasas (10)'] },
  { n: 29, titulo: 'DOCUMENTOS DE CONDUCTOR:', detalle: '', clave: '', subs: ['Matrícula (No. Formulario / Vigencia)', 'Seguros de accidentes ( Póliza de seguro del vehículo)'] },
  { n: 30, titulo: 'EXTINTOR TIPO ABC, POLVO QUÍMICO:', detalle: '____ Lbs.', clave: 'Extintor', subs: ['Estado:', 'Vigencia:'] },
  { n: 31, titulo: 'OTROS (Especifique):', detalle: '', clave: 'Kit de contingencia', subs: ['Kit de cointingencia ambiental:', 'Fajas /Cadenas', 'Carpa /Protección'] },
];

/**
 * Formato DYN-SGI-RE-068 "Inspección de vehículos" (32 ítems). Los ítems se ubican por nombre en los dos checklists de
 * la app (vehículo y equipo). Al generarse con la inspección aprobada, la sección de firmas sale con el nombre del
 * conductor/inspector y del supervisor; la firma se pone sobre el PDF.
 */
@Component({
  selector: 'app-doc-inspeccion-vehiculo',
  imports: [DocumentoEncabezado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspeccion-vehiculo-hoja.html',
  styleUrl: './inspeccion-vehiculo-hoja.scss',
})
export class InspeccionVehiculoHoja {
  readonly inspeccion = input.required<VehicleInspection>();

  protected readonly fecha = fechaDoc;
  protected readonly izquierda = COLUMNA_IZQUIERDA;
  protected readonly derecha = COLUMNA_DERECHA;

  private readonly todos = computed(() => [...this.inspeccion().checklistVehiculo, ...this.inspeccion().checklistEquipo]);

  /** "√" cumple · "X" no cumple · "NA" no aplica · vacío sin revisar. */
  protected readonly marca = (clave: string): string => {
    if (!clave) return '';
    const item = this.todos().find(i => i.label.toLowerCase().startsWith(clave.toLowerCase()));
    return this.simbolo(item?.estado ?? null);
  };

  private simbolo(e: ChecklistEstado): string {
    return e === 'C' ? '√' : e === 'NC' ? 'X' : e === 'NA' ? 'NA' : '';
  }

  /** Documentos del conductor: true → "√", false → "X" (no vigente). */
  protected readonly vigente = (v: boolean | undefined): string => (v === true ? '√' : v === false ? 'X' : '');

  protected readonly supervisor = computed(() => this.inspeccion().supervisorApprovedBy || this.inspeccion().supervisorNombre || '');
}
