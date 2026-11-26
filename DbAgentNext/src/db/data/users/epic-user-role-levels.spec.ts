import { EpicUserRole, isEpicUserRoleAtLeast } from 'svt-ts-types'


// `Shared/svt-ts-types` has no spec files (its README): the function of the contract is tested here, by a consumer.
describe('isEpicUserRoleAtLeast', () => {

    const LEVELS = [EpicUserRole.User, EpicUserRole.Expert, EpicUserRole.Developer, EpicUserRole.Admin]
    const UNKNOWN = ['admin', 'SuperAdmin', '', undefined, null] as unknown as EpicUserRole[]

    it('is true exactly when the role is the minimum or above it, for every pair of the four roles', () => {
        for (const [roleLevel, role] of LEVELS.entries()) {
            for (const [minimumLevel, minimum] of LEVELS.entries()) {
                expect(isEpicUserRoleAtLeast(role, minimum), `${role} at least ${minimum}`).toBe(roleLevel >= minimumLevel)
            }
        }
    })

    it('is false when the minimum is no role', () => {
        for (const role of LEVELS) {
            for (const minimum of UNKNOWN) {
                expect(isEpicUserRoleAtLeast(role, minimum), `${role} at least ${String(minimum)}`).toBe(false)
            }
        }
    })

    it('is false when the role is no role', () => {
        for (const role of UNKNOWN) {
            for (const minimum of LEVELS) {
                expect(isEpicUserRoleAtLeast(role, minimum), `${String(role)} at least ${minimum}`).toBe(false)
            }
        }
    })

})
