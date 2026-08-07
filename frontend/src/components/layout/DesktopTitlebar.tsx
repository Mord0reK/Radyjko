import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { isTauriDesktop } from "@/lib/platform";

type WindowAction = "minimize" | "toggleMaximize" | "close";

function runWindowAction(action: WindowAction): void {
  void getCurrentWindow()[action]().catch((error) => {
    console.debug(`Unable to ${action} desktop window:`, error);
  });
}

export function DesktopTitlebar() {
  if (!isTauriDesktop()) return null;

  return (
    <header className="flex h-9 shrink-0 select-none items-center border-b border-neutral-800 bg-neutral-950 text-neutral-300">
      <div
        data-tauri-drag-region
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-3"
      >
        <img src="/icon.png" alt="" className="h-4 w-4 rounded-sm" draggable={false} />
        <span className="truncate text-xs font-medium">Radyjko</span>
      </div>

      <div className="flex h-full">
        <button
          type="button"
          aria-label="Minimalizuj okno"
          onClick={() => runWindowAction("minimize")}
          className="grid w-11 place-items-center transition-colors hover:bg-neutral-800 focus-visible:bg-neutral-800 focus-visible:outline-none"
        >
          <Minus size={16} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          aria-label="Maksymalizuj lub przywróć okno"
          onClick={() => runWindowAction("toggleMaximize")}
          className="grid w-11 place-items-center transition-colors hover:bg-neutral-800 focus-visible:bg-neutral-800 focus-visible:outline-none"
        >
          <Square size={13} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          aria-label="Zamknij okno"
          onClick={() => runWindowAction("close")}
          className="grid w-11 place-items-center transition-colors hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white focus-visible:outline-none"
        >
          <X size={17} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
