// Entorno de desarrollo (default — `ng serve`). Relativo a propósito: lo
// resuelve proxy.conf.json (`/api` -> http://localhost:3100, el gateway), así que acá
// NUNCA debe ir una URL absoluta.
export const environment = {
  production: false,
  apiUrl: '/api',
};
