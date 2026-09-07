import { Routes } from '@angular/router';
import { provideDynadrillCharts } from '@digitec-it-projects/dynadrill-ui';
import { PieChart } from 'echarts/charts';

export const dashboardRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/dashboard-page').then(m => m.DashboardPage),
    providers: [provideDynadrillCharts([PieChart])],
  },
];
