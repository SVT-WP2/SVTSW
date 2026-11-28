import { EpicUserRole } from 'svt-ts-types'

import { EpicUsersRules } from './epic-users-rules.models'


describe('EpicUsersRules', () => {

    const jane = { id: 7, name: 'Jane Doe', role: EpicUserRole.Expert }

    it('knows the own user by its id, and no own user without a logged-in user', () => {
        expect(EpicUsersRules.isOwnUser(jane, 7)).toBe(true)
        expect(EpicUsersRules.isOwnUser(jane, 8)).toBe(false)
        expect(EpicUsersRules.isOwnUser(jane, null)).toBe(false)
        expect(EpicUsersRules.isOwnUser(jane, undefined)).toBe(false)
    })

    it('lists the four roles from the lowest to the highest', () => {
        expect(EpicUsersRules.ROLES).toEqual([EpicUserRole.User, EpicUserRole.Expert, EpicUserRole.Developer, EpicUserRole.Admin])
    })

    it('sends only what changed, the name trimmed', () => {
        expect(EpicUsersRules.toUpdateRequest(jane, { name: ' Jane D. ', role: EpicUserRole.Expert }, false)).toEqual({ name: 'Jane D.' })
        expect(EpicUsersRules.toUpdateRequest(jane, { name: 'Jane Doe', role: EpicUserRole.Admin }, false))
            .toEqual({ role: EpicUserRole.Admin })
        expect(EpicUsersRules.toUpdateRequest(jane, { name: 'Jane Doe ', role: EpicUserRole.Expert }, false)).toBeNull()
    })

    it('never sends the role of the own user', () => {
        expect(EpicUsersRules.toUpdateRequest(jane, { name: 'Jane Doe', role: EpicUserRole.Admin }, true)).toBeNull()
        expect(EpicUsersRules.toUpdateRequest(jane, { name: 'Jane', role: EpicUserRole.User }, true)).toEqual({ name: 'Jane' })
    })

})
