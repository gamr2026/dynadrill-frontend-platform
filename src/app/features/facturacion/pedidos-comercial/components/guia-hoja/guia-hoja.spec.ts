import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { Guia } from '../../models/guia-comercial';
import { GuiaHoja } from './guia-hoja';

const guia: Guia = {
  id: 'g1',
  pedidoId: 'p1',
  numero: 11036,
  codigo: '003-001-0011036',
  estado: 'emitida',
  fecha: '2026-04-05',
  clienteNombre: 'EMPRESA PUBLICA DE HIDROCARBUROS DEL ECUADOR EP PETROECUADOR',
  clienteRuc: '1768153530001',
  lugarOrigen: { id: 'l', nombre: 'Coca Base Dynadrill' },
  solicitadoPorNombre: 'Ing. Mayra Núñez',
  despachadoPorNombre: 'Raúl Guerrón',
  horaSalida: null,
  horaLlegada: null,
  transportista: { id: 't', nombre: 'Hermés Páez', identificacion: '0502223423' },
  vehiculo: { id: 'v', placa: 'PDO3224', descripcion: 'CAMION CHEVROLET NQR' },
  chofer: null,
  observaciones: null,
  reemplazaAId: null,
  emitidaAt: '2026-04-05T10:00:00Z',
  anulacion: null,
  firmada: null,
  firmaManuscrita: { verificacion: 'no_verificada', confianza: null, at: null },
  autorizacion: { numero: '1133274030', desde: '2026-02-12', hasta: '2027-02-12' },
  firmaElectronica: null,
  items: [
    { orden: 1, codigo: 'F10082', descripcion: 'GEOMEMBRANA PVC NEGRA 1000 MICRAS', cantidad: 50, unidad: 'M2', serie: null, origen: 'material' },
    { orden: 2, codigo: 'F10083', descripcion: 'TERMOSELLADO', cantidad: 50, unidad: 'M2', serie: 'S-1', origen: 'material' },
  ],
};

function pintar(g: Guia = guia): HTMLElement {
  const fixture = TestBed.createComponent(GuiaHoja);
  fixture.componentRef.setInput('guia', g);
  fixture.componentRef.setInput('campo', 'SACHA');
  fixture.componentRef.setInput('pozo', 'ESTACION NORTE 2');
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('GuiaHoja (formato DYN-AFN-RE-013)', () => {
  it('imprime el encabezado, la serie con el número en rojo y la autorización del SRI', () => {
    const el = pintar();
    const texto = el.textContent ?? '';
    expect(texto).toContain('GUIA DE REMISION');
    expect(texto).toContain('DYN-AFN-RE-013');
    expect(texto).toContain('RUC: 1792142350001');
    expect(el.querySelector('.gh__serie')?.textContent).toContain('Serie: 003-001-');
    expect(el.querySelector('.gh__numero')?.textContent?.trim()).toBe('0011036');
    expect(texto).toContain('Fecha de Autorización: 12/Febrero/2026');
    expect(texto).toContain('Fecha de Caducidad: 12/Febrero/2027');
    expect(texto).toContain('Número de Autorización: 1133274030');
  });

  it('muestra cliente, ubicación, transporte, vehículo con su placa e ítems sin precios, y completa filas vacías', () => {
    const el = pintar();
    const texto = el.textContent ?? '';
    expect(texto).toContain('CLIENTE: EMPRESA PUBLICA DE HIDROCARBUROS');
    expect(texto).toContain('LUGAR DE ORIGEN: Coca Base Dynadrill');
    expect(texto).toContain('CAMPO: SACHA');
    expect(texto).toContain('POZO: ESTACION NORTE 2');
    expect(texto).toContain('FECHA: 05/04/2026');
    expect(texto).toContain('NOMBRE O RAZÓN SOCIAL: Hermés Páez');
    expect(texto).toContain('VEHICULO: CAMION CHEVROLET NQR');
    expect(texto).toContain('PLACAS: PDO3224');
    expect(texto).toContain('F10083 / S-1');
    expect(texto).not.toMatch(/precio|\$/i);
    expect(el.querySelectorAll('.gh__tabla tbody tr').length).toBe(6);
    expect(texto).toContain('Entregue Conforme');
    expect(texto).toContain('Recibí Conforme');
  });

  it('una guía anulada lo dice, y sin autorización no imprime ese bloque', () => {
    const el = pintar({ ...guia, estado: 'anulada', autorizacion: { numero: null, desde: null, hasta: null } });
    expect(el.querySelector('.gh__anulada')?.textContent).toContain('ANULADA');
    expect(el.textContent).not.toContain('Número de Autorización');
  });
});
