import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { GerenciamientoViaje, TravelRiskLevel, TravelRiskQuestion } from '../../../features/conductor/models/gerenciamiento-viaje.model';
import { fechaDoc } from '../documento-format.util';

/** Una respuesta que bloquea el viaje vale 999 en el cuestionario — no suma puntos, se muestra como "NO VIAJA". */
const BLOQUEANTE = 999;

/** Nota fija de la columna derecha del formato, por pregunta (la 9 a la 11 comparten una sola). */
const NOTAS: Record<number, string> = {
  1: 'Si no ha realizado la inspección del vehículo deténgase, hágala y continúe.',
  3: 'Se considera conductor a partir del momento que se le entrega la "Autorización para Conducir" debidamente firmada.',
  4: 'Si las horas trabajadas son menos de 8, el valor es cero. Si ha trabajado más de 16 horas, no puede conducir.',
  5: 'Si el Conductor ha descansado menos de 4 horas, No puede conducir.',
  6: 'Menos de 2 horas = 0.',
  7: 'Solo para viajes continuos o de esa duración.',
  8: 'Todos los recorridos nocturnos están restringidos y deberá ser aprobado por el Director de operaciones.',
  9: 'Si durante el viaje la condición climática o las condiciones de la carretera o la condición de seguridad física empeoran, respecto de la evaluación original, el conductor podrá detener el viaje. En ese caso deberá buscar un lugar seguro para detenerse y luego comunicarse con su contacto.',
  12: 'Los materiales peligrosos y/o controlados deben tener la documentación necesaria.',
};

interface FilaPregunta {
  numero: number;
  pregunta: string;
  /** Siempre 3 casillas como el formato: las que la pregunta no usa quedan grises (null). */
  opciones: ({ texto: string; elegida: boolean; bloquea: boolean } | null)[];
  puntaje: string;
  nota: string;
  /** Filas que ocupa la nota (la de las preguntas 9 a 11 es una sola, combinada). */
  notaFilas: number;
}

/**
 * Formato DYN-SGI-RE-049 "Gerenciamiento de Viaje — Evaluación de riesgos de viajes y Plan de gestión de viajes".
 * La sección de aprobaciones sale con el nombre del conductor y de quien autorizó (supervisor, jefe de base o gerente
 * HSE según el riesgo) y el espacio de firma vacío: se firma sobre el PDF.
 */
@Component({
  selector: 'app-doc-gerenciamiento-viaje',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gerenciamiento-viaje-hoja.html',
  styleUrl: './gerenciamiento-viaje-hoja.scss',
})
export class GerenciamientoViajeHoja {
  readonly gv = input.required<GerenciamientoViaje>();

  protected readonly fecha = fechaDoc;

  protected readonly filas = computed<FilaPregunta[]>(() =>
    this.gv().riskQuestions.map((q: TravelRiskQuestion) => {
      const opciones: FilaPregunta['opciones'] = [0, 1, 2].map(i => {
        const o = q.options[i];
        return o ? { texto: o.label, elegida: q.selectedLabel === o.label, bloquea: o.value === BLOQUEANTE } : null;
      });
      // Preguntas de 2 opciones: la del medio queda gris (así lo trae el formato en 2 y 7).
      if (q.options.length === 2) opciones.splice(1, 0, null), opciones.pop();
      return {
        numero: q.id,
        pregunta: q.question,
        opciones,
        puntaje: q.selectedValue === null ? '' : q.selectedValue === BLOQUEANTE ? 'NO VIAJA' : String(q.selectedValue),
        nota: NOTAS[q.id] ?? '',
        notaFilas: q.id === 9 ? 3 : 1,
      };
    }),
  );

  /** Las notas de las preguntas 10 y 11 ya están dentro de la combinada de la 9. */
  protected readonly mostrarNota = (f: FilaPregunta): boolean => f.numero !== 10 && f.numero !== 11;

  protected readonly total = computed(() => {
    const puntos = this.gv().totalPoints;
    return this.gv().riskQuestions.some(q => q.selectedValue === BLOQUEANTE) ? 'NO VIAJA' : String(puntos);
  });

  protected readonly riesgos: { nivel: TravelRiskLevel; puntos: string; horario: string; gestion: string }[] = [
    { nivel: 'ALTO', puntos: '> 75', horario: 'Desde 23:00 pm hasta 05:00 am', gestion: 'Director General (Quito)' },
    { nivel: 'MEDIO', puntos: '31 a 75', horario: 'Desde 18:00 pm hasta 23:00 am', gestion: 'Requiere aprobación de Jefe de Base' },
    { nivel: 'BAJO', puntos: '<30', horario: 'Desde 05:00 am hasta 18:00 am', gestion: 'Viajes de rutina con bajo riesgo: Supervisor directo/ Jefe de Base' },
  ];

  protected readonly pasajeros = computed(() => (this.gv().passengers ?? '').split(',').map(p => p.trim()).filter(Boolean));
  protected readonly ruta = computed(
    () => this.gv().routeInfo[0] ?? { location: '', arrivalTime: '', departureTime: '', overnightDetails: '' },
  );
  protected readonly comunicacion = computed(
    () => this.gv().communication[0] ?? { frequency: '', contactPerson: '', contactDetails: '' },
  );
}
