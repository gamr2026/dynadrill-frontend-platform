import {
  aEditables,
  aEntrada,
  armarEnvio,
  estaContestada,
  faltaPorResponder,
  mensajeErrorEncuesta,
  textoDeRespuesta,
  validarPreguntas,
  type PreguntaEditable,
  type PreguntaPublica,
  type PreguntaVersion,
} from './encuestas.model';

const escala: PreguntaPublica = {
  id: 'p1',
  orden: 1,
  texto: '¿Cómo califica el servicio?',
  tipo: 'escala',
  obligatoria: true,
  escala: [
    { valor: 1, etiqueta: 'Malo' },
    { valor: 5, etiqueta: 'Excelente' },
  ],
  opciones: [],
};
const comentario: PreguntaPublica = {
  id: 'p2',
  orden: 2,
  texto: 'Comentarios',
  tipo: 'texto',
  obligatoria: false,
  escala: null,
  opciones: [],
};
const varias: PreguntaPublica = {
  id: 'p3',
  orden: 3,
  texto: '¿Qué mejoraría?',
  tipo: 'opcion_multiple',
  obligatoria: false,
  escala: null,
  opciones: [
    { id: 'o1', etiqueta: 'Puntualidad' },
    { id: 'o2', etiqueta: 'Trato' },
  ],
};

describe('encuestas (modelo)', () => {
  describe('formulario público', () => {
    it('una respuesta vacía, en blanco o sin elegir no cuenta como contestada', () => {
      expect(estaContestada(undefined)).toBe(false);
      expect(estaContestada(null)).toBe(false);
      expect(estaContestada('   ')).toBe(false);
      expect(estaContestada([])).toBe(false);
      expect(estaContestada(0)).toBe(true);
      expect(estaContestada(false)).toBe(true);
      expect(estaContestada(['o1'])).toBe(true);
    });

    it('pide el nombre y las preguntas obligatorias antes de enviar', () => {
      expect(faltaPorResponder('', [escala], { p1: 5 })).toBe('Escriba su nombre.');
      expect(faltaPorResponder('Ana', [escala, comentario], {})).toContain(escala.texto);
      expect(faltaPorResponder('Ana', [escala, comentario], { p1: 5 })).toBeNull();
    });

    it('envía solo lo contestado, con el nombre recortado y el cargo solo si lo escribió', () => {
      const envio = armarEnvio('  Ana Torres ', ' ', [escala, comentario, varias], {
        p1: 5,
        p2: '  ',
        p3: ['o1', 'o2'],
      });
      expect(envio).toEqual({
        nombre: 'Ana Torres',
        respuestas: [
          { preguntaId: 'p1', valor: 5 },
          { preguntaId: 'p3', valor: ['o1', 'o2'] },
        ],
      });
      expect(armarEnvio('Ana', 'Gerente', [comentario], { p2: ' Todo bien ' })).toEqual({
        nombre: 'Ana',
        cargo: 'Gerente',
        respuestas: [{ preguntaId: 'p2', valor: 'Todo bien' }],
      });
    });
  });

  describe('editor de preguntas', () => {
    const base: PreguntaEditable = {
      texto: '¿Recomendaría el servicio?',
      tipo: 'si_no',
      obligatoria: true,
      escalaId: null,
      opciones: [],
    };

    it('valida el texto, la escala y las opciones de cada pregunta', () => {
      expect(validarPreguntas([base])).toBeNull();
      expect(validarPreguntas([{ ...base, texto: ' ' }])).toBe('La pregunta 1 no tiene texto.');
      expect(validarPreguntas([base, { ...base, tipo: 'escala' }])).toBe(
        'La pregunta 2 necesita una escala de calificación.',
      );
      expect(validarPreguntas([{ ...base, tipo: 'opcion_unica', opciones: ['Una sola'] }])).toBe(
        'La pregunta 1 necesita al menos dos opciones.',
      );
      expect(validarPreguntas([{ ...base, tipo: 'opcion_unica', opciones: ['Sí', ' '] }])).toBe(
        'La pregunta 1 tiene una opción en blanco.',
      );
      expect(
        validarPreguntas([{ ...base, tipo: 'opcion_multiple', opciones: ['Sí', ' sí '] }]),
      ).toBe('La pregunta 1 tiene opciones repetidas.');
      expect(
        validarPreguntas([{ ...base, tipo: 'opcion_multiple', opciones: ['A', 'B'] }]),
      ).toBeNull();
    });

    it('cada pregunta lleva al servidor solo lo que su tipo usa', () => {
      expect(
        aEntrada([
          { ...base, texto: ' Texto ', tipo: 'escala', escalaId: 'e1', opciones: ['x'] },
          { ...base, tipo: 'opcion_unica', escalaId: 'e1', opciones: [' A ', 'B'] },
          base,
        ]),
      ).toEqual([
        { texto: 'Texto', tipo: 'escala', obligatoria: true, escalaId: 'e1' },
        { texto: base.texto, tipo: 'opcion_unica', obligatoria: true, opciones: ['A', 'B'] },
        { texto: base.texto, tipo: 'si_no', obligatoria: true },
      ]);
    });

    it('convierte las preguntas guardadas de una versión en filas editables', () => {
      const guardadas: PreguntaVersion[] = [
        {
          id: 'a',
          orden: 1,
          texto: 'Calificación',
          tipo: 'escala',
          obligatoria: true,
          escala: { id: 'e1', codigo: 'c', nombre: 'Satisfacción', valores: [] },
          opciones: [],
        },
        {
          id: 'b',
          orden: 2,
          texto: 'Motivo',
          tipo: 'opcion_unica',
          obligatoria: false,
          escala: null,
          opciones: [
            { id: 'o1', orden: 1, etiqueta: 'Precio' },
            { id: 'o2', orden: 2, etiqueta: 'Calidad' },
          ],
        },
      ];
      expect(aEditables(guardadas)).toEqual([
        { texto: 'Calificación', tipo: 'escala', obligatoria: true, escalaId: 'e1', opciones: [] },
        {
          texto: 'Motivo',
          tipo: 'opcion_unica',
          obligatoria: false,
          escalaId: null,
          opciones: ['Precio', 'Calidad'],
        },
      ]);
    });
  });

  describe('textos', () => {
    it('muestra cada tipo de respuesta guardada como texto legible', () => {
      expect(textoDeRespuesta(null)).toBe('Sin respuesta');
      expect(textoDeRespuesta(true)).toBe('Sí');
      expect(textoDeRespuesta(false)).toBe('No');
      expect(textoDeRespuesta('Muy bien')).toBe('Muy bien');
      expect(textoDeRespuesta({ valor: 5, etiqueta: 'Excelente' })).toBe('5 — Excelente');
      expect(textoDeRespuesta({ id: 'o1', etiqueta: 'Precio' })).toBe('Precio');
      expect(
        textoDeRespuesta([
          { id: 'o1', etiqueta: 'Precio' },
          { id: 'o2', etiqueta: 'Calidad' },
        ]),
      ).toBe('Precio, Calidad');
    });

    it('prefiere el mensaje del servidor y no muestra errores internos', () => {
      expect(
        mensajeErrorEncuesta({ status: 410, error: { message: 'El enlace venció' } }, 'x'),
      ).toBe('El enlace venció');
      expect(mensajeErrorEncuesta({ status: 400, error: { message: ['Uno.', 'Dos.'] } }, 'x')).toBe(
        'Uno. Dos.',
      );
      expect(mensajeErrorEncuesta({ status: 500, error: { message: 'stack' } }, 'Falló')).toBe(
        'Falló',
      );
      expect(mensajeErrorEncuesta({ status: 403 }, 'x')).toBe('No tiene permiso para esta acción.');
    });
  });
});
