import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { DynadrillNotificationService } from '@digitec-it-projects/dynadrill-ui';
import { esCedulaValida } from '../../models/terminos.model';
import { TerminosPumpingService } from '../../services/terminos-pumping.service';
import { AceptarTerminosDialog } from './aceptar-terminos-dialog';

describe('esCedulaValida', () => {
  it('exige exactamente 10 dígitos', () => {
    expect(esCedulaValida('1712345678')).toBe(true);
    expect(esCedulaValida(' 1712345678 ')).toBe(true);
    expect(esCedulaValida('17123456')).toBe(false);
    expect(esCedulaValida('17123456AB')).toBe(false);
  });
});

describe('AceptarTerminosDialog', () => {
  const terminos = { version: 'PUMP-TyC-v1', titulo: 'Términos', texto: 'Texto', textoHash: 'abc' };

  function setup() {
    const aceptar = vi.fn().mockReturnValue(of({ id: 1, operadorNombre: 'Ana Ruiz', version: 'PUMP-TyC-v1' }));
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: TerminosPumpingService, useValue: { vigentes: () => of(terminos), aceptar } },
        { provide: NzModalRef, useValue: { close } },
        { provide: NZ_MODAL_DATA, useValue: { ticketId: 7, operadorNombre: 'Ana Ruiz' } },
        { provide: DynadrillNotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(AceptarTerminosDialog);
    fixture.detectChanges();
    // Acceso a la API protegida solo para el test.
    const c = fixture.componentInstance as unknown as {
      leido: { set(v: boolean): void };
      cedula: { set(v: string): void };
      acepta: { set(v: boolean): void };
      puedeAceptar(): boolean;
      aceptar(): void;
    };
    return { c, aceptar, close };
  }

  it('no deja aceptar sin leer el texto, con cédula inválida o sin marcar la casilla', () => {
    const { c } = setup();
    c.leido.set(false);
    c.cedula.set('1712345678');
    c.acepta.set(true);
    expect(c.puedeAceptar()).toBe(false);

    c.leido.set(true);
    c.cedula.set('123');
    expect(c.puedeAceptar()).toBe(false);

    c.cedula.set('1712345678');
    c.acepta.set(false);
    expect(c.puedeAceptar()).toBe(false);
  });

  it('registra la aceptación del operador del ticket y cierra con la constancia', () => {
    const { c, aceptar, close } = setup();
    c.leido.set(true);
    c.cedula.set('1712345678');
    c.acepta.set(true);
    c.aceptar();

    expect(aceptar).toHaveBeenCalledWith(7, { operadorNombre: 'Ana Ruiz', operadorCedula: '1712345678' });
    expect(close).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});
