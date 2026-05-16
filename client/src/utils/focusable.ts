/**
 * CSS selector that matches all focusable elements, excluding disabled ones.
 *
 * Use this when you need to enumerate interactive elements in a container
 * (e.g. focus traps, roving focus) and want to skip over elements the user
 * cannot actually interact with because they are disabled.
 *
 * Note: the original `useFocusTrap` selector omitted `:not([disabled])` guards.
 * The version below is strictly more correct — disabled form controls are
 * unreachable via keyboard by default, so including them in a focusable list
 * would produce dead Tab stops.  Both selectors have been unified here.
 */
export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
