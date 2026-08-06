import { Routes } from '@angular/router'

import { EpicSvtTestsListPageComponent } from './pages'


export const routes: Routes = [
    {
        path: 'list',
        component: EpicSvtTestsListPageComponent,
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

