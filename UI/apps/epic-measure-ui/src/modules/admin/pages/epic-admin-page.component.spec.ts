import { EpicUserRole } from 'svt-ts-types'

import { getEpicAdminNavTabs } from './epic-admin-page.component'


describe('getEpicAdminNavTabs', () => {

    const labels = (role: EpicUserRole | null) => getEpicAdminNavTabs(role).map((tab) => tab.label)

    it('shows the tab Users to an Admin only', () => {
        expect(labels(EpicUserRole.Admin)).toEqual(['General', 'SVT Test', 'Enums', 'Tools', 'Users'])
        for (const role of [EpicUserRole.User, EpicUserRole.Expert, EpicUserRole.Developer, null]) {
            expect(labels(role), String(role)).toEqual(['General', 'SVT Test', 'Enums', 'Tools'])
        }
    })

    it('links the tab Users to ./users', () => {
        expect(getEpicAdminNavTabs(EpicUserRole.Admin).at(-1)?.routerLink).toBe('./users')
    })

})
