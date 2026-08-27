import { environment } from '@env/environment'
import { EpicMenuLightItem, toEpicMatOutlinedIcon } from 'epic-ui/common/components'


export namespace AppSidebarNav {

    export function getSidebarMenu(): EpicMenuLightItem[] {
        return [
            // {
            //     label: 'Wafer Test',
            //     icon:  'epic-experiment',
            //     routerLink: '/wafer-tests',
            //     routerUrlPattern: '^/wafer-tests',
            // },
            // dataset
            {
                label: 'DUTs',
                icon: toEpicMatOutlinedIcon('dataset'),
                submenu: {
                    items: [
                        {
                            label: 'Wafers',
                            icon: 'epic-dashboard',
                            routerLink: '/wafers',
                            routerUrlPattern: '^/wafers',
                        },
                        {
                            label: 'ASICs',
                            icon: toEpicMatOutlinedIcon('layers'),
                            routerLink: '/asics',
                            routerUrlPattern: '^/asics',
                        },
                        {
                            label: 'Chips',
                            icon: toEpicMatOutlinedIcon('memory'),
                            routerLink: '/chips',
                            routerUrlPattern: '^/chips',
                        },
                        {
                            label: 'Chip Blocks',
                            icon: toEpicMatOutlinedIcon('developer_board'),
                            routerLink: '/chip-blocks',
                            routerUrlPattern: '^/chip-blocks',
                        },
                    ],
                },
            },

            {
                label: 'Testing',
                icon: 'epic-report',
                routerLink: '/svt-tests',
                routerUrlPattern: '^/svt-tests',
            },
            {
                label: 'WPM',
                icon: 'epic-machine',
                routerLink: '/wp-machines',
                routerUrlPattern: '^/wp-machines',
            },
            // {
            //     label: 'Measure',
            //     icon: 'epic-line-chart',
            //     routerLink: '/iv-mnt',
            //     routerUrlPattern: '^/iv-mnt',
            // },
            {
                icon: 'epic-gear',
                label: 'Admin',
                routerLink: '/admin',
                routerUrlPattern: '^/admin',
                // submenu: {
                //     items: [
                //         {
                //             label: 'Wafer Types',
                //             icon: 'map',
                //             routerLink: '/admin/wafer-types',
                //             routerUrlPattern: '^/admin/wafer-types',
                //         },
                //     ],
                // },
            },
            ...(!environment.production ? getDevOnlyMenu() : []),
        ]
    }

    export function getDevOnlyMenu(): any[] {
        return [
            {
                icon: 'code',
                label: 'DEV',
                submenu: {
                    header: 'Dev Only Environment',
                    items: [
                        {
                            label: 'Wafers',
                            icon: 'epic-dashboard',
                            routerLink: '/dev/wafers',
                            routerUrlPattern: '^/dev/wafers',
                        },
                        {
                            label: 'ASICs',
                            icon: toEpicMatOutlinedIcon('layers'),
                            routerLink: '/dev/asics',
                            routerUrlPattern: '^/dev/asics',
                        },
                    ],
                },
            },
        ]
    }
}

