import { PB } from "./protocol.js";

export function deviceSelection(presets, index, variant, action) {
  const actions = PB.NavigationAction;
  if (action === actions.PREVIOUS_DEMO)
    return { index: (index + presets.length - 1) % presets.length, variant: 0 };
  if (action === actions.NEXT_DEMO)
    return { index: (index + 1) % presets.length, variant: 0 };
  const count = presets[index].variants?.length || 1;
  if (count > 1 && [actions.NEXT_VARIANT, actions.PREVIOUS_VARIANT].includes(action))
    return { index, variant: (variant + (action === actions.NEXT_VARIANT ? 1 : count - 1)) % count };
  return { index, variant };
}
