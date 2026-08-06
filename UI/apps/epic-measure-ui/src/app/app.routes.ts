import { Routes } from '@angular/router'
import { environment } from '@env/environment'

import { AppAuthGuard, AppNotAuthOnlyGuard } from './guards'
import { AppLayoutPageComponent, AppLoginPageComponent } from './pages'


export const routes: Routes = [
    {
        path: 'auth/login',
        component: AppLoginPageComponent,
        canActivate: [AppNotAuthOnlyGuard.canActivate],
    },
    {
        path: '',
        component: AppLayoutPageComponent,
        canActivate: [AppAuthGuard.canActivate],
        children: [
            {
                path: 'wafers',
                loadChildren:
                    () => import('../modules/wafers/epic-wafers.module').then(m => m.EpicWafersModule),
            },
            {
                path: 'wp-machines',
                loadChildren:
                    () => import('../modules/wp-machines/epic-wp-machines.routes').then(r => r.routes),
            },
            {
                path: 'wafer-tests',
                loadChildren:
                    () => import('../modules/wafer-tests/epic-wafer-tests.module').then(m => m.EpicWaferTestsModule),
            },
            {
                path: 'admin',
                loadChildren:
                    () => import('../modules/admin/epic-admin.module').then(m => m.EpicAdminModule),
            },
            {
                path: 'asics',
                loadChildren:
                    () => import('../modules/asics/epic-asics.module').then(m => m.EpicAsicsModule),
            },
            // {
            //     path: 'chips',
            //     loadChildren:
            //         () => import('../modules/chips/epic-chips.module').then(m => m.EpicChipsModule),
            // },
            {
                path: 'svt-tests',
                loadChildren:
                    () => import('../modules/svt-tests/epic-svt-tests.routing').then(m => m.routes),
            },
            {
                path: 'iv-mnt',
                loadChildren:
                    () => import('../modules/iv-mnt/epic-iv-mnt.module').then(m => m.EpicIvMntModule),
            },
            {
                path: '404',
                redirectTo: 'wafers',
            },
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'asics',
            },
            ...(!environment.production ? getDevOnlyRoutes() : []),
        ],
    },
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'wafers',
    },
    {
        path: '**',
        redirectTo: '/404',
    },
]

export function getDevOnlyRoutes(): Routes {
    return [
        {
            path: 'dev',
            loadChildren:
                () => import('../modules/dev/epic-dev.module').then(m => m.EpicDevModule),
        },
    ]
}

