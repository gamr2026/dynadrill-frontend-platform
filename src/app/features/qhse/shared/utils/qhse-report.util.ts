/**
 * Generador de reportes descargables para QHSE. No hay librería de PDF en
 * el proyecto (ni jsPDF, ni pdfmake) — en vez de sumar una dependencia
 * nueva para esto, se genera un .html autocontenido con estilos de
 * impresión: se descarga con la API nativa del navegador (Blob + <a
 * download>), se abre en cualquier navegador, y desde ahí "Imprimir →
 * Guardar como PDF" lo convierte si hace falta. Mismo patrón que
 * cualquier "exportar reporte" sin backend de generación de PDF detrás.
 */

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface QhseReportSection {
  title: string;
  bodyHtml: string;
}

const REPORT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #131529; margin: 0; padding: 32px; background: #fff; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #092C47; }
  .qr-subtitle { font-size: 13px; color: #5c7286; margin: 0 0 24px; }
  h2 { font-size: 15px; color: #092C47; border-bottom: 1px solid #e2e8ee; padding-bottom: 6px; margin: 28px 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8ee; vertical-align: top; }
  th { background: #f5f7fa; font-weight: 700; color: #092C47; }
  .qr-meta { font-size: 12.5px; color: #5c7286; margin: 0 0 4px; }
  .qr-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .qr-badge--ok { background: #eaf7ef; color: #2e9e5b; }
  .qr-badge--warn { background: #fdf3e0; color: #dd9d27; }
  .qr-badge--error { background: #fbeaea; color: #d64545; }
  .qr-badge--neutral { background: #eef1f4; color: #5c7286; }
  .qr-empty { font-size: 12.5px; color: #5c7286; font-style: italic; }
  .qr-footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8ee; font-size: 11px; color: #5c7286; }
  @media print { body { padding: 0; } }
`;

export function qhseBadge(text: string, tone: 'ok' | 'warn' | 'error' | 'neutral'): string {
  return `<span class="qr-badge qr-badge--${tone}">${escapeHtml(text)}</span>`;
}

export function downloadQhseReport(filename: string, title: string, subtitle: string, sections: QhseReportSection[]): void {
  const now = new Date().toLocaleString('es-EC');
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${REPORT_STYLES}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="qr-subtitle">${escapeHtml(subtitle)}</p>
  ${sections.map(s => `<h2>${escapeHtml(s.title)}</h2>${s.bodyHtml}`).join('\n')}
  <p class="qr-footer">Generado desde el módulo QHSE — DYNADRILL, ${now}.</p>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
