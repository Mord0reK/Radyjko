// Prevent the Windows console from appearing alongside the application window
// in release builds. Debug builds still get a console for logging.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  radyjko_lib::run();
}
