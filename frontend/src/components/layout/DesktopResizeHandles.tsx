import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriDesktop } from "@/lib/platform";

type ResizeDirection =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

const resizeHandles: Array<{ direction: ResizeDirection; className: string }> = [
  { direction: "North", className: "inset-x-2 top-0 h-1.5 cursor-n-resize" },
  { direction: "South", className: "inset-x-2 bottom-0 h-1.5 cursor-s-resize" },
  { direction: "East", className: "inset-y-2 right-0 w-1.5 cursor-e-resize" },
  { direction: "West", className: "inset-y-2 left-0 w-1.5 cursor-w-resize" },
  { direction: "NorthEast", className: "right-0 top-0 h-3 w-3 cursor-ne-resize" },
  { direction: "NorthWest", className: "left-0 top-0 h-3 w-3 cursor-nw-resize" },
  { direction: "SouthEast", className: "bottom-0 right-0 h-3 w-3 cursor-se-resize" },
  { direction: "SouthWest", className: "bottom-0 left-0 h-3 w-3 cursor-sw-resize" },
];

export function DesktopResizeHandles() {
  if (!isTauriDesktop()) return null;

  return resizeHandles.map(({ direction, className }) => (
    <div
      key={direction}
      aria-hidden="true"
      className={`fixed z-[60] ${className}`}
      onMouseDown={() => {
        void getCurrentWindow().startResizeDragging(direction).catch((error) => {
          console.debug("Unable to resize desktop window:", error);
        });
      }}
    />
  ));
}
