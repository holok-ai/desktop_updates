<script lang="ts">
  // eslint-disable-next-line no-unused-vars
  let { currentPage, onnavigate }: { currentPage: string; onnavigate: (page: string) => void } =
    $props();

  function navigate(page: string) {
    onnavigate(page);
  }
</script>

<nav>
  <ul>
    <li class:active={currentPage === 'home'}>
      <button onclick={() => navigate('home')}>Home</button>
    </li>
    <li class:active={currentPage === 'threads'}>
      <button onclick={() => navigate('threads')}>Threads</button>
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
