interface TriggerRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

export interface MobileDayMenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export function getMobileDayMenuPosition(
  trigger: TriggerRect,
  viewportHeight: number,
): MobileDayMenuPosition {
  const gap = 8;
  const preferredHeight = 288;
  const top = trigger.bottom + gap;
  const maxHeight = Math.max(
    0,
    Math.min(preferredHeight, viewportHeight - top - gap),
  );

  return {
    left: trigger.left,
    top,
    width: trigger.width,
    maxHeight,
  };
}
