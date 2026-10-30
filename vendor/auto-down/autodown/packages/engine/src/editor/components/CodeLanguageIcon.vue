<!-- CodeLanguageIcon component - Auto-generated from Auto language -->
<script setup lang="ts">
import { computed } from 'vue'
import { getLanguageIconUrl } from '../ext/code_language_icon_ext'


const props = defineProps<{
  language: string
}>()

const url = computed<any>(() => getLanguageIconUrl(props.language))


</script>

<template>
    <img class="code-language-icon" :alt="language" :height="16" :src="url" :width="16" />

</template>

<style>
/* Component styles */

</style>
