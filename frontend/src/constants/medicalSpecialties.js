/**
 * Medical specialities recognised by the National Medical Commission (NMC), India.
 *
 * Grouped as the NMC itself groups them:
 *   - Broad specialities      (MD / MS)
 *   - Medical super-specialities (DM)
 *   - Surgical super-specialities (MCh)
 *   - Non-clinical / diagnostic and allied disciplines
 *
 * The specialisation field accepts free text as well, so a doctor holding a
 * qualification that is not listed here can still type their own value.
 */

export const MEDICAL_SPECIALTY_GROUPS = [
  {
    group: 'Broad Specialities (MD / MS)',
    options: [
      'General Medicine',
      'General Surgery',
      'Obstetrics & Gynaecology',
      'Paediatrics',
      'Orthopaedics',
      'Ophthalmology',
      'Otorhinolaryngology (ENT)',
      'Dermatology, Venereology & Leprosy',
      'Psychiatry',
      'Anaesthesiology',
      'Respiratory Medicine (Pulmonology)',
      'Emergency Medicine',
      'Family Medicine',
      'Physical Medicine & Rehabilitation',
      'Geriatric Medicine',
      'Palliative Medicine',
      'Sports Medicine',
      'Tropical Medicine',
      'Radiation Oncology',
      'Nuclear Medicine',
      'Hospital Administration'
    ]
  },
  {
    group: 'Medical Super-Specialities (DM)',
    options: [
      'Cardiology',
      'Neurology',
      'Nephrology',
      'Gastroenterology',
      'Hepatology',
      'Endocrinology',
      'Medical Oncology',
      'Clinical Haematology',
      'Rheumatology',
      'Clinical Immunology',
      'Infectious Diseases',
      'Critical Care Medicine',
      'Neonatology',
      'Medical Genetics',
      'Clinical Pharmacology',
      'Cardiac Anaesthesia',
      'Neuro Anaesthesia',
      'Paediatric Cardiology',
      'Paediatric Nephrology',
      'Paediatric Neurology',
      'Paediatric Gastroenterology',
      'Paediatric Haemato-Oncology',
      'Child & Adolescent Psychiatry',
      'Addiction Psychiatry',
      'Geriatric Mental Health'
    ]
  },
  {
    group: 'Surgical Super-Specialities (MCh)',
    options: [
      'Cardiothoracic & Vascular Surgery',
      'Neurosurgery',
      'Urology',
      'Plastic & Reconstructive Surgery',
      'Paediatric Surgery',
      'Surgical Oncology',
      'Gastrointestinal Surgery',
      'Hepato-Pancreato-Biliary Surgery',
      'Vascular Surgery',
      'Endocrine Surgery',
      'Head & Neck Surgery',
      'Trauma Surgery',
      'Burns & Plastic Surgery',
      'Hand & Reconstructive Microsurgery',
      'Gynaecological Oncology',
      'Reproductive Medicine & Surgery',
      'Urogynaecology'
    ]
  },
  {
    group: 'Diagnostic, Laboratory & Non-Clinical',
    options: [
      'Radio-Diagnosis (Radiology)',
      'Interventional Radiology',
      'Neuroradiology',
      'Pathology',
      'Haematopathology',
      'Onco-Pathology',
      'Microbiology',
      'Virology',
      'Biochemistry',
      'Pharmacology',
      'Physiology',
      'Anatomy',
      'Transfusion Medicine / Immunohaematology',
      'Laboratory Medicine',
      'Community Medicine (Preventive & Social Medicine)',
      'Forensic Medicine & Toxicology'
    ]
  }
];

/** Flat list of every speciality, for validation or simple lookups. */
export const MEDICAL_SPECIALTIES = MEDICAL_SPECIALTY_GROUPS.flatMap(g => g.options);
