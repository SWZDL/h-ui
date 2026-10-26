import axios, { AxiosError, type AxiosResponse } from "axios";
import { toast } from "sonner";
import type { ApiResult } from "@/types/api";

declare global {
  interface Window {
    __dynamic_base__?: string;
  }
}

/** The Go server injects this when the panel is mounted on a sub-path. */
export const dynamicBase = window.__dynamic_base__ ?? "";

const baseApi = import.meta.env.VITE_APP_BASE_API ?? "/hui";

export const http = axios.create({
  baseURL: `${dynamicBase}${baseApi}`,
  timeout: 50_000,
  headers: { "Content-Type": "application/json;charset=utf-8" },
});

export const TOKEN_KEY = "accessToken";

export const UNAUTHORIZED_EVENT = "hui:unauthorized";

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = token;
  }
  return config;
});

function fail(message: string) {
  toast.error(message || "Request failed");
  return Promise.reject(new Error(message || "Request failed"));
}

http.interceptors.response.use(
  (response: AxiosResponse) => {
    // Binary payloads (export endpoints) bypass the envelope check.
    if (response.config.responseType === "blob") {
      return response;
    }

    const body = response.data as ApiResult<unknown> | undefined;
    if (!body || typeof body !== "object" || body.code === undefined) {
      return response;
    }

    if (body.code === 20000) {
      return response;
    }

    if (body.code === 50401) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      return fail(body.message || "Unauthorized");
    }

    return fail(body.message);
  },
  async (error: AxiosError) => {
    const data = error.response?.data;

    // Errors on blob requests arrive as an opaque Blob; try to decode it.
    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const parsed = JSON.parse(text) as ApiResult<unknown>;
        return fail(parsed.message);
      } catch {
        return fail(error.message);
      }
    }

    if (data && typeof data === "object") {
      const parsed = data as ApiResult<unknown>;
      if (parsed.code === 50401) {
        localStorage.removeItem(TOKEN_KEY);
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      }
      return fail(parsed.message);
    }

    return fail(error.message);
  }
);

/** GET wrapper returning the unwrapped `data` field. */
export async function get<T>(
  url: string,
  params?: Record<string, unknown>
): Promise<T> {
  const response = await http.get<ApiResult<T>>(url, { params });
  return response.data.data;
}

/** POST wrapper returning the unwrapped `data` field. */
export async function post<T>(
  url: string,
  data?: unknown,
  config?: Parameters<typeof http.post>[2]
): Promise<T> {
  const response = await http.post<ApiResult<T>>(url, data, config);
  return response.data.data;
}

/** POST returning the raw response (needed for downloads / headers). */
export async function postRaw(
  url: string,
  data?: unknown,
  config?: Parameters<typeof http.post>[2]
): Promise<AxiosResponse<Blob>> {
  return http.post(url, data, { ...config, responseType: "blob" });
}
