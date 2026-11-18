<template>
  <div class="app-container">
    <el-alert :title="$t('vless.externalServerTip')" type="info" :closable="false" class="mb-4" />
    <el-card shadow="never" class="mb-4">
      <template #header>{{ $t("vless.serviceManagement") }}</template>
      <el-alert :title="$t('vless.serviceImpactNotice')" type="warning" :closable="false" class="mb-4" />
      <div class="flex flex-wrap items-center gap-2">
        <el-tag :type="serviceStatus?.running ? 'success' : 'info'">
          {{ statusLoading ? $t("vless.checkingStatus") : serviceStatus ? `${serviceStatus.state} · ${serviceStatus.version || $t("vless.versionUnknown")}` : $t("vless.statusUnavailable") }}
        </el-tag>
        <el-button :loading="statusLoading" @click="loadServiceStatus">{{ $t("common.refresh") }}</el-button>
        <el-button type="success" :disabled="Boolean(serviceStatus?.running || serviceAction)" @click="controlService('start')">{{ $t("vless.startService") }}</el-button>
        <el-button type="warning" :disabled="!serviceStatus?.running || Boolean(serviceAction)" @click="controlService('stop')">{{ $t("vless.stopService") }}</el-button>
        <el-button :disabled="!serviceStatus?.running || Boolean(serviceAction)" @click="controlService('restart')">{{ $t("vless.restartService") }}</el-button>
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        <span class="font-medium">{{ $t("vless.upgradeXray") }}</span>
        <el-select v-model="version" :placeholder="$t('vless.selectVersion')" class="w-48">
          <el-option v-for="item in versions" :key="item" :label="item" :value="item" />
        </el-select>
        <el-button type="primary" :loading="upgrading" :disabled="!version || Boolean(serviceAction)" @click="upgrade">{{ $t("vless.upgrade") }}</el-button>
      </div>
    </el-card>
    <el-card shadow="never">
      <el-form v-loading="loading" :model="form" label-position="top">
        <el-form-item :label="$t('vless.enabled')">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item :label="$t('vless.address')" required>
              <el-input v-model="form.address" placeholder="vless.example.com" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item :label="$t('vless.port')" required>
              <el-input-number v-model="form.port" :min="1" :max="65535" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item :label="$t('vless.remark')">
              <el-input v-model="form.remark" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item :label="$t('vless.network')">
              <el-select v-model="form.network" style="width: 100%" @change="handleNetworkChange">
                <el-option label="TCP" value="tcp" />
                <el-option label="WebSocket" value="ws" />
                <el-option label="gRPC" value="grpc" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item :label="$t('vless.security')">
              <el-select v-model="form.security" style="width: 100%" @change="handleSecurityChange">
                <el-option label="None" value="none" />
                <el-option label="TLS" value="tls" />
                <el-option label="Reality" value="reality" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col v-if="form.security !== 'none'" :xs="24" :md="12">
            <el-form-item :label="$t('vless.sni')">
              <el-input v-model="form.sni" :placeholder="form.address" />
            </el-form-item>
          </el-col>
          <el-col v-if="form.security !== 'none'" :xs="24" :md="12">
            <el-form-item :label="$t('vless.fingerprint')">
              <el-input v-model="form.fingerprint" placeholder="chrome" />
            </el-form-item>
          </el-col>
          <template v-if="form.security === 'reality'">
            <el-col :xs="24" :md="12">
              <el-form-item :label="$t('vless.publicKey')" required>
                <el-input v-model="form.publicKey" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item :label="$t('vless.shortId')" required>
                <el-input v-model="form.shortId" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item :label="$t('vless.spiderX')">
                <el-input v-model="form.spiderX" placeholder="/" />
              </el-form-item>
            </el-col>
          </template>
          <el-col v-if="form.network === 'tcp' && form.security !== 'none'" :xs="24" :md="12">
            <el-form-item :label="$t('vless.flow')">
              <el-select v-model="form.flow" clearable style="width: 100%">
                <el-option label="xtls-rprx-vision" value="xtls-rprx-vision" />
              </el-select>
            </el-form-item>
          </el-col>
          <template v-if="form.network === 'ws'">
            <el-col :xs="24" :md="12">
              <el-form-item :label="$t('vless.path')">
                <el-input v-model="form.path" placeholder="/" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item :label="$t('vless.host')">
                <el-input v-model="form.host" />
              </el-form-item>
            </el-col>
          </template>
          <el-col v-if="form.network === 'grpc'" :xs="24" :md="12">
            <el-form-item :label="$t('vless.serviceName')">
              <el-input v-model="form.serviceName" />
            </el-form-item>
          </el-col>
          <el-col v-if="form.security !== 'none'" :xs="24" :md="12">
            <el-form-item :label="$t('vless.alpn')">
              <el-input v-model="alpnText" placeholder="h2,http/1.1" />
            </el-form-item>
          </el-col>
          <el-col v-if="form.security === 'tls'" :xs="24" :md="12">
            <el-form-item :label="$t('vless.allowInsecure')">
              <el-switch v-model="form.allowInsecure" />
            </el-form-item>
          </el-col>
        </el-row>
        <div class="mb-2 mt-6 border-t pt-4 font-medium">{{ $t("vless.xrayManagement") }}</div>
        <p class="mb-4 text-xs text-gray-500">{{ $t("vless.xrayManagementDescription") }}</p>
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item :label="$t('vless.xrayConfigPath')" required>
              <el-input v-model="form.xrayConfigPath" placeholder="/etc/xray/config.json" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item :label="$t('vless.xrayServiceName')" required>
              <el-input v-model="form.xrayServiceName" placeholder="xray" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item :label="$t('vless.xrayApiAddress')" required>
              <el-input v-model="form.xrayApiAddress" placeholder="127.0.0.1:10085" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item :label="$t('vless.xrayInboundTag')" required>
              <el-input v-model="form.xrayInboundTag" placeholder="h-ui-vless" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item :label="$t('vless.xrayBinaryPath')" required>
              <el-input v-model="form.xrayBinaryPath" placeholder="/usr/local/bin/xray" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">
            {{ $t("common.save") }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import {
  controlXrayServiceApi,
  getVlessConfigApi,
  getXrayServiceStatusApi,
  listXrayReleaseVersionsApi,
  updateVlessConfigApi,
  upgradeXrayApi,
} from "@/api/vless";
import { VlessConfig, XrayServiceAction, XrayServiceStatus } from "@/api/vless/types";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const defaults: VlessConfig = {
  enabled: false,
  address: "",
  port: 443,
  network: "tcp",
  security: "tls",
  remark: "VLESS",
  sni: "",
  fingerprint: "chrome",
  publicKey: "",
  shortId: "",
  spiderX: "",
  flow: "",
  path: "/",
  host: "",
  serviceName: "",
  alpn: [],
  allowInsecure: false,
  xrayConfigPath: "/etc/xray/config.json",
  xrayServiceName: "xray",
  xrayApiAddress: "127.0.0.1:10085",
  xrayInboundTag: "h-ui-vless",
  xrayBinaryPath: "/usr/local/bin/xray",
};
const form = reactive<VlessConfig>({ ...defaults });
const loading = ref(false);
const saving = ref(false);
const serviceStatus = ref<XrayServiceStatus | null>(null);
const statusLoading = ref(false);
const serviceAction = ref<XrayServiceAction | null>(null);
const versions = ref<string[]>([]);
const version = ref("");
const upgrading = ref(false);
const alpnText = computed({
  get: () => form.alpn.join(","),
  set: (value: string) => {
    form.alpn = value.split(",").map((item) => item.trim()).filter(Boolean);
  },
});

const handleNetworkChange = (value: unknown) => {
  const network = value as VlessConfig["network"];
  if (network !== "tcp") {
    if (form.security === "reality") form.security = "tls";
    form.flow = "";
  }
};

const handleSecurityChange = (value: unknown) => {
  const security = value as VlessConfig["security"];
  if (security === "reality") form.network = "tcp";
  if (security === "none") form.flow = "";
};

const load = async () => {
  loading.value = true;
  try {
    const { data } = await getVlessConfigApi();
    Object.assign(form, defaults, data);
  } catch (e) {
    /* request interceptor displays the error */
  } finally {
    loading.value = false;
  }
};

const loadServiceStatus = async () => {
  statusLoading.value = true;
  try {
    const { data } = await getXrayServiceStatusApi();
    serviceStatus.value = data;
  } catch (e) {
    serviceStatus.value = null;
  } finally {
    statusLoading.value = false;
  }
};

const loadVersions = async () => {
  try {
    const { data } = await listXrayReleaseVersionsApi();
    versions.value = data;
    if (!version.value) version.value = data[0] || "";
  } catch (e) {
    versions.value = [];
  }
};

const controlService = async (action: XrayServiceAction) => {
  if (serviceAction.value) return;
  serviceAction.value = action;
  try {
    await controlXrayServiceApi(action);
    ElMessage.success(t("vless.serviceActionSuccess"));
    await loadServiceStatus();
  } catch (e) {
    /* request interceptor displays the error */
  } finally {
    serviceAction.value = null;
  }
};

const upgrade = async () => {
  if (!version.value || upgrading.value) return;
  upgrading.value = true;
  try {
    await upgradeXrayApi(version.value);
    ElMessage.success(t("vless.upgradeSuccess"));
    await loadServiceStatus();
  } catch (e) {
    /* request interceptor displays the error */
  } finally {
    upgrading.value = false;
  }
};

const save = async () => {
  saving.value = true;
  try {
    await updateVlessConfigApi(form);
    ElMessage.success(t("vless.saveSuccess"));
  } catch (e) {
    /* request interceptor displays the error */
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  void load();
  void loadServiceStatus();
  void loadVersions();
});
const statusTimer = window.setInterval(() => void loadServiceStatus(), 15000);
onBeforeUnmount(() => window.clearInterval(statusTimer));
</script>
