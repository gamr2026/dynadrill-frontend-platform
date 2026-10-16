import { MAX_BYTES_DOCUMENTO, MAX_DOCUMENTOS_PEDIDO, errorDeArchivo, formatoTamano, mensajeErrorArchivo } from './documentos-pedido';

const pdf = { name: 'contrato.pdf', size: 1000, type: 'application/pdf' };

describe('formatoTamano', () => {
  it('muestra unidades legibles con coma decimal', () => {
    expect(formatoTamano(512)).toBe('512 B');
    expect(formatoTamano(1536)).toBe('1,5 KB');
    expect(formatoTamano(3.2 * 1024 * 1024)).toBe('3,2 MB');
    expect(formatoTamano(-1)).toBe('—');
  });
});

describe('errorDeArchivo', () => {
  it('acepta los tipos admitidos', () => {
    expect(errorDeArchivo(pdf, 0)).toBeNull();
    expect(errorDeArchivo({ name: 'a.PNG', size: 5, type: 'image/png' }, 0)).toBeNull();
    expect(errorDeArchivo({ name: 'a.xlsx', size: 5, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, 0)).toBeNull();
  });

  it('si el navegador no informa el tipo, se confía en la extensión admitida', () => {
    expect(errorDeArchivo({ name: 'a.docx', size: 5, type: '' }, 0)).toBeNull();
    expect(errorDeArchivo({ name: 'a.exe', size: 5, type: '' }, 0)).toMatch(/no admitido/);
  });

  it('rechaza tipos no admitidos, vacíos y demasiado grandes con mensajes claros', () => {
    expect(errorDeArchivo({ name: 'a.zip', size: 5, type: 'application/zip' }, 0)).toMatch(/PDF, PNG, JPEG, DOCX o XLSX/);
    expect(errorDeArchivo({ ...pdf, size: 0 }, 0)).toMatch(/vacío/);
    expect(errorDeArchivo({ ...pdf, size: MAX_BYTES_DOCUMENTO + 1 }, 0)).toMatch(/máximo/);
  });

  it('respeta el máximo de documentos por pedido', () => {
    expect(errorDeArchivo(pdf, MAX_DOCUMENTOS_PEDIDO)).toMatch(/máximo de 10/);
    expect(errorDeArchivo(pdf, MAX_DOCUMENTOS_PEDIDO - 1)).toBeNull();
  });
});

describe('mensajeErrorArchivo', () => {
  it('traduce cada código del backend', () => {
    expect(mensajeErrorArchivo({ status: 403 })).toMatch(/permiso/);
    expect(mensajeErrorArchivo({ status: 413 })).toMatch(/25 MB/);
    expect(mensajeErrorArchivo({ status: 415 })).toMatch(/no admitido/);
    expect(mensajeErrorArchivo({ status: 503 })).toMatch(/antivirus/);
  });

  it('en 422 muestra el detalle del backend', () => {
    expect(mensajeErrorArchivo({ status: 422, error: { detail: 'Archivo infectado' } })).toBe('Archivo infectado');
    expect(mensajeErrorArchivo({ status: 422, error: {} })).toMatch(/antivirus/);
  });

  it('un error desconocido tiene mensaje general', () => {
    expect(mensajeErrorArchivo(new Error('x'))).toMatch(/Intente de nuevo/);
  });
});
