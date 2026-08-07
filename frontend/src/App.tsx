import { Providers } from "@/components/Providers";
import { HomeView } from "@/components/views/HomeView";

export function App() {
  return (
    <Providers>
      <HomeView />
    </Providers>
  );
}
