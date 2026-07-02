import adapter from '@sveltejs/adapter-static';

const config = {
  kit: {
    adapter: adapter({ fallback: 'index.html' }),
    prerender: { entries: [] }
  }
};

export default config;
