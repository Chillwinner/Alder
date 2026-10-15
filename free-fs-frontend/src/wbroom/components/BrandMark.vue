<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number
  }>(),
  { size: 32 },
)
</script>

<template>
  <img
    src="/favicon.svg"
    :width="size"
    :height="size"
    alt=""
    draggable="false"
  />
</template>
