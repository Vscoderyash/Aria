import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  manifest: {
    name: 'JARVIS Browser Agent',
    description: 'JARVIS by Yash Raj: plans, thinks and acts on web pages by voice. Pairs with JARVIS Desktop for the whole computer.',
    permissions: ['storage', 'tabs', 'scripting', 'sessions'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'JARVIS',
      default_icon: {
        16: '/icons/16.png',
        48: '/icons/48.png',
        128: '/icons/128.png',
      },
    },
    icons: {
      16: '/icons/16.png',
      48: '/icons/48.png',
      128: '/icons/128.png',
    },
  },
});
