import { NgModule } from '@angular/core'
import { RouterModule, Routes } from '@angular/router'
import { EpicEnumName } from 'epic-ui/api'

import {
    EpicAdminEnumsPageComponent,
    EpicAdminEnumValuesPageComponent,
    EpicAdminGeneralPageComponent,
    EpicAdminPageComponent,
    EpicAdminWpMachinesListPageComponent,
    EpicAdminWpProjectsListPageComponent,
    EpicEquipmentListPageComponent,
    EpicEquipmentTypesListPageComponent,
    EpicSvtTestSetupConfigPageComponent,
    EpicSvtTestTypeConfigPageComponent,
    EpicSvtTestTypeDetailsPageComponent,
    EpicSvtTestTypesListPageComponent,
    EpicWaferTypesListPageComponent,
    EpicWpProbeCardsListPageComponent,
} from './pages'
import {
    EpicAdminSvtTestPageComponent,
    EpicSvtTestSetupDetailsPageComponent,
    EpicSvtTestSetupsListPageComponent,
    EpicSvtTestTemplatesListPageComponent,
} from './pages/svt-test'
import { EpicAdminToolsPageComponent, EpicAdminToolsTcpPageComponent } from './pages/tools'


const routes: Routes = [
    {
        path: '',
        component: EpicAdminPageComponent,
        children: [
            {
                path: 'general',
                component: EpicAdminGeneralPageComponent,
                children: [
                    {
                        path: 'wafer-types',
                        component: EpicWaferTypesListPageComponent,
                    },
                    {
                        path: 'equipment-types',
                        component: EpicEquipmentTypesListPageComponent,
                    },
                    {
                        path: 'equipment',
                        component: EpicEquipmentListPageComponent,
                    },
                    {
                        path: 'wp-machines',
                        component: EpicAdminWpMachinesListPageComponent,
                    },
                    {
                        path: 'wp-projects',
                        component: EpicAdminWpProjectsListPageComponent,
                    },
                    {
                        path: 'wp-probe-cards',
                        component: EpicWpProbeCardsListPageComponent,
                    },
                    {
                        path: '',
                        pathMatch: 'full',
                        redirectTo: 'wafer-types',
                    },
                ],
            },
            {
                path: 'svt-test',
                component: EpicAdminSvtTestPageComponent,
                children: [
                    {
                        path: 'test-setups',
                        children: [
                            {
                                path: 'list',
                                component: EpicSvtTestSetupsListPageComponent,
                            },
                            {
                                path: 'details/:testSetupId',
                                component: EpicSvtTestSetupDetailsPageComponent,
                                children: [
                                    {
                                        path: 'config/:testSetupConfigId',
                                        component: EpicSvtTestSetupConfigPageComponent,
                                    },
                                ],
                            },
                            {
                                path: '',
                                pathMatch: 'full',
                                redirectTo: 'list',
                            },
                            {
                                path: '**',
                                redirectTo: 'list',
                            },
                        ],
                    },
                    {
                        path: 'test-types',
                        children: [
                            {
                                path: 'list',
                                component: EpicSvtTestTypesListPageComponent,
                            },
                            {
                                path: 'details/:testTypeId',
                                component: EpicSvtTestTypeDetailsPageComponent,
                                children: [
                                    {
                                        path: 'config/:testTypeConfigId',
                                        component: EpicSvtTestTypeConfigPageComponent,
                                    },
                                ],
                            },
                            {
                                path: '',
                                pathMatch: 'full',
                                redirectTo: 'list',
                            },
                            {
                                path: '**',
                                redirectTo: 'list',
                            },
                        ],
                    },
                    {
                        path: 'test-templates',
                        children: [
                            {
                                path: 'list',
                                component: EpicSvtTestTemplatesListPageComponent,
                            },
                            {
                                path: '',
                                pathMatch: 'full',
                                redirectTo: 'list',
                            },
                            {
                                path: '**',
                                redirectTo: 'list',
                            },
                        ],
                    },
                    {
                        path: '',
                        pathMatch: 'full',
                        redirectTo: 'test-setups',
                    },
                ],
            },
            {
                path: 'enums',
                component: EpicAdminEnumsPageComponent,
                children: [
                    {
                        path: 'by-name/:enumName',
                        component: EpicAdminEnumValuesPageComponent,
                    },
                    {
                        path: '',
                        pathMatch: 'full',
                        redirectTo: `by-name/${EpicEnumName.asicFamilyType}`,
                    },
                ],
            },

            {
                path: 'tools',
                component: EpicAdminToolsPageComponent,
                children: [
                    {
                        path: 'tcp',
                        component: EpicAdminToolsTcpPageComponent,
                    },
                    {
                        path: '',
                        pathMatch: 'full',
                        redirectTo: 'tcp',
                    },
                ],
            },
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'general',
            },
        ],
    },
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'general',
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
export class EpicAdminRoutingModule {

}
