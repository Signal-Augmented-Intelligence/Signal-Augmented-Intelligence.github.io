/** Static export for GitHub Pages. Every route is written to out/<route>/index.html. */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
