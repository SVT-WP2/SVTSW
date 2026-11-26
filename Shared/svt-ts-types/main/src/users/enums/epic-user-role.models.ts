/**
 * The role of a user: the values of the PostgreSQL enum `userRole`, in their order. The roles are levels: a role
 * has every right of the roles before it (User < Expert < Developer < Admin).
 */
export enum EpicUserRole {
    User = 'User',
    Expert = 'Expert',
    Developer = 'Developer',
    Admin = 'Admin',
}

/** The roles from the lowest level to the highest. */
const EPIC_USER_ROLE_LEVELS: readonly EpicUserRole[] = [
    EpicUserRole.User,
    EpicUserRole.Expert,
    EpicUserRole.Developer,
    EpicUserRole.Admin,
]

/**
 * True when `role` is `minimum` or a role above it (User < Expert < Developer < Admin). False when either of the two
 * is no role: the values often come from outside (a token, a reply) and are not typed at run time.
 */
export function isEpicUserRoleAtLeast(role: EpicUserRole, minimum: EpicUserRole): boolean {
    const level = EPIC_USER_ROLE_LEVELS.indexOf(role)
    const minimumLevel = EPIC_USER_ROLE_LEVELS.indexOf(minimum)
    return level >= 0 && minimumLevel >= 0 && level >= minimumLevel
}
