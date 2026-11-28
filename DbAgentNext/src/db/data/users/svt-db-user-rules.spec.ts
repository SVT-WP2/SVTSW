import { removesLastActiveAdmin, SvtDbUserAdminState } from './svt-db-user-rules'


const ACTIVE_ADMIN: SvtDbUserAdminState = { role: 'Admin', isActive: true }
const INACTIVE_ADMIN: SvtDbUserAdminState = { role: 'Admin', isActive: false }
const ACTIVE_DEVELOPER: SvtDbUserAdminState = { role: 'Developer', isActive: true }
const INACTIVE_USER: SvtDbUserAdminState = { role: 'User', isActive: false }

describe('removesLastActiveAdmin', () => {

    it('is true when the last active Admin is switched off or gets another role', () => {
        expect(removesLastActiveAdmin(ACTIVE_ADMIN, INACTIVE_ADMIN, 0)).toBe(true)
        expect(removesLastActiveAdmin(ACTIVE_ADMIN, ACTIVE_DEVELOPER, 0)).toBe(true)
        expect(removesLastActiveAdmin(ACTIVE_ADMIN, INACTIVE_USER, 0)).toBe(true)
    })

    it('is false when another active Admin exists', () => {
        expect(removesLastActiveAdmin(ACTIVE_ADMIN, INACTIVE_ADMIN, 1)).toBe(false)
        expect(removesLastActiveAdmin(ACTIVE_ADMIN, ACTIVE_DEVELOPER, 2)).toBe(false)
    })

    it('is false when the user stays an active Admin', () => {
        expect(removesLastActiveAdmin(ACTIVE_ADMIN, ACTIVE_ADMIN, 0)).toBe(false)
    })

    it('is false when the user was no active Admin before', () => {
        expect(removesLastActiveAdmin(INACTIVE_ADMIN, INACTIVE_USER, 0)).toBe(false)
        expect(removesLastActiveAdmin(ACTIVE_DEVELOPER, INACTIVE_USER, 0)).toBe(false)
        expect(removesLastActiveAdmin(INACTIVE_ADMIN, ACTIVE_ADMIN, 0)).toBe(false)
    })

})
