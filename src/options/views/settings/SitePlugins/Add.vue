<template>
  <div>
    <v-dialog v-model="show" max-width="800">
      <v-card>
        <v-card-title
          class="headline blue-grey darken-2"
          style="color:white"
        >{{ $t('settings.sitePlugins.add.title') }}</v-card-title>

        <v-card-text>
          <Editor :data="selected"/>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions class="pa-3">
          <v-spacer></v-spacer>
          <v-btn flat color="error" @click="cancel">
            <v-icon>cancel</v-icon>
            <span class="ml-1">{{ $t('common.cancel') }}</span>
          </v-btn>
          <v-btn flat color="success" @click="save" :disabled="!selected.valid">
            <v-icon>check_circle_outline</v-icon>
            <span class="ml-1">{{ $t('common.ok') }}</span>
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
<script lang="ts">
import Vue from "vue";
import Editor from "./Editor.vue";
export default Vue.extend({
  components: {
    Editor
  },
  data() {
    return {
      show: false,
      selected: {} as any,
      valid: false
    };
  },
  props: {
    value: Boolean
  },
  model: {
    prop: "value",
    event: "change"
  },
  watch: {
    show() {
      this.$emit("change", this.show);
      if (!this.show) {
        this.selected = {};
      }
    },
    value() {
      this.show = this.value;
    }
  },
  methods: {
    save() {
      this.$emit("save", Object.assign({ isCustom: true }, this.selected));
      this.show = false;
    },
    cancel() {
      this.show = false;
    }
  }
});
</script>
