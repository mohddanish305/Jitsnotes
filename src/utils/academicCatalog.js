/**
 * Academic Catalog — Curriculum mapping and subject name resolution
 * Used across DocumentsCMS, NotesSection, and AcademicContentCMS
 */

export const KNOWN_SUBJECTS = {
  // Year 1
  AP: "Applied Physics",
  PA: "Applied Physics",
  PHYSICS: "Applied Physics",
  BEE: "Basic Electrical Engineering",
  CAEG: "Computer Aided Engineering Graphics",
  CHEM: "Engineering Chemistry",
  CHEMISTRY: "Engineering Chemistry",
  EDC: "Electronic Devices and Circuits",
  ENG: "English",
  ENGLISH: "English",
  "M1 & M2": "Mathematics - I & II",
  "M1 &  M2": "Mathematics - I & II",
  "M1,2": "Mathematics - I & II",
  M1: "Mathematics - I",
  M2: "Mathematics - II",
  MATHS: "Mathematics - I & II",
  PPS: "Programming for Problem Solving",
  // Year 2
  BEFA: "Business Economics & Financial Analysis",
  COA: "Computer Organization & Architecture",
  COSM: "Computer Oriented Statistical Methods",
  DBMS: "Database Management Systems",
  DE: "Digital Electronics",
  DM: "Discrete Mathematics",
  DS: "Data Structures",
  JAVA: "Java Programming",
  LABS: "Laboratory Manuals & Practicals",
  MSF: "Mathematical Foundations & Software Engineering",
  OS: "Operating Systems",
  SE: "Software Engineering",
  // Year 3
  AI: "Artificial Intelligence",
  CN: "Computer Networks",
  DA: "Data Analytics",
  DAA: "Design and Analysis of Algorithms",
  DEVOPS: "DevOps Engineering",
  FIOT: "Fundamentals of Internet of Things",
  FLAT: "Formal Languages & Automata Theory",
  FSD: "Full Stack Development",
  IDS: "Intrusion Detection Systems",
  IRS: "Information Retrieval Systems",
  ML: "Machine Learning",
  NLP: "Natural Language Processing",
  PPL: "Principles of Programming Languages",
  STM: "Software Testing Methodologies",
  // Year 4
  CC: "Cloud Computing",
  CD: "Compiler Design",
  "CD LABS": "Compiler Design Lab",
  "CD Labs": "Compiler Design Lab",
  CNS: "Cryptography & Network Security",
  HCI: "Human Computer Interaction",
  IEM: "Industrial Engineering & Management",
  MC: "Mobile Computing",
  NIC: "Nature Inspired Computing",
  OB: "Organizational Behaviour",
  SPPM: "Software Process & Project Management",
  WS: "Web Services & Semantic Web",
};

/**
 * Robustly resolves the user-facing display name for a subject.
 * Accepts either:
 *   - resolveSubjectName(subjectObject)
 *   - resolveSubjectName(subjectId, name, shortName)
 *   - resolveSubjectName(name, shortName)
 */
export const resolveSubjectName = (arg1, arg2, arg3) => {
  let rawName = "";
  let rawShort = "";

  if (typeof arg1 === "object" && arg1 !== null) {
    rawName = String(arg1.name || "").trim();
    rawShort = String(arg1.short_name || "").trim();
  } else if (typeof arg3 !== "undefined") {
    // Called as (subjectId, name, shortName)
    rawName = String(arg2 || "").trim();
    rawShort = String(arg3 || "").trim();
  } else if (typeof arg2 !== "undefined") {
    // Called as (name, shortName)
    rawName = String(arg1 || "").trim();
    rawShort = String(arg2 || "").trim();
  } else if (typeof arg1 === "string") {
    rawName = arg1.trim();
  }

  const normalizedShort = rawShort.toUpperCase();
  const normalizedName = rawName.toUpperCase();

  // Check known short codes first
  if (normalizedShort && KNOWN_SUBJECTS[normalizedShort]) {
    return KNOWN_SUBJECTS[normalizedShort];
  }

  // Check if name is a known code or synonym (e.g. "PHYSICS" or "MATHS")
  if (normalizedName && KNOWN_SUBJECTS[normalizedName]) {
    return KNOWN_SUBJECTS[normalizedName];
  }

  // If rawName is placeholder or empty ('.', '..', '...', '-', or blank)
  const isPlaceholder = !rawName || /^[.\-_]+$/.test(rawName) || /^unnamed subject$/i.test(rawName);
  if (isPlaceholder) {
    if (rawShort) {
      return KNOWN_SUBJECTS[normalizedShort] || rawShort;
    }
    return "";
  }

  // Capitalize properly if all lowercase (e.g. "physics" -> "Physics")
  if (rawName.toLowerCase() === rawName) {
    return rawName
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  return rawName;
};
