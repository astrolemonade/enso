/** @file A spinner that does not expose its {@link spinner.SpinnerState}. */
import * as React from 'react'

import Spinner, * as spinner from '#/components/Spinner'

// ========================
// === StatelessSpinner ===
// ========================

// This is a re-export, so that the API of this module mirrors that of the `spinner` module.
// eslint-disable-next-line no-restricted-syntax
export { SpinnerState } from './Spinner'

/** Props for a {@link StatelessSpinner}. */
export interface StatelessSpinnerProps extends spinner.SpinnerProps {}

/** A spinner that does not expose its {@link spinner.SpinnerState}. Instead, it begins at
 * {@link spinner.SpinnerState.initial} and immediately changes to the given state. */
export default function StatelessSpinner(props: StatelessSpinnerProps) {
  const { size, state: rawState, ...spinnerProps } = props
  const [, startTransition] = React.useTransition()
  const [state, setState] = React.useState(spinner.SpinnerState.initial)

  React.useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      // consider this as a low-priority update
      startTransition(() => {
        setState(rawState)
      })
    })

    return () => {
      cancelAnimationFrame(id)
    }
  }, [rawState])

  return <Spinner state={state} {...(size != null ? { size } : {})} {...spinnerProps} />
}
