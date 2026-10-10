/**
 * JITS Notes — Subject Illustration Asset Mapping
 *
 * Centralized mapping of subject codes to their dedicated illustration files
 * stored in `/public/images/subjects/` using exact short filenames.
 *
 * All image files preserve their original filenames and extensions (e.g., `AI.jpg`, `CN.jpg`).
 */

export const SUBJECT_IMAGE_MAP = {
  AI: "/images/subjects/AI.jpg",
  AP: "/images/subjects/AP.jpg",
  BCT: "/images/subjects/BCT.jpg",
  BEE: "/images/subjects/BEE.jpg",
  BEFA: "/images/subjects/BEFA.jpg",
  CAEG: "/images/subjects/CAEG.jpg",
  CC: "/images/subjects/CC.jpg",
  CD: "/images/subjects/CD.jpg",
  CHM: "/images/subjects/CHM.jpg",
  CN: "/images/subjects/CN.jpg",
  CNS: "/images/subjects/CNS.jpg",
  COA: "/images/subjects/COA.jpg",
  COSM: "/images/subjects/COSM.jpg",
  DA: "/images/subjects/DA.jpg",
  DAA: "/images/subjects/DAA.jpg",
  DBMS: "/images/subjects/DBMS.jpg",
  DE: "/images/subjects/DE.jpg",
  DEVOPS: "/images/subjects/DEVOPS.jpg",
  DM: "/images/subjects/DM.jpg",
  DS: "/images/subjects/DS.jpg",
  EDC: "/images/subjects/EDC.jpg",
  ENG: "/images/subjects/ENG.jpg",
  FIOT: "/images/subjects/FIOT.jpg",
  FLAT: "/images/subjects/FLAT.jpg",
  FSD: "/images/subjects/FSD.jpg",
  HCI: "/images/subjects/HCI.jpg",
  IDS: "/images/subjects/IDS.jpg",
  IEM: "/images/subjects/IEM.jpg",
  IRS: "/images/subjects/IRS.jpg",
  JAVA: "/images/subjects/JAVA.jpg",
  LAB: "/images/subjects/LAB.jpg",
  LABS: "/images/subjects/LABS.jpg",
  M1: "/images/subjects/M1.jpg",
  M2: "/images/subjects/M2.jpg",
  MC: "/images/subjects/MC.jpg",
  ML: "/images/subjects/ML.jpg",
  MSF: "/images/subjects/MSF.jpg",
  NIC: "/images/subjects/NIC.jpg",
  NLP: "/images/subjects/NLP.jpg",
  OB: "/images/subjects/OB.jpg",
  OS: "/images/subjects/OS.jpg",
  PPL: "/images/subjects/PPL.jpg",
  PPS: "/images/subjects/PPS.jpg",
  SE: "/images/subjects/SE.jpg",
  SPPM: "/images/subjects/SPPM.jpg",
  STM: "/images/subjects/STM.jpg",
  SWM: "/images/subjects/SWM.jpg",
  WS: "/images/subjects/WS.jpg",
};

/**
 * Common code aliases and synonyms resolving to the actual image asset
 */
const SUBJECT_CODE_ALIASES = {
  CHEM: "CHM",
  CHEMISTRY: "CHM",
  PA: "AP",
  PHYSICS: "AP",
  ENGLISH: "ENG",
  MATHS: "M1",
  "M-1": "M1",
  "M-2": "M2",
  "MATHS-1": "M1",
  "MATHS-2": "M2",
  "MATHS 1": "M1",
  "MATHS 2": "M2",
  "CD LABS": "LABS",
  "CD LAB": "LABS",
};

/**
 * Subject title-to-code mapping fallback in case short_name is absent or formatted as full name
 */
const TITLE_TO_CODE = {
  "APPLIED PHYSICS": "AP",
  "MATHEMATICS - I": "M1",
  "MATHEMATICS - II": "M2",
  "MATHS 1": "M1",
  "MATHS-2": "M2",
  "BASIC ELECTRICAL ENGINEERING": "BEE",
  "CHEMISTRY": "CHM",
  "ENGINEERING CHEMISTRY": "CHM",
  "ENGLISH": "ENG",
  "COMPUTER AIDED ENGINEERING GRAPHICS": "CAEG",
  "ELECTRONIC DEVICES AND CIRCUITS": "EDC",
  "PROGRAMMING FOR PROBLEM SOLVING": "PPS",
  "BUSINESS ECONOMICS AND FINANCIAL ANALYSIS": "BEFA",
  "COMPUTER ORGANIZATION AND ARCHITECTURE": "COA",
  "COMPUTER ORIENTED STATISTICAL METHODS": "COSM",
  "DATABASE MANAGEMENT SYSTEMS": "DBMS",
  "DIGITAL ELECTRONICS": "DE",
  "DISCRETE MATHEMATICS": "DM",
  "DATA STRUCTURES": "DS",
  "DISTRIBUTED SYSTEMS": "DS",
  "JAVA PROGRAMMING": "JAVA",
  "MANAGEMENT SCIENCE FUNDAMENTALS": "MSF",
  "OPERATING SYSTEMS": "OS",
  "SOFTWARE ENGINEERING": "SE",
  "LABORATORY": "LAB",
  "ARTIFICIAL INTELLIGENCE": "AI",
  "COMPUTER NETWORKS": "CN",
  "DATA ANALYTICS": "DA",
  "DESIGN AND ANALYSIS OF ALGORITHMS": "DAA",
  "DEVELOPMENT AND OPERATIONS": "DEVOPS",
  "DEVOPS ENGINEERING": "DEVOPS",
  "FUNDAMENTALS OF INTERNET OF THINGS": "FIOT",
  "FORMAL LANGUAGES AND AUTOMATA THEORY": "FLAT",
  "FULL STACK DEVELOPMENT": "FSD",
  "INTRUSION DETECTION SYSTEMS": "IDS",
  "INFORMATION RETRIEVAL SYSTEMS": "IRS",
  "MACHINE LEARNING": "ML",
  "NATURAL LANGUAGE PROCESSING": "NLP",
  "PRINCIPLES OF PROGRAMMING LANGUAGES": "PPL",
  "SOFTWARE TESTING METHODOLOGIES": "STM",
  "CLOUD COMPUTING": "CC",
  "COMPILER DESIGN": "CD",
  "CRYPTOGRAPHY AND NETWORK SECURITY": "CNS",
  "HUMAN-COMPUTER INTERACTION": "HCI",
  "INDUSTRIAL ENGINEERING AND MANAGEMENT": "IEM",
  "MOBILE COMPUTING": "MC",
  "NETWORK INTERFACE CARD": "NIC",
  "ORGANIZATIONAL BEHAVIOR": "OB",
  "ORGANIZATIONAL BEHAVIOUR": "OB",
  "SOFTWARE PROJECT AND PROCESS MANAGEMENT": "SPPM",
  "SOFTWARE PROCESS & PROJECT MANAGEMENT": "SPPM",
  "WEB SERVICES": "WS",
  "BLOCKCHAIN TECHNOLOGIES": "BCT",
  "SOLID WASTE MANAGEMENT": "SWM",
};

/**
 * Resolves the subject illustration image path for a given subject.
 *
 * @param {object|string} subject - Subject object or short code string
 * @returns {string|null} Resolved image path (e.g. `/images/subjects/AI.jpg`) or null if not found
 */
export function getSubjectIllustration(subject) {
  if (!subject) return null;

  let rawCode = "";
  let rawName = "";

  if (typeof subject === "string") {
    rawCode = subject.trim();
  } else if (typeof subject === "object") {
    rawCode = String(subject.short_name || subject.code || "").trim();
    rawName = String(subject.name || subject.title || "").trim();
  }

  const normalizedCode = rawCode.toUpperCase();

  // 1. Direct match on short code
  if (normalizedCode && SUBJECT_IMAGE_MAP[normalizedCode]) {
    return SUBJECT_IMAGE_MAP[normalizedCode];
  }

  // 2. Alias match (e.g. CHEM -> CHM, PA -> AP)
  if (normalizedCode && SUBJECT_CODE_ALIASES[normalizedCode]) {
    const aliased = SUBJECT_CODE_ALIASES[normalizedCode];
    if (SUBJECT_IMAGE_MAP[aliased]) {
      return SUBJECT_IMAGE_MAP[aliased];
    }
  }

  // 3. Fallback match by subject name if short code was missing or unmatched
  if (rawName) {
    const cleanTitle = rawName.toUpperCase().replace(/[.\-_,]/g, " ").replace(/\s+/g, " ").trim();
    if (TITLE_TO_CODE[cleanTitle]) {
      const codeFromTitle = TITLE_TO_CODE[cleanTitle];
      if (SUBJECT_IMAGE_MAP[codeFromTitle]) {
        return SUBJECT_IMAGE_MAP[codeFromTitle];
      }
    }
    // Partial check for titles like "Solid Waste Management."
    for (const [titleKey, codeVal] of Object.entries(TITLE_TO_CODE)) {
      if (cleanTitle.startsWith(titleKey) && SUBJECT_IMAGE_MAP[codeVal]) {
        return SUBJECT_IMAGE_MAP[codeVal];
      }
    }
  }

  return null;
}
