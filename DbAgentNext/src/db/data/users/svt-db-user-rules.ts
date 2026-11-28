/** The role that manages the users. The installation keeps one active user with it (decision D6 of #392). */
export const SVT_DB_USER_ROLE_ADMIN = 'Admin'

/** The two columns of a user that the last-Admin rule reads. */
export type SvtDbUserAdminState = {
    role: string
    isActive: boolean
}

/**
 * The last-Admin rule: true when a change of a user from `before` to `after` takes away the last active Admin of
 * the installation. That is the case when `before` is an active Admin, `after` is not (switched off, or another
 * role), and no other active Admin exists.
 */
export function removesLastActiveAdmin(
    before: SvtDbUserAdminState,
    after: SvtDbUserAdminState,
    otherActiveAdmins: number,
): boolean {
    return isActiveAdmin(before) && !isActiveAdmin(after) && otherActiveAdmins === 0
}

function isActiveAdmin(user: SvtDbUserAdminState): boolean {
    return user.isActive && user.role === SVT_DB_USER_ROLE_ADMIN
}
