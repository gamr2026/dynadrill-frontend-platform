// Build de QA (`ng build --configuration qa`, usado por
// .github/workflows/deploy-qa.yml vía fileReplacements en angular.json).
//
// Apunta al FQDN público que Azure le da al Container App, no al dominio
// custom: dynadrillapi.digitec.com.ec todavía no tiene el certificado
// administrado emitido (queda en "Pending" — ver notas de la sesión de
// deploy), así que hoy mismo no sirve HTTPS válido. Cuando el certificado
// termine de emitirse y el hostname quede enlazado (`az containerapp
// hostname bind`), cambiar este valor a
// 'https://dynadrillapi.digitec.com.ec/api' y listo — es el único lugar
// que hay que tocar.
export const environment = {
  production: true,
  apiUrl: 'https://ca-perf-evaluation-api-qa.wittymoss-0cf59ebb.westus2.azurecontainerapps.io/api',
};
