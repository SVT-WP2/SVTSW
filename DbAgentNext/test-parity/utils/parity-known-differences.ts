/**
 * The differences between the C++ agent and svt-db-agent-next that are decisions, not bugs
 * (`docs/01-behaviour-decisions.md`; ids `D-…`, `R-…`, `X-…`, `Q-…` from `DbAgent/docs/07`).
 * A case listed here may differ; one that is not listed must not. The compare spec fails on any other
 * difference, so a parity failure is either a bug or a decision that still has to be written down here.
 */
export type ParityKnownDifference = {
    /** Case ids, or patterns over them. */
    cases: (string | RegExp)[]
    /** The decision that explains the difference. */
    decision: string
    note: string
}

export const PARITY_KNOWN_DIFFERENCES: ParityKnownDifference[] = []

export function findKnownDifference(caseId: string): ParityKnownDifference | undefined {
    return PARITY_KNOWN_DIFFERENCES.find((known) => known.cases.some((pattern) =>
        typeof pattern === 'string' ? pattern === caseId : pattern.test(caseId)))
}
