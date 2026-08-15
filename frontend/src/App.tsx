import { Providers } from "@/components/Providers";
import { HomeView } from "@/components/views/HomeView";
import { AndroidUpdateNotice } from "@/components/common/AndroidUpdateNotice";

export function App() {
  return (
    <Providers>
      <HomeView />
      <AndroidUpdateNotice />
    </Providers>
  );
}
