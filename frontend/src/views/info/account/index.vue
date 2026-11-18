<template>
  <div class="dashboard-container">
    <el-card shadow="never">
      <el-row justify="space-between">
        <el-col :span="12" :xs="24">
          <div class="flex h-full items-center">
            <img
              class="w-20 h-20 mr-5 rounded-full"
              src="/src/assets/logo.png"
            />
            <div>
              <p>{{ greetings }}</p>
              <p class="text-sm text-gray">
                {{ $t("account.createTime") }}:
                {{ timestampToDateTime(account.createTime) }}
              </p>
            </div>
          </div>
        </el-col>

        <el-col :span="12" :xs="24">
          <div class="flex h-full items-center" style="justify-content: right">
            <el-button type="primary" :icon="Share" @click="handleSubscribe">
              {{ $t("common.subscribe") }}
            </el-button>
            <el-button
              type="primary"
              :icon="Share"
              @click="handleSubscribeQrCode"
            >
              {{ $t("common.subscribeQrCode") }}
            </el-button>
            <el-button type="primary" :icon="Share" @click="handleNodeUrl">
              {{ $t("common.nodeUrl") }}
            </el-button>
            <el-button type="primary" :icon="Share" @click="handleUrlQrCode">
              {{ $t("common.nodeQrCode") }}
            </el-button>
            <el-button type="primary" :icon="Share" @click="handleVlessSubscribe">
              {{ $t("common.vlessSubscribe") }}
            </el-button>
            <el-button type="primary" :icon="Share" @click="handleVlessSubscribeQrCode">
              {{ $t("common.vlessSubscribeQrCode") }}
            </el-button>
            <el-button type="primary" :icon="Share" @click="handleVlessNodeUrl">
              {{ $t("common.vlessNodeUrl") }}
            </el-button>
            <el-button type="primary" :icon="Share" @click="handleVlessNodeQrCode">
              {{ $t("common.vlessNodeQrCode") }}
            </el-button>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <p class="mb-2 mt-3 text-xs text-gray-500">{{ $t("account.nodeTrafficHint") }}</p>
    <el-row :gutter="10">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="text-[var(--el-text-color-secondary)]">
                {{ $t("account.quota") }}
              </span>
              <el-tag type="success"
                >{{ formatStorageUnit(account.quota) }}
              </el-tag>
            </div>
          </template>
          <div class="flex items-center justify-between mt-5">
            <div class="text-lg text-right">
              {{ formatBytes(account.quota) }}
            </div>
            <svg-icon icon-class="quota" size="2em" />
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="text-[var(--el-text-color-secondary)]">
                {{ $t("account.hysteria2Traffic") }}
              </span>
              <el-tag type="success"
                >{{ formatStorageUnit(hysteria2Total) }}
              </el-tag>
            </div>
          </template>
          <div class="flex items-center justify-between mt-5">
            <div class="text-lg text-right">
              {{ formatBytes(hysteria2Total) }}
              <div class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
                ↓ {{ formatBytes(account.hysteria2Download || 0) }} · ↑ {{ formatBytes(account.hysteria2Upload || 0) }}
              </div>
            </div>
            <svg-icon icon-class="download" size="2em" />
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="text-[var(--el-text-color-secondary)]">
                {{ $t("account.vlessTraffic") }}
              </span>
              <el-tag type="success"
                >{{ formatStorageUnit(vlessTotal) }}
              </el-tag>
            </div>
          </template>
          <div class="flex items-center justify-between mt-5">
            <div class="text-lg text-right">
              {{ formatBytes(vlessTotal) }}
              <div class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
                ↓ {{ formatBytes(account.vlessDownload || 0) }} · ↑ {{ formatBytes(account.vlessUpload || 0) }}
              </div>
            </div>
            <svg-icon icon-class="upload" size="2em" />
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="text-[var(--el-text-color-secondary)]">
                {{ $t("account.expireTime") }}
              </span>
              <el-tag type="success">{{ $t("info.expireTime") }}</el-tag>
            </div>
          </template>
          <div class="flex items-center justify-between mt-5">
            <div class="text-lg text-right">
              {{ timestampToDateTime(account.expireTime) }}
            </div>
            <svg-icon icon-class="expire-time" size="2em" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog
      :title="qrCodeDialog.title"
      v-model="qrCodeDialog.visible"
      width="600px"
      append-to-body
      @close="qrCodeDialog.visible = false"
    >
      <el-form style="text-align: center">
        <el-image
          style="width: 300px; height: 300px"
          :src="qrCodeSrc"
        ></el-image>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="qrCodeDialog.visible = false"
            >{{ $t("common.confirm") }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts">
export default {
  name: "index",
};
</script>

<script setup lang="ts">
import { getAccountApi, verifyDefaultPassApi } from "@/api/account";
import { AccountVo } from "@/api/account/types";
import { useAccountStore } from "@/store/modules/account";
import { timestampToDateTime } from "@/utils/time";
import { formatBytes, formatStorageUnit } from "@/utils/byte";
import { Share } from "@element-plus/icons-vue";
import { useI18n } from "vue-i18n";
import {
  Hysteria2SubscribeUrlDto,
  Hysteria2UrlDto,
} from "@/api/hysteria2/types";
import { hysteria2SubscribeUrlApi, hysteria2UrlApi } from "@/api/hysteria2";
import { vlessSubscribeUrlApi, vlessUrlApi } from "@/api/vless";
import copy from "copy-to-clipboard";

const { t } = useI18n();
const accountStore = useAccountStore();

const date: Date = new Date();

const greetings = computed(() => {
  const hours = date.getHours();
  if (hours >= 6 && hours < 8) {
    return t("info.greeting1");
  } else if (hours >= 8 && hours < 12) {
    return t("info.greeting2") + accountStore.username + "！";
  } else if (hours >= 12 && hours < 18) {
    return t("info.greeting3") + accountStore.username + "！";
  } else if (hours >= 18 && hours < 24) {
    return t("info.greeting4") + accountStore.username + "！";
  } else if (hours >= 0 && hours < 6) {
    return t("info.greeting5");
  }
  return "Hello H UI";
});

const state = reactive({
  account: {} as AccountVo,
  qrCodeDialog: {
    title: "QR Code",
    visible: false,
  } as DialogType,
  qrCodeSrc: "",
});

const { qrCodeDialog, account, qrCodeSrc } = toRefs(state);
const hysteria2Total = computed(
  () => (account.value.hysteria2Download || 0) + (account.value.hysteria2Upload || 0),
);
const vlessTotal = computed(
  () => (account.value.vlessDownload || 0) + (account.value.vlessUpload || 0),
);

const handleSubscribe = async () => {
  try {
    const dto: Hysteria2SubscribeUrlDto = {
      accountId: accountStore.id,
      protocol: window.location.protocol,
      host: window.location.host,
    };
    const { data } = await hysteria2SubscribeUrlApi(dto);
    copy(data.url);
    ElMessage.success(t("common.copySuccess"));
  } catch (e) {
    /* empty */
  }
};

const handleSubscribeQrCode = async () => {
  try {
    const dto: Hysteria2SubscribeUrlDto = {
      accountId: accountStore.id,
      protocol: window.location.protocol,
      host: window.location.host,
    };
    const { data } = await hysteria2SubscribeUrlApi(dto);
    state.qrCodeSrc = "data:image/png;base64," + data.qrCode;
    state.qrCodeDialog.visible = true;
  } catch (e) {
    /* empty */
  }
};

const handleNodeUrl = async () => {
  try {
    const dto: Hysteria2UrlDto = {
      accountId: accountStore.id,
      hostname: window.location.hostname,
    };
    const { data } = await hysteria2UrlApi(dto);
    copy(data.url);
    ElMessage.success(t("common.copySuccess"));
  } catch (e) {
    /* empty */
  }
};

const handleUrlQrCode = async () => {
  try {
    const dto: Hysteria2UrlDto = {
      accountId: accountStore.id,
      hostname: window.location.hostname,
    };
    const { data } = await hysteria2UrlApi(dto);
    state.qrCodeSrc = "data:image/png;base64," + data.qrCode;
    state.qrCodeDialog.visible = true;
  } catch (e) {
    /* empty */
  }
};

const getVlessSubscribeDto = () => ({
  accountId: accountStore.id,
  protocol: window.location.protocol,
  host: window.location.host,
});

const handleVlessSubscribe = async () => {
  try {
    const { data } = await vlessSubscribeUrlApi(getVlessSubscribeDto());
    copy(data.url);
    ElMessage.success(t("common.copySuccess"));
  } catch (e) {
    /* request layer displays errors */
  }
};

const handleVlessSubscribeQrCode = async () => {
  try {
    const { data } = await vlessSubscribeUrlApi(getVlessSubscribeDto());
    state.qrCodeSrc = "data:image/png;base64," + data.qrCode;
    state.qrCodeDialog.visible = true;
  } catch (e) {
    /* request layer displays errors */
  }
};

const handleVlessNodeUrl = async () => {
  try {
    const { data } = await vlessUrlApi({ accountId: accountStore.id });
    copy(data.url);
    ElMessage.success(t("common.copySuccess"));
  } catch (e) {
    /* request layer displays errors */
  }
};

const handleVlessNodeQrCode = async () => {
  try {
    const { data } = await vlessUrlApi({ accountId: accountStore.id });
    state.qrCodeSrc = "data:image/png;base64," + data.qrCode;
    state.qrCodeDialog.visible = true;
  } catch (e) {
    /* request layer displays errors */
  }
};

onMounted(() => {
  getAccountApi({ id: accountStore.id }).then((response) => {
    Object.assign(state.account, response.data);
  });
  if (accountStore.roles.indexOf("admin") != -1) {
    verifyDefaultPassApi().then((response) => {
      if (response.data) {
        ElNotification({
          title: t("common.securityRisk"),
          dangerouslyUseHTMLString: true,
          message: t("common.defaultPassTip"),
          type: "warning",
        });
      }
    });
    if (window.location.protocol !== "https:") {
      ElNotification({
        title: t("common.securityRisk"),
        dangerouslyUseHTMLString: true,
        message: t("common.noHttpsTip"),
        type: "warning",
      });
    }
  }
});
</script>

<style lang="scss" scoped>
.dashboard-container {
  position: relative;
  padding: 24px;

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }

  .github-corner {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    border: 0;
  }

  .data-box {
    display: flex;
    justify-content: space-between;
    padding: 20px;
    font-weight: bold;
    color: var(--el-text-color-regular);
    background: var(--el-bg-color-overlay);
    border-color: var(--el-border-color);
    box-shadow: var(--el-box-shadow-dark);
  }

  .svg-icon {
    fill: currentcolor !important;
  }
}

.flex.h-full.items-center {
  .el-button {
    margin: 10px;
  }
}

@media (max-width: 768px) {
  .flex.h-full.items-center {
    justify-content: center;
  }
}

@media (max-width: 634px) {
  .flex.h-full.items-center {
    flex-direction: column;
  }
}
</style>
