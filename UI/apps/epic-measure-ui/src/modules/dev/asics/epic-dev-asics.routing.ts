import { Routes } from '@angular/router'

import {
    EpicDevAsicsPageComponent,
    EpicDevAsicsCreateChipPageComponent,
} from './pages'


export const routes: Routes = [
    {
        path: '',
        component: EpicDevAsicsPageComponent,
        children: [
            {
                path: 'create-chip',
                component: EpicDevAsicsCreateChipPageComponent,
            },
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'create-chip',
            },
        ],
    },
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'create',
    },
    {
        path: '**',
        redirectTo: '/404',
    },
]
