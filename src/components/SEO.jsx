import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function SEO({ title, description, yearNumber, subjectName }) {
  const location = useLocation();
  const canonicalUrl = `https://jitsnotes.web.app${location.pathname}${location.search}`;

  useEffect(() => {
    // 1. Update Title
    document.title = title || "JITS Notes | JNTUH R22 Notes, Previous Papers & Important Questions";

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
    const desc = description || "Free JNTUH R22 Notes, Previous Question Papers, Important Questions and Study Resources for JITS CSE & AIML Students.";
    setMetaTag("name", "description", desc);

    // 3. Robots
    setMetaTag("name", "robots", "index, follow");

    // 4. Open Graph Tags
    setMetaTag("property", "og:title", "JITS Notes");
    setMetaTag("property", "og:description", "Free Notes, Previous Papers and Important Questions for JITS Students.");
    setMetaTag("property", "og:type", "website");
    setMetaTag("property", "og:url", canonicalUrl);
    setMetaTag("property", "og:image", "https://jitsnotes.web.app/icons.png");
    setMetaTag("property", "og:site_name", "JITS Notes");

    // 5. Twitter/X Meta Tags
    setMetaTag("name", "twitter:card", "summary");
    setMetaTag("name", "twitter:title", "JITS Notes");
    setMetaTag("name", "twitter:description", "Free Notes, Previous Papers and Important Questions for JITS Students.");
    setMetaTag("name", "twitter:image", "https://jitsnotes.web.app/icons.png");

    // 6. Canonical link
    setLinkTag("canonical", canonicalUrl);

    // 7. Structured Data (JSON-LD)
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach((script) => script.remove());

    // Website structured data
    const websiteSchema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "JITS Notes",
      "url": "https://jitsnotes.web.app",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://jitsnotes.web.app/resources?search={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    };

    // Educational Organization structured data
    const orgSchema = {
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      "name": "Jyothishmathi Institute of Technology and Science (JITS)",
      "url": "https://jitsnotes.web.app",
      "logo": "https://jitsnotes.web.app/icons.png",
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

    if (location.pathname === "/resources") {
      breadcrumbItems.push({
        "@type": "ListItem",
        "position": 2,
        "name": "Resources Repository",
        "item": "https://jitsnotes.web.app/resources"
      });
    } else if (yearNumber) {
      breadcrumbItems.push({
        "@type": "ListItem",
        "position": 2,
        "name": `Year ${yearNumber}`,
        "item": `https://jitsnotes.web.app/?year=${yearNumber}`
      });
      if (subjectName) {
        breadcrumbItems.push({
          "@type": "ListItem",
          "position": 3,
          "name": subjectName,
          "item": `https://jitsnotes.web.app/?year=${yearNumber}&subject=${encodeURIComponent(subjectName)}`
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

  }, [title, description, canonicalUrl, location.pathname, yearNumber, subjectName]);

  return null;
}
