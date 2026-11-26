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

/** True when `role` is `minimum` or a role above it (User < Expert < Developer < Admin). */
export function isEpicUserRoleAtLeast(role: EpicUserRole, minimum: EpicUserRole): boolean {
    const level = EPIC_USER_ROLE_LEVELS.indexOf(role)
    return level >= 0 && level >= EPIC_USER_ROLE_LEVELS.indexOf(minimum)
}
