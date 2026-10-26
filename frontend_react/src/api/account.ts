import { get, post, postRaw } from "@/lib/api";
import type {
  AccountInfo,
  AccountLoginDto,
  AccountLoginVo,
  AccountPageDto,
  AccountSaveDto,
  AccountUpdateDto,
  AccountVo,
  IdDto,
  PageVo,
} from "@/types/api";

export function getAccountApi(data: IdDto) {
  return get<AccountVo>("/account/getAccount", { id: data.id });
}

export function saveAccountApi(data: AccountSaveDto) {
  return post<null>("/account/saveAccount", data);
}

export function getAccountInfoApi() {
  return get<AccountInfo>("/account/getAccountInfo");
}

export function pageAccountApi(params: AccountPageDto) {
  return get<PageVo<AccountVo>>("/account/pageAccount", {
    ...params,
    deleted:
      params.deleted === undefined || params.deleted === ""
        ? undefined
        : params.deleted,
  });
}

export function deleteAccountApi(data: IdDto) {
  return post<null>("/account/deleteAccount", data);
}

export function updateAccountApi(data: AccountUpdateDto) {
  return post<null>("/account/updateAccount", data);
}

export function resetTrafficApi(data: IdDto) {
  return post<null>("/account/resetTraffic", data);
}

export function loginApi(data: AccountLoginDto) {
  return post<AccountLoginVo>("/auth/login", data);
}

export function importAccountApi(data: FormData) {
  return post<null>("/account/importAccount", data, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function exportAccountApi() {
  return postRaw("/account/exportAccount");
}

export function releaseKickAccountApi(data: IdDto) {
  return post<null>("/account/releaseKickAccount", data);
}

export function verifyDefaultPassApi() {
  return get<boolean>("/account/verifyDefaultPass");
}
