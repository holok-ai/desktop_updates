import './app.css';
import 'primeicons/primeicons.css';
import { mount } from 'svelte';
import App from './App.svelte';

const appElement = document.getElementById('app');
if (appElement === null) {
  throw new Error('App mount point not found');
}

const app = mount(App, {
  target: appElement,
});

export default app;
