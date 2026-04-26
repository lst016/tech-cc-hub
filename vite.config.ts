import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(() => {
	const port = 4173;

	return {
		plugins: [react(), tailwindcss(), tsconfigPaths()],
		base: './',
		build: {
			outDir: 'dist-react',
		},
		server: {
			port, // MUST BE LOWERCASE
			strictPort: true,
			proxy: {
				"/__dev_bridge": {
					target: "http://127.0.0.1:4317",
					changeOrigin: true,
					rewrite: (path) => path.replace(/^\/__dev_bridge/, ''),
				},
			},
		},
	};
});
