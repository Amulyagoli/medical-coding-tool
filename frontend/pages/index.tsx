import { useState } from 'react';

/*
 * In the original implementation the frontend made HTTP requests to a
 * separate FastAPI backend to retrieve ICD‑10 results, modifier
 * suggestions and NCCI pair checks. However, in the deployed
 * environment the API was not reachable, resulting in empty
 * responses. To make this demo self‑contained and functional
 * without relying on an external API, we define a handful of
 * in‑memory datasets that mirror the sample data used by the
 * backend and implement the search logic directly in the
 * frontend.  These structures and helper functions closely follow
 * the Python definitions in backend/main.py.
 */

// Sample ICD‑10‑CM codes.  In a full application this would be
// loaded from the CMS distribution.  Here we include a few
// representative entries for demonstration purposes.

const SAMPLE_ICD10_DATA: ICDResult[] = [
  { code: 'M25.561', title: 'Pain in right knee', includes: ['Right knee pain'], excludes: ['Pain in left knee (M25.562)'], synonyms: ['knee pain right', 'arthralgia right knee'] },
  { code: 'M25.562', title: 'Pain in left knee', includes: ['Left knee pain'], excludes: ['Pain in right knee (M25.561)'], synonyms: ['knee pain left', 'arthralgia left knee'] },
  { code: 'J10.1',  title: 'Influenza due to other identified influenza virus with other respiratory manifestations', includes: ['Influenza with pneumonia'], excludes: null, synonyms: ['flu with respiratory manifestations', 'influenza pneumonia'] },
  { code: 'M54.5',  title: 'Low back pain', includes: ['Lumbago'], excludes: null, synonyms: ['back pain', 'lower back pain'] },
  { code: 'R07.9',  title: 'Chest pain, unspecified', includes: ['Chest pain NOS'], excludes: null, synonyms: ['chest discomfort', 'unspecified chest pain'] },

  // A–B: Infectious
  { code: 'A09',    title: 'Infectious gastroenteritis and colitis, unspecified', includes: null, excludes: null, synonyms: ['infectious diarrhea', 'gastroenteritis'] },
  { code: 'A49.9',  title: 'Bacterial infection, unspecified', includes: null, excludes: null, synonyms: ['unspecified bacterial infection'] },
  { code: 'A41.9',  title: 'Sepsis, unspecified organism', includes: null, excludes: null, synonyms: ['sepsis NOS'] },
  { code: 'B34.9',  title: 'Viral infection, unspecified', includes: null, excludes: null, synonyms: ['viral illness NOS'] },
  { code: 'B37.3',  title: 'Candidiasis of vulva and vagina', includes: null, excludes: null, synonyms: ['vulvovaginal candidiasis', 'yeast infection'] },
  { code: 'B02.9',  title: 'Zoster without complications', includes: null, excludes: null, synonyms: ['shingles'] },
  { code: 'B00.1',  title: 'Herpesviral vesicular dermatitis', includes: null, excludes: null, synonyms: ['herpes simplex skin'] },

  // C–D: Neoplasms / Blood
  { code: 'C50.919', title: 'Malignant neoplasm of unspecified site of unspecified female breast', includes: null, excludes: null, synonyms: ['breast cancer NOS'] },
  { code: 'C34.90',  title: 'Malignant neoplasm of unspecified part of unspecified bronchus or lung', includes: null, excludes: null, synonyms: ['lung cancer NOS'] },
  { code: 'D50.9',   title: 'Iron deficiency anemia, unspecified', includes: null, excludes: null, synonyms: ['iron deficiency anemia NOS'] },
  { code: 'D64.9',   title: 'Anemia, unspecified', includes: null, excludes: null, synonyms: ['anemia NOS'] },
  { code: 'D12.6',   title: 'Benign neoplasm of colon, unspecified', includes: null, excludes: null, synonyms: ['colon polyp NOS'] },

  // E: Endocrine / Metabolic
  { code: 'E11.9',  title: 'Type 2 diabetes mellitus without complications', includes: null, excludes: null, synonyms: ['type 2 DM', 'T2DM'] },
  { code: 'E10.9',  title: 'Type 1 diabetes mellitus without complications', includes: null, excludes: null, synonyms: ['type 1 DM', 'T1DM'] },
  { code: 'E03.9',  title: 'Hypothyroidism, unspecified', includes: null, excludes: null, synonyms: ['low thyroid'] },
  { code: 'E05.90', title: 'Thyrotoxicosis, unspecified without thyrotoxic crisis or storm', includes: null, excludes: null, synonyms: ['hyperthyroidism NOS'] },
  { code: 'E78.5',  title: 'Hyperlipidemia, unspecified', includes: null, excludes: null, synonyms: ['dyslipidemia', 'high cholesterol'] },
  { code: 'E78.0',  title: 'Pure hypercholesterolemia', includes: null, excludes: null, synonyms: ['high LDL'] },
  { code: 'E78.1',  title: 'Pure hyperglyceridemia', includes: null, excludes: null, synonyms: ['hypertriglyceridemia'] },
  { code: 'E55.9',  title: 'Vitamin D deficiency, unspecified', includes: null, excludes: null, synonyms: ['vitamin D deficiency'] },
  { code: 'E66.9',  title: 'Obesity, unspecified', includes: null, excludes: null, synonyms: ['obesity NOS'] },
  { code: 'E86.0',  title: 'Dehydration', includes: null, excludes: null, synonyms: ['dehydration'] },
  { code: 'E87.1',  title: 'Hypo-osmolality and hyponatremia', includes: null, excludes: null, synonyms: ['hyponatremia'] },
  { code: 'E87.6',  title: 'Hypokalemia', includes: null, excludes: null, synonyms: ['low potassium'] },

  // F: Mental & behavioral
  { code: 'F32.9',  title: 'Major depressive disorder, single episode, unspecified', includes: null, excludes: null, synonyms: ['depression NOS'] },
  { code: 'F41.9',  title: 'Anxiety disorder, unspecified', includes: null, excludes: null, synonyms: ['anxiety NOS'] },
  { code: 'F17.210', title: 'Nicotine dependence, cigarettes, uncomplicated', includes: null, excludes: null, synonyms: ['tobacco dependence'] },

  // G: Neurology
  { code: 'G43.909', title: 'Migraine, unspecified, not intractable, without status migrainosus', includes: null, excludes: null, synonyms: ['migraine NOS'] },
  { code: 'G40.909', title: 'Epilepsy, unspecified, not intractable, without status epilepticus', includes: null, excludes: null, synonyms: ['seizure disorder NOS'] },
  { code: 'G47.00',  title: 'Insomnia, unspecified', includes: null, excludes: null, synonyms: ['insomnia NOS'] },
  { code: 'G62.9',   title: 'Polyneuropathy, unspecified', includes: null, excludes: null, synonyms: ['peripheral neuropathy NOS'] },
  { code: 'G89.29',  title: 'Other chronic pain', includes: null, excludes: null, synonyms: ['chronic pain NOS'] },

  // H: Eye & Ear
  { code: 'H10.9',  title: 'Unspecified conjunctivitis', includes: null, excludes: null, synonyms: ['pink eye NOS'] },
  { code: 'H52.4',  title: 'Presbyopia', includes: null, excludes: null, synonyms: ['age-related farsightedness'] },
  { code: 'H61.23', title: 'Impacted cerumen, bilateral', includes: null, excludes: null, synonyms: ['ear wax impaction both ears'] },
  { code: 'H66.9',  title: 'Otitis media, unspecified', includes: null, excludes: null, synonyms: ['middle ear infection NOS'] },

  // I: Circulatory
  { code: 'I10',    title: 'Essential (primary) hypertension', includes: null, excludes: null, synonyms: ['HTN', 'high blood pressure'] },
  { code: 'I25.10', title: 'Atherosclerotic heart disease of native coronary artery without angina pectoris', includes: null, excludes: null, synonyms: ['coronary artery disease NOS'] },
  { code: 'I20.9',  title: 'Angina pectoris, unspecified', includes: null, excludes: null, synonyms: ['angina NOS'] },
  { code: 'I48.91', title: 'Unspecified atrial fibrillation', includes: null, excludes: null, synonyms: ['AFib NOS'] },
  { code: 'I50.9',  title: 'Heart failure, unspecified', includes: null, excludes: null, synonyms: ['CHF NOS'] },
  { code: 'I63.9',  title: 'Cerebral infarction, unspecified', includes: null, excludes: null, synonyms: ['ischemic stroke NOS'] },
  { code: 'I65.29', title: 'Occlusion and stenosis of unspecified carotid artery', includes: null, excludes: null, synonyms: ['carotid stenosis NOS'] },
  { code: 'I83.90', title: 'Varicose veins of unspecified lower extremity without ulcer or inflammation', includes: null, excludes: null, synonyms: ['varicose veins NOS'] },

  // J: Respiratory
  { code: 'J06.9',  title: 'Acute upper respiratory infection, unspecified', includes: null, excludes: null, synonyms: ['URI', 'common cold'] },
  { code: 'J20.9',  title: 'Acute bronchitis, unspecified', includes: null, excludes: null, synonyms: ['acute bronchitis NOS'] },
  { code: 'J18.9',  title: 'Pneumonia, unspecified organism', includes: null, excludes: null, synonyms: ['pneumonia NOS'] },
  { code: 'J44.9',  title: 'Chronic obstructive pulmonary disease, unspecified', includes: null, excludes: null, synonyms: ['COPD NOS'] },
  { code: 'J45.909', title: 'Unspecified asthma, uncomplicated', includes: null, excludes: null, synonyms: ['asthma NOS'] },
  { code: 'J30.9',  title: 'Allergic rhinitis, unspecified', includes: null, excludes: null, synonyms: ['hay fever NOS'] },
  { code: 'J22',    title: 'Unspecified acute lower respiratory infection', includes: null, excludes: null, synonyms: ['acute LRI NOS'] },
  { code: 'J96.00', title: 'Acute respiratory failure, unspecified whether with hypoxia or hypercapnia', includes: null, excludes: null, synonyms: ['acute respiratory failure NOS'] },

  // K: Digestive
  { code: 'K21.9',  title: 'Gastro-esophageal reflux disease without esophagitis', includes: null, excludes: null, synonyms: ['GERD'] },
  { code: 'K29.70', title: 'Gastritis, unspecified, without bleeding', includes: null, excludes: null, synonyms: ['gastritis NOS'] },
  { code: 'K52.9',  title: 'Noninfective gastroenteritis and colitis, unspecified', includes: null, excludes: null, synonyms: ['gastroenteritis NOS'] },
  { code: 'K35.80', title: 'Unspecified acute appendicitis', includes: null, excludes: null, synonyms: ['appendicitis NOS'] },
  { code: 'K56.609',title: 'Unspecified intestinal obstruction, unspecified as to partial versus complete', includes: null, excludes: null, synonyms: ['ileus NOS'] },
  { code: 'K59.00',title: 'Constipation, unspecified', includes: null, excludes: null, synonyms: ['constipation NOS'] },
  { code: 'K60.2', title: 'Anal fissure, unspecified', includes: null, excludes: null, synonyms: ['anal fissure NOS'] },
  { code: 'K64.9', title: 'Hemorrhoids, unspecified', includes: null, excludes: null, synonyms: ['hemorrhoids NOS'] },
  { code: 'K80.20',title: 'Calculus of gallbladder without cholecystitis without obstruction', includes: null, excludes: null, synonyms: ['cholelithiasis'] },
  { code: 'K85.90',title: 'Acute pancreatitis without necrosis or infection, unspecified', includes: null, excludes: null, synonyms: ['acute pancreatitis NOS'] },
  { code: 'K76.0', title: 'Fatty (change of) liver, not elsewhere classified', includes: null, excludes: null, synonyms: ['fatty liver', 'hepatic steatosis'] },

  // L: Skin
  { code: 'L03.90', title: 'Cellulitis, unspecified', includes: null, excludes: null, synonyms: ['cellulitis NOS'] },
  { code: 'L02.91', title: 'Cutaneous abscess, unspecified', includes: null, excludes: null, synonyms: ['skin abscess NOS'] },
  { code: 'L40.0',  title: 'Psoriasis vulgaris', includes: null, excludes: null, synonyms: ['psoriasis'] },
  { code: 'L30.9',  title: 'Dermatitis, unspecified', includes: null, excludes: null, synonyms: ['eczema NOS'] },
  { code: 'L50.9',  title: 'Urticaria, unspecified', includes: null, excludes: null, synonyms: ['hives NOS'] },

  // M: Musculoskeletal
  { code: 'M25.50', title: 'Pain in unspecified joint', includes: null, excludes: null, synonyms: ['arthralgia NOS'] },
  { code: 'M25.511',title: 'Pain in right shoulder', includes: null, excludes: null, synonyms: ['shoulder pain right'] },
  { code: 'M25.512',title: 'Pain in left shoulder', includes: null, excludes: null, synonyms: ['shoulder pain left'] },
  { code: 'M25.551',title: 'Pain in right hip', includes: null, excludes: null, synonyms: ['hip pain right'] },
  { code: 'M25.552',title: 'Pain in left hip', includes: null, excludes: null, synonyms: ['hip pain left'] },
  { code: 'M25.571',title: 'Pain in right ankle and joints of right foot', includes: null, excludes: null, synonyms: ['right ankle pain'] },
  { code: 'M25.572',title: 'Pain in left ankle and joints of left foot', includes: null, excludes: null, synonyms: ['left ankle pain'] },
  { code: 'M79.1',  title: 'Myalgia', includes: null, excludes: null, synonyms: ['muscle pain'] },
  { code: 'M79.7',  title: 'Fibromyalgia', includes: null, excludes: null, synonyms: ['fibromyalgia syndrome'] },
  { code: 'M17.9',  title: 'Osteoarthritis of knee, unspecified', includes: null, excludes: null, synonyms: ['knee OA NOS'] },
  { code: 'M16.9',  title: 'Osteoarthritis of hip, unspecified', includes: null, excludes: null, synonyms: ['hip OA NOS'] },
  { code: 'M75.100',title: 'Unspecified rotator cuff tear or rupture of unspecified shoulder, not specified as traumatic', includes: null, excludes: null, synonyms: ['rotator cuff tear NOS'] },
  { code: 'M54.2',  title: 'Cervicalgia', includes: null, excludes: null, synonyms: ['neck pain'] },
  { code: 'M54.16', title: 'Radiculopathy, lumbar region', includes: null, excludes: null, synonyms: ['lumbar radiculopathy', 'sciatica NOS'] },
  { code: 'M81.0',  title: 'Age-related osteoporosis without current pathological fracture', includes: null, excludes: null, synonyms: ['osteoporosis NOS'] },

  // N: Genitourinary
  { code: 'N39.0',  title: 'Urinary tract infection, site not specified', includes: null, excludes: null, synonyms: ['UTI NOS'] },
  { code: 'N30.00', title: 'Acute cystitis without hematuria', includes: null, excludes: null, synonyms: ['acute cystitis'] },
  { code: 'N20.0',  title: 'Calculus of kidney', includes: null, excludes: null, synonyms: ['renal stone', 'nephrolithiasis'] },
  { code: 'N13.30', title: 'Unspecified hydronephrosis', includes: null, excludes: null, synonyms: ['hydronephrosis NOS'] },
  { code: 'N40.0',  title: 'Enlarged prostate without lower urinary tract symptoms', includes: null, excludes: null, synonyms: ['BPH NOS'] },
  { code: 'N18.30', title: 'Chronic kidney disease, stage 3 unspecified', includes: null, excludes: null, synonyms: ['CKD stage 3 NOS'] },
  { code: 'N76.0',  title: 'Acute vaginitis', includes: null, excludes: null, synonyms: ['vaginitis'] },
  { code: 'N92.6',  title: 'Irregular menstruation, unspecified', includes: null, excludes: null, synonyms: ['irregular menses NOS'] },
  { code: 'N80.9',  title: 'Endometriosis, unspecified', includes: null, excludes: null, synonyms: ['endometriosis NOS'] },

  // O–P (limited general non-obstetric screening/contraception – keep simple)
  { code: 'O26.899', title: 'Other specified pregnancy related conditions, unspecified trimester', includes: null, excludes: null, synonyms: ['pregnancy related condition NOS'] },
  { code: 'Z30.09',  title: 'Encounter for other general counseling and advice on contraception', includes: null, excludes: null, synonyms: ['contraceptive counseling'] },

  // R: Symptoms & signs
  { code: 'R10.9',  title: 'Unspecified abdominal pain', includes: null, excludes: null, synonyms: ['abdominal pain NOS'] },
  { code: 'R11.2',  title: 'Nausea with vomiting, unspecified', includes: null, excludes: null, synonyms: ['nausea and vomiting NOS'] },
  { code: 'R05.9',  title: 'Cough, unspecified', includes: null, excludes: null, synonyms: ['cough NOS'] },
  { code: 'R06.02', title: 'Shortness of breath', includes: null, excludes: null, synonyms: ['dyspnea'] },
  { code: 'R50.9',  title: 'Fever, unspecified', includes: null, excludes: null, synonyms: ['pyrexia NOS'] },
  { code: 'R19.7',  title: 'Diarrhea, unspecified', includes: null, excludes: null, synonyms: ['diarrhea NOS'] },
  { code: 'R42',    title: 'Dizziness and giddiness', includes: null, excludes: null, synonyms: ['vertigo NOS', 'dizziness'] },
  { code: 'R51.9',  title: 'Headache, unspecified', includes: null, excludes: null, synonyms: ['headache NOS'] },
  { code: 'R21',    title: 'Rash and other nonspecific skin eruption', includes: null, excludes: null, synonyms: ['skin rash NOS'] },
  { code: 'R32',    title: 'Unspecified urinary incontinence', includes: null, excludes: null, synonyms: ['incontinence NOS'] },
  { code: 'R63.5',  title: 'Abnormal weight gain', includes: null, excludes: null, synonyms: ['weight gain'] },
  { code: 'R63.4',  title: 'Abnormal weight loss', includes: null, excludes: null, synonyms: ['weight loss'] },

  // S–T: Injury / Poisoning
  { code: 'S93.401A', title: 'Sprain of unspecified ligament of right ankle, initial encounter', includes: null, excludes: null, synonyms: ['right ankle sprain NOS'] },
  { code: 'S93.402A', title: 'Sprain of unspecified ligament of left ankle, initial encounter', includes: null, excludes: null, synonyms: ['left ankle sprain NOS'] },
  { code: 'S16.1XXA', title: 'Strain of muscle, fascia and tendon at neck level, initial encounter', includes: null, excludes: null, synonyms: ['neck strain'] },
  { code: 'S39.012A', title: 'Strain of muscle, fascia and tendon of lower back, initial encounter', includes: null, excludes: null, synonyms: ['lumbar strain'] },
  { code: 'S52.501A', title: 'Unspecified fracture of the lower end of right radius, initial encounter for closed fracture', includes: null, excludes: null, synonyms: ['distal radius fracture right'] },
  { code: 'T78.40XA', title: 'Allergy, unspecified, initial encounter', includes: null, excludes: null, synonyms: ['allergic reaction NOS'] },
  { code: 'T78.2XXA', title: 'Anaphylactic shock, unspecified, initial encounter', includes: null, excludes: null, synonyms: ['anaphylaxis NOS'] },

  // Z: Factors influencing health status
  { code: 'Z00.00', title: 'Encounter for general adult medical examination without abnormal findings', includes: null, excludes: null, synonyms: ['annual physical'] },
  { code: 'Z00.01', title: 'Encounter for general adult medical examination with abnormal findings', includes: null, excludes: null, synonyms: ['physical with abnormal findings'] },
  { code: 'Z01.419', title: 'Encounter for gynecological examination (general) (routine) without abnormal findings', includes: null, excludes: null, synonyms: ['routine GYN exam'] },
  { code: 'Z11.3',  title: 'Encounter for screening for infections with a predominantly sexual mode of transmission', includes: null, excludes: null, synonyms: ['STD screening'] },
  { code: 'Z11.59', title: 'Encounter for screening for other viral diseases', includes: null, excludes: null, synonyms: ['viral screening'] },
  { code: 'Z12.11', title: 'Encounter for screening for malignant neoplasm of colon', includes: null, excludes: null, synonyms: ['colon cancer screening'] },
  { code: 'Z12.31', title: 'Encounter for screening mammogram for malignant neoplasm of breast', includes: null, excludes: null, synonyms: ['screening mammography'] },
  { code: 'Z12.4',  title: 'Encounter for screening for malignant neoplasm of cervix', includes: null, excludes: null, synonyms: ['cervical cancer screening'] },
  { code: 'Z13.1',  title: 'Encounter for screening for diabetes mellitus', includes: null, excludes: null, synonyms: ['diabetes screening'] },
  { code: 'Z13.22', title: 'Encounter for screening for metabolic disorder', includes: null, excludes: null, synonyms: ['lipid screening'] },
  { code: 'Z20.822',title: 'Contact with and (suspected) exposure to COVID-19', includes: null, excludes: null, synonyms: ['COVID exposure'] },
  { code: 'Z23',    title: 'Encounter for immunization', includes: null, excludes: null, synonyms: ['vaccination'] },
  { code: 'Z32.01', title: 'Encounter for pregnancy test, result positive', includes: null, excludes: null, synonyms: ['positive pregnancy test'] },
  { code: 'Z32.02', title: 'Encounter for pregnancy test, result negative', includes: null, excludes: null, synonyms: ['negative pregnancy test'] },
  { code: 'Z34.90', title: 'Encounter for supervision of normal pregnancy, unspecified, unspecified trimester', includes: null, excludes: null, synonyms: ['prenatal care NOS'] },
  { code: 'Z68.30', title: 'Body mass index (BMI) 30.0-30.9, adult', includes: null, excludes: null, synonyms: ['BMI 30-30.9'] },
  { code: 'Z68.31', title: 'Body mass index (BMI) 31.0-31.9, adult', includes: null, excludes: null, synonyms: ['BMI 31-31.9'] },
  { code: 'Z68.32', title: 'Body mass index (BMI) 32.0-32.9, adult', includes: null, excludes: null, synonyms: ['BMI 32-32.9'] },
  { code: 'Z68.33', title: 'Body mass index (BMI) 33.0-33.9, adult', includes: null, excludes: null, synonyms: ['BMI 33-33.9'] },
  { code: 'Z68.34', title: 'Body mass index (BMI) 34.0-34.9, adult', includes: null, excludes: null, synonyms: ['BMI 34-34.9'] },
  { code: 'Z68.35', title: 'Body mass index (BMI) 35.0-35.9, adult', includes: null, excludes: null, synonyms: ['BMI 35-35.9'] },
  { code: 'Z68.36', title: 'Body mass index (BMI) 36.0-36.9, adult', includes: null, excludes: null, synonyms: ['BMI 36-36.9'] },
  { code: 'Z68.37', title: 'Body mass index (BMI) 37.0-37.9, adult', includes: null, excludes: null, synonyms: ['BMI 37-37.9'] },
  { code: 'Z68.38', title: 'Body mass index (BMI) 38.0-38.9, adult', includes: null, excludes: null, synonyms: ['BMI 38-38.9'] },
  { code: 'Z68.39', title: 'Body mass index (BMI) 39.0-39.9, adult', includes: null, excludes: null, synonyms: ['BMI 39-39.9'] },
  { code: 'Z79.01', title: 'Long term (current) use of anticoagulants', includes: null, excludes: null, synonyms: ['chronic anticoagulation'] },
  { code: 'Z79.4',  title: 'Long term (current) use of insulin', includes: null, excludes: null, synonyms: ['insulin long-term use'] },
  { code: 'Z79.84', title: 'Long term (current) use of oral hypoglycemic drugs', includes: null, excludes: null, synonyms: ['long-term oral diabetes meds'] },
  { code: 'Z79.899',title: 'Other long term (current) drug therapy', includes: null, excludes: null, synonyms: ['long-term medication use'] },
  { code: 'Z87.891',title: 'Personal history of nicotine dependence', includes: null, excludes: null, synonyms: ['former smoker'] },
  { code: 'Z91.19', title: 'Patient’s noncompliance with other medical treatment and regimen', includes: null, excludes: null, synonyms: ['nonadherence NOS'] },
  { code: 'Z91.81', title: 'History of falling', includes: null, excludes: null, synonyms: ['falls history'] },
  { code: 'Z99.89', title: 'Dependence on other enabling machines and devices', includes: null, excludes: null, synonyms: ['device dependence NOS'] },

  // Extra common outpatient codes to reach 105+
  { code: 'H81.10', title: 'Benign paroxysmal vertigo, unspecified ear', includes: null, excludes: null, synonyms: ['BPPV NOS'] },
  { code: 'J01.90', title: 'Acute sinusitis, unspecified', includes: null, excludes: null, synonyms: ['acute sinusitis NOS'] },
  { code: 'K12.0',  title: 'Recurrent oral aphthae', includes: null, excludes: null, synonyms: ['aphthous ulcer', 'canker sores'] },
  { code: 'L29.9',  title: 'Pruritus, unspecified', includes: null, excludes: null, synonyms: ['itching NOS'] },
  { code: 'M62.830',title: 'Muscle spasm of back', includes: null, excludes: null, synonyms: ['back spasm'] },
  { code: 'N76.4',  title: 'Abscess of vulva', includes: null, excludes: null, synonyms: ['bartholinitis NOS'] },
  { code: 'R09.81', title: 'Nasal congestion', includes: null, excludes: null, synonyms: ['stuffy nose'] },
  { code: 'R53.83', title: 'Other fatigue', includes: null, excludes: null, synonyms: ['fatigue'] },
  { code: 'R68.89', title: 'Other general symptoms and signs', includes: null, excludes: null, synonyms: ['general symptoms NOS'] }
];



// Sample modifier definitions.  A real system would include the full
// CPT/HCPCS modifier catalogue.  Each entry includes the code,
// description and a brief rationale.
const MODIFIER_TABLE: ModifierResult[] = [
  {
    code: '25',
    title:
      'Significant, separately identifiable evaluation and management service on the same day of the procedure',
    reason:
      'Use when a separately documented E/M service is performed on the same day as another procedure.',
  },
  {
    code: '59',
    title: 'Distinct procedural service',
    reason:
      'Indicates a procedure or service was distinct or independent from other services performed on the same day.',
  },
  {
    code: '50',
    title: 'Bilateral procedure',
    reason:
      'Used when the same procedure is performed on both sides of the body during the same session.',
  },
  {
    code: 'LT',
    title: 'Left side',
    reason: 'Procedures performed on the left side of the body.',
  },
  {
    code: 'RT',
    title: 'Right side',
    reason: 'Procedures performed on the right side of the body.',
  },
  {
    code: '76',
    title: 'Repeat procedure or service by same physician',
    reason: 'Indicates a repeat procedure by the same physician.',
  },
  {
    code: '77',
    title: 'Repeat procedure by another physician',
    reason: 'Indicates a repeat procedure by a different physician.',
  },
  {
    code: '26',
    title: 'Professional component',
    reason:
      'Used when only the professional component of a service is being billed (e.g., interpretation of radiologic studies).',
  },
  {
    code: 'TC',
    title: 'Technical component',
    reason:
      'Used when only the technical component of a service is being billed (e.g., use of equipment).',
  },
];

// Sample NCCI pair edits.  The keys of the outer object are CPT codes.
// Each inner object maps a second CPT code to a record describing the
// bundling status, explanatory message and whether a modifier is
// required to unbundle the codes.
interface NcciPairRecord {
  status: string;
  message: string;
  modifier_required: boolean;
}

const NCCI_PAIRS: { [codeA: string]: { [codeB: string]: NcciPairRecord } } = {
  '11719': {
    '11720': {
      status: 'denied',
      message:
        'CPT 11719 is bundled into 11720; they should not be billed together without appropriate modifier.',
      modifier_required: true,
    },
  },
  '17000': {
    '17110': {
      status: 'allowed',
      message:
        'CPT 17000 and 17110 may be reported together with modifier 59 if lesions are separate/distinct sites.',
      modifier_required: true,
    },
  },
  '71045': {
    '71046': {
      status: 'allowed',
      message: 'Two different chest X‑ray views are generally allowed together.',
      modifier_required: false,
    },
  },
};

interface ICDResult {
  code: string;
  title: string;
  includes?: string[] | null;
  excludes?: string[] | null;
  synonyms?: string[] | null;
}

interface ModifierResult {
  code: string;
  title: string;
  reason: string;
}

interface NCCIResult {
  cpt_a: string;
  cpt_b: string;
  status: string;
  message: string;
  modifier_required: boolean;
}

export default function Home() {
  // This demo does not call an external API.  Instead all data lives
  // locally in memory (see SAMPLE_ICD10_DATA, MODIFIER_TABLE and
  // NCCI_PAIRS above), so there is no API base URL.

  // ICD search state
  const [icdQuery, setIcdQuery] = useState('');
  const [icdResults, setIcdResults] = useState<ICDResult[]>([]);
  const [icdLoading, setIcdLoading] = useState(false);

  // Modifier search state
  const [modQuery, setModQuery] = useState('');
  const [modResults, setModResults] = useState<ModifierResult[]>([]);
  const [modLoading, setModLoading] = useState(false);

  // NCCI check state
  const [codeA, setCodeA] = useState('');
  const [codeB, setCodeB] = useState('');
  const [ncciResult, setNcciResult] = useState<NCCIResult | null>(null);
  const [ncciLoading, setNcciLoading] = useState(false);

  // Perform ICD search using the local SAMPLE_ICD10_DATA.  The
  // search algorithm is similar to the backend: it assigns scores
  // based on substring matches in the code, title, includes/excludes
  // and synonyms.  The top 5 results (by score) are returned.
  const handleIcdSearch = () => {
    if (!icdQuery.trim()) {
      setIcdResults([]);
      return;
    }
    setIcdLoading(true);
    const q = icdQuery.trim().toLowerCase();
    const scored: { entry: ICDResult; score: number }[] = [];
    SAMPLE_ICD10_DATA.forEach((entry) => {
      let score = 0;
      if (entry.code.toLowerCase().includes(q)) {
        score += 2;
      }
      if (entry.title.toLowerCase().includes(q)) {
        score += 1.5;
      }
      (entry.includes ?? []).forEach((sec) => {
        if (sec.toLowerCase().includes(q)) {
          score += 1;
        }
      });
      (entry.excludes ?? []).forEach((sec) => {
        if (sec.toLowerCase().includes(q)) {
          score += 0.5;
        }
      });
      (entry.synonyms ?? []).forEach((sec) => {
        if (sec.toLowerCase().includes(q)) {
          score += 1;
        }
      });
      if (score > 0) {
        scored.push({ entry, score });
      }
    });
    scored.sort((a, b) => b.score - a.score);
    setIcdResults(scored.slice(0, 5).map((item) => item.entry));
    setIcdLoading(false);
  };

  // Perform modifier search using local keyword logic.  Based on
  // keywords in the query, this function returns appropriate
  // modifiers from the MODIFIER_TABLE.  Duplicate codes are removed.
  const handleModifierSearch = () => {
    if (!modQuery.trim()) {
      setModResults([]);
      return;
    }
    setModLoading(true);
    const q = modQuery.toLowerCase();
    const suggestions: ModifierResult[] = [];
    // Bilateral procedures
    if (['bilateral', 'both sides', 'both limbs'].some((word) => q.includes(word))) {
      const mod = MODIFIER_TABLE.find((m) => m.code === '50');
      if (mod) suggestions.push(mod);
    }
    // Left or right
    if (q.includes('left') || q.includes(' lt ')) {
      const mod = MODIFIER_TABLE.find((m) => m.code === 'LT');
      if (mod) suggestions.push(mod);
    }
    if (q.includes('right') || q.includes(' rt ')) {
      const mod = MODIFIER_TABLE.find((m) => m.code === 'RT');
      if (mod) suggestions.push(mod);
    }
    // Repeat
    if (q.includes('repeat') || q.includes('again')) {
      const mod = MODIFIER_TABLE.find((m) => m.code === '76');
      if (mod) suggestions.push(mod);
    }
    // Distinct or separate
    if (['distinct', 'different site', 'separate session'].some((word) => q.includes(word))) {
      const mod = MODIFIER_TABLE.find((m) => m.code === '59');
      if (mod) suggestions.push(mod);
    }
    // E/M separate from procedure
    if (q.includes('evaluation') || q.includes('e/m')) {
      const mod = MODIFIER_TABLE.find((m) => m.code === '25');
      if (mod) suggestions.push(mod);
    }
    // Professional component
    if (q.includes('interpretation') || q.includes('professional')) {
      const mod = MODIFIER_TABLE.find((m) => m.code === '26');
      if (mod) suggestions.push(mod);
    }
    // Technical component
    if (q.includes('equipment') || q.includes('technical')) {
      const mod = MODIFIER_TABLE.find((m) => m.code === 'TC');
      if (mod) suggestions.push(mod);
    }
    // Remove duplicates by code while preserving order
    const unique: ModifierResult[] = [];
    const seen = new Set<string>();
    for (const mod of suggestions) {
      if (!seen.has(mod.code)) {
        seen.add(mod.code);
        unique.push(mod);
      }
    }
    setModResults(unique);
    setModLoading(false);
  };

  // Perform NCCI check using the local sample table.  The codes are
  // treated as an unordered pair; if a matching record exists it is
  // returned, otherwise the pair is assumed allowed.  This mirrors
  // the behaviour of the backend sample.
  const handleNcciCheck = () => {
    if (!codeA.trim() || !codeB.trim()) {
      setNcciResult(null);
      return;
    }
    setNcciLoading(true);
    const a = codeA.trim();
    const b = codeB.trim();
    let result: NCCIResult;
    if (NCCI_PAIRS[a] && NCCI_PAIRS[a][b]) {
      const rec = NCCI_PAIRS[a][b];
      result = {
        cpt_a: a,
        cpt_b: b,
        status: rec.status,
        message: rec.message,
        modifier_required: rec.modifier_required,
      };
    } else if (NCCI_PAIRS[b] && NCCI_PAIRS[b][a]) {
      const rec = NCCI_PAIRS[b][a];
      result = {
        cpt_a: a,
        cpt_b: b,
        status: rec.status,
        message: rec.message,
        modifier_required: rec.modifier_required,
      };
    } else {
      result = {
        cpt_a: a,
        cpt_b: b,
        status: 'allowed',
        message: 'No known NCCI bundling issues between these CPT codes.',
        modifier_required: false,
      };
    }
    setNcciResult(result);
    setNcciLoading(false);
  };

  return (
    <main className="p-6 mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold mb-4">Amulya Goli's Personal Medical Coding Tool</h1>
      {/* ICD Search */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">ICD‑10‑CM Search</h2>
        <div className="flex space-x-2 mb-2">
          <input
            type="text"
            value={icdQuery}
            onChange={(e) => setIcdQuery(e.target.value)}
            placeholder="Enter a diagnosis description"
            className="flex-1 p-2 border border-gray-300 rounded"
          />
          <button
            onClick={handleIcdSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Search
          </button>
        </div>
        {icdLoading && <p className="text-gray-500">Searching…</p>}
        <ul className="space-y-2">
          {icdResults.map((item) => (
            <li key={item.code} className="p-3 border rounded bg-white shadow-sm">
              <p className="font-medium">
                {item.code} – {item.title}
              </p>
              {item.includes && (
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Includes: </span>
                  {item.includes.join(', ')}
                </p>
              )}
              {item.excludes && (
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Excludes: </span>
                  {item.excludes.join(', ')}
                </p>
              )}
              {item.synonyms && (
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Synonyms: </span>
                  {item.synonyms.join(', ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Modifier suggestions */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Modifier Suggestions</h2>
        <div className="flex space-x-2 mb-2">
          <input
            type="text"
            value={modQuery}
            onChange={(e) => setModQuery(e.target.value)}
            placeholder="Describe the scenario (e.g. bilateral knee surgery)"
            className="flex-1 p-2 border border-gray-300 rounded"
          />
          <button
            onClick={handleModifierSearch}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Suggest
          </button>
        </div>
        {modLoading && <p className="text-gray-500">Processing…</p>}
        <ul className="space-y-2">
          {modResults.map((mod) => (
            <li key={mod.code} className="p-3 border rounded bg-white shadow-sm">
              <p className="font-medium">
                {mod.code} – {mod.title}
              </p>
              <p className="text-sm text-gray-600">{mod.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* NCCI check */}
      <section>
        <h2 className="text-xl font-semibold mb-2">NCCI Pair Check</h2>
        <div className="flex space-x-2 mb-2">
          <input
            type="text"
            value={codeA}
            onChange={(e) => setCodeA(e.target.value)}
            placeholder="CPT code A"
            className="flex-1 p-2 border border-gray-300 rounded"
          />
          <input
            type="text"
            value={codeB}
            onChange={(e) => setCodeB(e.target.value)}
            placeholder="CPT code B"
            className="flex-1 p-2 border border-gray-300 rounded"
          />
          <button
            onClick={handleNcciCheck}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Check
          </button>
        </div>
        {ncciLoading && <p className="text-gray-500">Checking…</p>}
        {ncciResult && (
          <div className="p-3 border rounded bg-white shadow-sm">
            <p className="font-medium">
              {ncciResult.cpt_a} + {ncciResult.cpt_b}
            </p>
            <p className="text-sm mb-1">
              Status: <span className="font-semibold">{ncciResult.status}</span>
            </p>
            <p className="text-sm">{ncciResult.message}</p>
            {ncciResult.modifier_required && (
              <p className="text-sm text-red-600 font-semibold mt-1">
                A modifier is required to unbundle these codes.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
