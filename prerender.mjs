import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const routes = [
  '/',
  '/about',
  '/privacy-policy',
  '/terms',
  '/disclaimer',
  '/cookie-policy',
  '/copyright',
  '/contact'
];

const DOMAIN = 'https://jitsnotes.web.app';
const DIST_DIR = path.resolve(__dirname, 'dist');
const PORT = 3051;

async function prerender() {
  console.log('Starting prerender process...');
  
  // 1. Start local server for dist
  const app = express();
  app.use(express.static(DIST_DIR));
  app.use((req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
  
  const server = app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    try {
      const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
      });
      
      const sitemapUrls = [];

      for (const route of routes) {
        console.log(`Prerendering ${route}...`);
        const page = await browser.newPage();
        
        // Disable unnecessary resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        });

        await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Wait for React to mount and render
        await page.waitForSelector('#root > div', { timeout: 10000 }).catch(() => {});
        
        const html = await page.content();
        
        // Create directory if needed
        const routePath = route === '/' ? '/index.html' : `${route}/index.html`;
        const fullPath = path.join(DIST_DIR, routePath);
        
        if (route !== '/') {
          fs.mkdirSync(path.join(DIST_DIR, route), { recursive: true });
        }
        
        fs.writeFileSync(fullPath, html);
        await page.close();
        
        sitemapUrls.push(`
  <url>
    <loc>${DOMAIN}${route}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${route === '/' ? 'daily' : 'monthly'}</changefreq>
    <priority>${route === '/' ? '1.0' : '0.8'}</priority>
  </url>`);
      }
      
      await browser.close();
      
      // 2. Generate Sitemap
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.join('\n')}
</urlset>`;
      fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml);
      console.log('Generated sitemap.xml');

      // 3. Generate robots.txt
      const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin-login
Disallow: /admin/
Disallow: /year/

Sitemap: ${DOMAIN}/sitemap.xml`;
      fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsTxt);
      console.log('Generated robots.txt');

      // 4. Generate 404.html for Firebase fallback
      fs.copyFileSync(path.join(DIST_DIR, 'index.html'), path.join(DIST_DIR, '404.html'));
      console.log('Generated 404.html');

      console.log('Prerendering completed successfully.');
    } catch (error) {
      console.error('Prerendering failed:', error);
      process.exit(1);
    } finally {
      server.close();
    }
  });
}

prerender();
