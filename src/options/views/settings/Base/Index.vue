<template>
  <div>
    <v-alert :value="true" type="info">{{ words.title }}</v-alert>
    <v-card color>
      <v-card-text>
        <v-form v-model="valid">
          <v-autocomplete
            v-model="options.defaultClientId"
            :items="this.$store.state.options.clients"
            :label="words.defaultClient"
            :menu-props="{maxHeight:'auto'}"
            :hint="getClientAddress"
            persistent-hint
            item-text="name"
            item-value="id"
            required
            :rules="rules.require"
          >
            <template slot="selection" slot-scope="{ item }">
              <span v-text="item.name"></span>
            </template>
            <template slot="item" slot-scope="data" style>
              <v-list-tile-content>
                <v-list-tile-title v-html="data.item.name"></v-list-tile-title>
                <v-list-tile-sub-title v-html="data.item.address"></v-list-tile-sub-title>
              </v-list-tile-content>
              <v-list-tile-action>
                <v-list-tile-action-text>{{ data.item.type }}</v-list-tile-action-text>
              </v-list-tile-action>
            </template>
          </v-autocomplete>

          <v-switch color="success" v-model="options.autoUpdate" :label="words.autoUpdate"></v-switch>
          <v-switch
            color="success"
            v-model="options.allowSelectionTextSearch"
            :label="words.allowSelectionTextSearch"
          ></v-switch>

          <v-switch
            color="success"
            v-model="options.allowDropToSend"
            :label="words.allowDropToSend"
          ></v-switch>
        </v-form>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions class="pa-3">
        <v-btn color="success" @click="save" :disabled="!valid">
          <v-icon>check_circle_outline</v-icon>
          <span class="ml-1">{{ words.save }}</span>
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn color="warning" @click="clearCache">
          <v-icon>settings_backup_restore</v-icon>
          <span class="ml-1">{{ words.clearCache }}</span>
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import { APP } from "../../../../service/api";
export default Vue.extend({
  data() {
    return {
      words: {
        title: "基本设置",
        defaultClient: "默认下载服务器",
        autoUpdate: "自动更新官方数据（默认10天更新）",
        save: "保存",
        allowSelectionTextSearch: "启用页面内容选择搜索",
        allowDropToSend: "启用拖放链接到插件图标时，直接发送链接到下载服务器",
        clearCache: "清除缓存",
        clearCacheConfirm:
          "确认要清除缓存吗？清除完成后，下次将会从官网中重新下载系统配置信息。"
      },
      valid: false,
      rules: {
        require: [(v: any) => !!v || "!"]
      },
      options: {
        defaultClientId: ""
      }
    };
  },
  methods: {
    save() {
      console.log(this.options);
      this.$store.commit("updateConfig", this.options);
    },
    clearCache() {
      if (confirm(this.words.clearCacheConfirm)) {
        APP.cache.clear();
      }
    }
  },
  created() {
    this.options = Object.assign({}, this.$store.state.options);
  },
  computed: {
    getClientAddress(): any {
      if (!this.options.defaultClientId) {
        return "";
      }
      let client = this.$store.state.options.clients.find((data: any) => {
        return this.options.defaultClientId === data.id;
      });

      if (client) {
        return client.address;
      }
      return "";
    }
  }
});
</script>