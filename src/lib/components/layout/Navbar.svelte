<script lang="ts">
  import { ROUTE, type RoutePath } from '$lib/constants/route.constant';
  import { location, push } from 'svelte-spa-router';

  let currentPath = $state<RoutePath>(ROUTE.HOME);

  $effect(() => {
    const unsubscribe = location.subscribe((path: string) => {
      currentPath = (typeof path === 'string' && path.length > 0 ? path : ROUTE.HOME) as RoutePath;
    });
    return unsubscribe;
  });
  function navigateTo(path: RoutePath) {
    push(path);
  }
</script>

<nav>
  <ul>
    <li class:active={currentPath === ROUTE.HOME}>
      <button onclick={() => navigateTo(ROUTE.HOME)}>Home</button>
    </li>
    <li class:active={currentPath === ROUTE.THREADS}>
      <button onclick={() => navigateTo(ROUTE.THREADS)}>Threads</button>
    </li>
  </ul>
</nav>

<style>
  nav {
    width: 200px;
    background: #2a2a2a;
    padding: 1rem;
    border-right: 1px solid #333;
  }

  ul {
    list-style: none;
  }

  li {
    margin-bottom: 0.5rem;
  }

  li.active button {
    background: #646cff;
    color: white;
  }

  button {
    width: 100%;
    text-align: left;
    padding: 0.75rem 1rem;
    border: none;
    background: transparent;
    color: white;
    cursor: pointer;
    border-radius: 4px;
  }

  button:hover {
    background: #333;
  }
</style>
