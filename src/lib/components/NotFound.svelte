<script lang="ts">
  import { onMount } from 'svelte';
  import { replace } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';

  onMount(() => {
    replace(ROUTE.HOME);
  });
</script>

