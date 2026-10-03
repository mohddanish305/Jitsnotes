import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function SEO({ title, description, yearNumber, subjectName }) {
  const location = useLocation();
  const rawPath = location.pathname === "/" ? "/" : location.pathname;
  const canonicalUrl = `https://jitsnotes.web.app${rawPath}`;

  const isAdminPage = location.pathname === "/admin-login" || location.pathname.startsWith("/admin");

  useEffect(() => {
    // 1. Update Title
    const defaultTitle = "JITS Notes | JNTUH R22 Notes, Previous Papers & Study Material";
    document.title = title ? (title.includes("JITS Notes") ? title : `${title} | JITS Notes`) : defaultTitle;

    // Helper function to set or create meta tags
    const setMetaTag = (attrName, attrValue, contentValue) => {
      let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attrName, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute("content", contentValue);
    };

    // Helper function to set or create link tags
    const setLinkTag = (relValue, hrefValue) => {
      let element = document.querySelector(`link[rel="${relValue}"]`);
      if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", relValue);
        document.head.appendChild(element);
      }
      element.setAttribute("href", hrefValue);
    };

    // 2. Meta Description
    const desc = description || "JITS Notes provides free JNTUH B.Tech R22 notes, CSE and AIML study material, previous question papers, important questions, and engineering lecture notes.";
    setMetaTag("name", "description", desc);

    // 3. Application Name & Author
    setMetaTag("name", "application-name", "JITS Notes");
    setMetaTag("name", "author", "MOHD DANISH");

    // 4. Robots - Block indexing for admin routes
    if (isAdminPage) {
      setMetaTag("name", "robots", "noindex, nofollow");
    } else {
      setMetaTag("name", "robots", "index, follow");
    }

    // 5. Open Graph Tags
    setMetaTag("property", "og:title", title ? (title.includes("JITS Notes") ? title : `${title} | JITS Notes`) : defaultTitle);
    setMetaTag("property", "og:description", desc);
    setMetaTag("property", "og:type", "website");
    setMetaTag("property", "og:url", canonicalUrl);
    setMetaTag("property", "og:image", "https://jitsnotes.web.app/icons.png");
    setMetaTag("property", "og:site_name", "JITS Notes");

    // 6. Twitter/X Meta Tags
    setMetaTag("name", "twitter:card", "summary_large_image");
    setMetaTag("name", "twitter:title", title ? (title.includes("JITS Notes") ? title : `${title} | JITS Notes`) : defaultTitle);
    setMetaTag("name", "twitter:description", desc);
    setMetaTag("name", "twitter:image", "https://jitsnotes.web.app/icons.png");

    // 7. Canonical link
    setLinkTag("canonical", canonicalUrl);

    // 8. Structured Data (JSON-LD) - Skip on admin pages
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach((script) => script.remove());

    if (!isAdminPage) {
      // Website structured data
      const websiteSchema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "JITS Notes",
        "alternateName": "JITS B.Tech Notes",
        "url": "https://jitsnotes.web.app/",
        "description": "JITS Notes is a free educational platform providing JNTUH B.Tech R22 notes, CSE and AIML study material, previous question papers, important questions, and engineering lecture notes.",
        "author": {
          "@type": "Person",
          "name": "MOHD DANISH"
        },
        "publisher": {
          "@type": "Organization",
          "name": "JITS Notes",
          "url": "https://jitsnotes.web.app/",
          "logo": "https://jitsnotes.web.app/icons.png"
        }
      };

      // Educational Organization structured data
      const orgSchema = {
        "@context": "https://schema.org",
        "@type": "EducationalOrganization",
        "name": "JITS Notes",
        "url": "https://jitsnotes.web.app/",
        "logo": "https://jitsnotes.web.app/icons.png",
        "description": "JITS Notes is a free educational platform providing JNTUH B.Tech R22 notes, CSE and AIML study material, previous question papers, important questions, and engineering lecture notes.",
        "sameAs": [
          "https://github.com/mohddanish305",
          "https://www.linkedin.com/in/mohd-danish-986a5b2a3/"
        ]
      };

      // BreadcrumbList structured data
      const breadcrumbItems = [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://jitsnotes.web.app/"
        }
      ];

      if (yearNumber) {
        breadcrumbItems.push({
          "@type": "ListItem",
          "position": 2,
          "name": `Year ${yearNumber}`,
          "item": `https://jitsnotes.web.app/year/${yearNumber}`
        });
        if (subjectName) {
          breadcrumbItems.push({
            "@type": "ListItem",
            "position": 3,
            "name": subjectName,
            "item": `https://jitsnotes.web.app/year/${yearNumber}/${encodeURIComponent(subjectName.toLowerCase())}`
          });
        }
      }

      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbItems
      };

      const schemas = [websiteSchema, orgSchema, breadcrumbSchema];
      schemas.forEach((schema) => {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.text = JSON.stringify(schema);
        document.head.appendChild(script);
      });
    }

  }, [title, description, canonicalUrl, location.pathname, yearNumber, subjectName, isAdminPage]);

  return null;
}
