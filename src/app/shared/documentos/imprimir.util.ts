export type OrientacionHoja = 'portrait' | 'landscape';

/**
 * Imprime (o guarda como PDF) con la orientación y el nombre de archivo de ese
 * documento: el `@page` y el título se inyectan solo durante la impresión y se
 * retiran al terminar, para no afectar a los demás reportes de la app.
 */
export function imprimirDocumento(opciones: { orientacion: OrientacionHoja; nombreArchivo: string }): void {
  const estilo = document.createElement('style');
  estilo.textContent = `@page { size: A4 ${opciones.orientacion}; margin: 8mm; }`;
  document.head.appendChild(estilo);
  const tituloPrevio = document.title;
  document.title = opciones.nombreArchivo;
  const restaurar = (): void => {
    estilo.remove();
    document.title = tituloPrevio;
    window.removeEventListener('afterprint', restaurar);
  };
  window.addEventListener('afterprint', restaurar);
  window.print();
}
