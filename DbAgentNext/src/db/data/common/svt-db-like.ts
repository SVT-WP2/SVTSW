/** Escapes the LIKE wildcards of a search term so it matches literally inside `%…%`. */
export function escapeLike(term: string): string {
    return term.replace(/[\\%_]/g, (character) => `\\${character}`)
}
