import { get, post } from "@/lib/api";
import type {
  Hysteria2KickDto,
  Hysteria2SubscribeUrlDto,
  Hysteria2SubscribeVo,
  Hysteria2UrlDto,
  Hysteria2UrlVo,
  Hysteria2VersionDto,
} from "@/types/api";

export function hysteria2KickApi(data: Hysteria2KickDto) {
  return post<null>("/hysteria2/hysteria2Kick", data);
}

export function hysteria2ChangeVersionApi(data: Hysteria2VersionDto) {
  return post<null>("/hysteria2/hysteria2ChangeVersion", data);
}

export function listReleaseApi() {
  return get<string[]>("/hysteria2/listRelease");
}

export function hysteria2SubscribeUrlApi(dto: Hysteria2SubscribeUrlDto) {
  return get<Hysteria2SubscribeVo>("/hysteria2/hysteria2SubscribeUrl", {
    ...dto,
  });
}

export function hysteria2UrlApi(dto: Hysteria2UrlDto) {
  return get<Hysteria2UrlVo>("/hysteria2/hysteria2Url", { ...dto });
}
