<template>
  <div class="app-container">
    <el-alert :title="$t('vless.externalServerTip')" type="info" :closable="false" class="mb-4" />
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
import { getVlessConfigApi, updateVlessConfigApi } from "@/api/vless";
import { VlessConfig } from "@/api/vless/types";
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

onMounted(load);
</script>
