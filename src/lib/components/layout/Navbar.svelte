<script lang="ts">
  import { router } from '$lib/services/router.service';
  import { ROUTE, type RoutePath } from '$lib/constants/route.constant';

  let currentPath = $state<RoutePath>(ROUTE.HOME);

  $effect(() => {
    const unsubscribe = router.current.subscribe((route) => {
      currentPath = route.path as RoutePath;
    });
    return unsubscribe;
  });
  function navigateTo(path: RoutePath) {
    router.navigate(path);
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
