import { Routes } from '@angular/router'

import { EpicWpMachinesListPageComponent } from './pages'


export const routes: Routes = [
    {
        path: 'list',
        component: EpicWpMachinesListPageComponent,
    },
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'list',
    },
    {
        path: '**',
        redirectTo: '/404',
    },
]
