<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    form: Snippet;
  }

  let { form }: Props = $props();
</script>

<section
  class="create-page-layout"
>
  <div class="form-card">
    {@render form()}
  </div>
</section>

<style>
  .create-page-layout {
    display: flex;
    justify-content: start;
    width: 100%;
  }

  .form-card {
    width: 100%;
    border-radius: clamp(18px, 2vw, 28px);
    border: 1px solid var(--border-card);
    background: var(--surface-card);
    padding: 32px;
    box-shadow: none;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
</style>
