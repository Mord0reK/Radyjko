import { NowPlayingDO } from "@/do/NowPlayingDO";
import { handleOptions } from "@/lib/cors";
import { getNowPlaying } from "./routes/nowplaying";
import { getStream } from "./routes/proxy";
import { getRadioCmpSchedule } from "./routes/schedule-radiocmp";
import { getRadioPartySchedule } from "./routes/schedule-radioparty";
import { getStations } from "./routes/stations";
import { routeApiRequest, type ApiRoutes } from "./router";

export { NowPlayingDO };

const options = async (): Promise<Response> => handleOptions();

const routes: ApiRoutes<CloudflareEnv> = {
  "/api/stations": { GET: getStations, OPTIONS: options },
  "/api/nowplaying": { GET: getNowPlaying, OPTIONS: options },
  "/api/stream": { GET: getStream, OPTIONS: options },
  "/api/schedule/radiocmp": {
    GET: (request) => getRadioCmpSchedule(request),
    OPTIONS: options,
  },
  "/api/schedule/radioparty": {
    GET: (request) => getRadioPartySchedule(request),
    OPTIONS: options,
  },
};

export default {
  fetch(request, env, ctx): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith("/api/")) {
      return routeApiRequest(request, env, ctx, routes);
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  },
} satisfies ExportedHandler<CloudflareEnv>;
