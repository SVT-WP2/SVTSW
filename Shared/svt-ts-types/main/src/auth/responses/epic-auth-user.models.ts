import { EpicUserRole } from '../../users'


/** The logged-in user as the browser sees it: the answer of `POST /api/auth/login` and `GET /api/auth/me`. */
export type EpicAuthUser = {
    id: number
    login: string
    name: string
    role: EpicUserRole
}
