import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PedidosComercialService } from '../services/pedidos-comercial.service';
import {
  etiquetaOrigen,
  etiquetaUso,
  formatoHoras,
  herramientasParaHoja,
  herramientasSinCodigo,
  horasTotales,
  listaDeChequeo,
  porcentajeReporteJob,
  reportesHerramientas,
  reportesJobOrdenados,
  type AvanceDocumental,
  type DocumentoOperativo,
} from './documentos-operativos';

const avance = (p: Partial<AvanceDocumental> = {}): AvanceDocumental => ({
  completo: false,
  diasEsperados: 5,
  diasConReporteJob: 3,
  reporteHerramientasRequerido: true,
  reporteHerramientasRecibido: false,
  usoVenta: false,
  guiaRequerida: false,
  guiaRegistrada: false,
  pendientes: [],
  ...p,
});

const doc = (p: Partial<DocumentoOperativo>): DocumentoOperativo => ({
  id: 'd',
  tipo: 'reporte_job',
  origen: 'fcr',
  ticketRef: null,
  fecha: null,
  firmadoPor: null,
  firmadoAt: null,
  supervisor: null,
  operador: null,
  recibidoAt: '2026-10-01T10:00:00Z',
  actividades: [],
  herramientas: [],
  ...p,
});

describe('etiquetas', () => {
  it('estados de uso legibles', () => {
    expect(etiquetaUso('operacion')).toBe('Operación');
    expect(etiquetaUso('stand_by')).toBe('Stand by');
    expect(etiquetaUso('daily_charge')).toBe('Cargo diario');
    expect(etiquetaUso('venta')).toBe('Venta');
    expect(etiquetaUso('otro')).toBe('otro');
  });

  it('origen', () => {
    expect(etiquetaOrigen('fcr')).toBe('FCR');
    expect(etiquetaOrigen('pumping')).toBe('Pumping');
  });
});

describe('horas y herramientas', () => {
  it('suma las horas de las actividades y las muestra con coma', () => {
    const h = horasTotales([
      { duracionHoras: 2.5 },
      { duracionHoras: 1.25 },
      { duracionHoras: null },
    ]);
    expect(h).toBe(3.75);
    expect(formatoHoras(h)).toBe('3,75 h');
    expect(formatoHoras(horasTotales([]))).toBe('0 h');
  });

  it('cuenta las herramientas sin código (no se facturarán)', () => {
    expect(herramientasSinCodigo([{ codigo: 'H-1' }, { codigo: null }, { codigo: '  ' }])).toBe(2);
  });
});

describe('avance documental', () => {
  it('porcentaje acotado de 0 a 100 y seguro con cero días esperados', () => {
    expect(porcentajeReporteJob(avance())).toBe(60);
    expect(porcentajeReporteJob(avance({ diasConReporteJob: 9 }))).toBe(100);
    expect(porcentajeReporteJob(avance({ diasEsperados: 0, diasConReporteJob: 0 }))).toBe(0);
  });

  it('lista de chequeo: Job incompleto y herramientas pendientes', () => {
    const l = listaDeChequeo(avance());
    expect(l.map((x) => x.estado)).toEqual(['pendiente', 'pendiente']);
    expect(l[0].texto).toBe('Reporte Job: 3 de 5 día(s)');
  });

  it('herramientas no requeridas no aplican y la guía solo aparece si es requerida', () => {
    const l = listaDeChequeo(avance({ diasConReporteJob: 5, reporteHerramientasRequerido: false }));
    expect(l.map((x) => x.estado)).toEqual(['ok', 'na']);
    const g = listaDeChequeo(
      avance({ guiaRequerida: true, guiaRegistrada: true, reporteHerramientasRecibido: true }),
    );
    expect(g).toHaveLength(3);
    expect(g[2]).toEqual({ texto: 'Guía de remisión: registrada', estado: 'ok' });
  });
});

describe('listas de documentos', () => {
  it('Reportes Job ordenados por fecha con los sin fecha al final; herramientas aparte', () => {
    const docs = [
      doc({ id: 'c', fecha: null }),
      doc({ id: 'b', fecha: '2026-10-02' }),
      doc({ id: 'a', fecha: '2026-10-01' }),
      doc({ id: 'h', tipo: 'reporte_herramientas' }),
    ];
    expect(reportesJobOrdenados(docs).map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(reportesHerramientas(docs).map((d) => d.id)).toEqual(['h']);
  });
});

describe('PedidosComercialService: documentos operativos', () => {
  let service: PedidosComercialService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PedidosComercialService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista (con filtro opcional por tipo), avance y eliminación', () => {
    service.documentosOperativos('p1').subscribe();
    const l = http.expectOne((r) => r.url === '/api/comercial/pedidos/p1/documentos-operativos');
    expect(l.request.params.keys()).toEqual([]);
    l.flush([]);

    service.documentosOperativos('p1', 'reporte_job').subscribe();
    const f = http.expectOne((r) => r.url === '/api/comercial/pedidos/p1/documentos-operativos');
    expect(f.request.params.get('tipo')).toBe('reporte_job');
    f.flush([]);

    service.avanceDocumental('p1').subscribe();
    http.expectOne('/api/comercial/pedidos/p1/documentos-operativos/avance').flush({});

    service.eliminarDocumentoOperativo('p1', 'd1').subscribe();
    const e = http.expectOne('/api/comercial/pedidos/p1/documentos-operativos/d1');
    expect(e.request.method).toBe('DELETE');
    e.flush({});
  });
});

describe('herramientasParaHoja', () => {
  const doc = (herramientas: DocumentoOperativo['herramientas']): DocumentoOperativo =>
    ({
      id: 'd',
      tipo: 'reporte_herramientas',
      origen: 'fcr',
      herramientas,
    }) as unknown as DocumentoOperativo;

  it('las filas por día (todo vale 1) quedan como marcas y el total sale de la fila', () => {
    const r = herramientasParaHoja([
      doc([
        {
          orden: 1,
          nombre: 'Cargo básico',
          serie: 'DY-1',
          codigo: 'CT5104',
          cantidad: 2,
          usos: [
            { fecha: '2026-11-01T00:00:00.000Z', estado: 'operacion', cantidad: 1 },
            { fecha: '2026-11-02', estado: 'daily_charge' },
          ],
        },
      ]),
    ]);
    expect(r.tools).toEqual([
      {
        id: 1,
        name: 'Cargo básico',
        serialCode: 'DY-1',
        codigo: 'CT5104',
        unidad: undefined,
        cantidad: 2,
      },
    ]);
    expect(r.usageLog).toEqual([
      { id: 1, toolId: 1, date: '2026-11-01', status: 'operacion' },
      { id: 2, toolId: 1, date: '2026-11-02', status: 'daily_charge' },
    ]);
  });

  it('una fila con cantidades distintas de 1 lleva la cantidad de cada día en su celda', () => {
    const r = herramientasParaHoja([
      doc([
        {
          orden: 1,
          nombre: 'Movilización',
          serie: null,
          codigo: 'MV0001',
          unidad: 'KM',
          cantidad: 120.5,
          usos: [
            { fecha: '2026-11-01', estado: 'operacion', cantidad: 80 },
            { fecha: '2026-11-02', estado: 'operacion', cantidad: 40.5 },
          ],
        },
      ]),
    ]);
    expect(r.usageLog.map((u) => [u.date, u.cantidad])).toEqual([
      ['2026-11-01', 80],
      ['2026-11-02', 40.5],
    ]);
    expect(r.tools[0]).toMatchObject({ unidad: 'KM', cantidad: 120.5 });
  });

  it('numera las herramientas de todos los documentos de corrido', () => {
    const una = {
      orden: 1,
      nombre: 'A',
      serie: null,
      codigo: null,
      usos: [{ fecha: '2026-11-01', estado: 'venta' as const }],
    };
    const r = herramientasParaHoja([doc([una]), doc([{ ...una, nombre: 'B' }])]);
    expect(r.tools.map((t) => [t.id, t.name])).toEqual([
      [1, 'A'],
      [2, 'B'],
    ]);
    expect(r.usageLog.map((u) => u.toolId)).toEqual([1, 2]);
  });
});
