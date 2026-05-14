import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'


const routes: Routes = [
    {
        path: 'wafers',
        loadChildren: () => import('./wafers/epic-dev-wafers.module').then(m => m.EpicDevWafersModule),
    },
    {
        path: 'asics',
        loadChildren: () => import('./asics/epic-dev-asics.routing').then(m => m.routes),
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

@NgModule({
    imports: [
        RouterModule.forChild(routes),
    ],
    exports: [RouterModule],
})
export class EpicDevRoutingModule {

}
