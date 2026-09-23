/** Common planned surgeries, with typical cost ranges in a tier-1 city (tier-2 cities are ~15% lower). */

export type SurgerySeed = {
  slug: string;
  name: string;
  category: string;
  specialty: string;
  icon: string;
  popular?: boolean;
  description: string;
  treats: string[];
  techniques: string[];
  durationMinutes: [number, number];
  stay: string;
  recovery: string;
  anaesthesia: string;
  cost: [number, number];
  insurance: boolean;
  steps: string[];
  benefits: string[];
  risks: string[];
  /** Facility departments that perform it. */
  departments: string[];
};

export const SURGERY_CATEGORIES = ['General & Laparoscopic', 'Proctology', 'Eye', 'Orthopaedics', 'Urology', 'Gynaecology', 'ENT', 'Cosmetic & Plastic', 'Heart', 'Weight Loss', 'Dental'];

export const SURGERIES: SurgerySeed[] = [
  {
    slug: 'laser-piles-surgery', name: 'Laser Piles Surgery', category: 'Proctology', specialty: 'general-surgeon', icon: 'healing', popular: true,
    description: 'A minimally invasive laser procedure that shrinks piles from inside, with little pain and same-day discharge.',
    treats: ['Grade 2–4 piles (haemorrhoids)', 'Bleeding piles', 'Prolapsed piles'], techniques: ['Laser haemorrhoidoplasty (LHP)', 'Stapler haemorrhoidopexy', 'Open haemorrhoidectomy'],
    durationMinutes: [20, 40], stay: 'Day care', recovery: '2–3 days to routine work', anaesthesia: 'Spinal or short general anaesthesia', cost: [35000, 75000], insurance: true,
    steps: ['Consultation and proctoscopy to grade the piles', 'Pre-operative blood tests and fitness check', 'Laser energy delivered to the pile mass under anaesthesia', 'Discharge the same day with a sitz-bath and diet plan'],
    benefits: ['Minimal pain and bleeding', 'No cuts or stitches', 'Back to work in 2–3 days'], risks: ['Temporary discomfort passing stool', 'Mild swelling', 'Rare recurrence'],
    departments: ['General Surgery', 'Proctology'],
  },
  {
    slug: 'fissure-surgery', name: 'Laser Fissure Surgery', category: 'Proctology', specialty: 'general-surgeon', icon: 'healing',
    description: 'Laser treatment for chronic anal fissures that do not heal with medicines, relieving spasm and pain.',
    treats: ['Chronic anal fissure', 'Painful bowel movements', 'Fissure with sentinel pile'], techniques: ['Laser sphincterotomy', 'Lateral internal sphincterotomy', 'Botox injection'],
    durationMinutes: [15, 30], stay: 'Day care', recovery: '2–4 days', anaesthesia: 'Spinal or local anaesthesia', cost: [30000, 60000], insurance: true,
    steps: ['Examination to confirm a chronic fissure', 'Blood tests and anaesthesia check', 'Laser release of the tight sphincter muscle', 'Same-day discharge with stool softeners'],
    benefits: ['Rapid pain relief', 'High healing rate', 'Quick return to routine'], risks: ['Temporary incontinence to gas (rare)', 'Mild bleeding', 'Recurrence if constipation continues'],
    departments: ['General Surgery', 'Proctology'],
  },
  {
    slug: 'fistula-surgery', name: 'Fistula Surgery', category: 'Proctology', specialty: 'general-surgeon', icon: 'healing',
    description: 'Surgery for anal fistula using laser (FiLaC) or VAAFT to close the tract while protecting continence.',
    treats: ['Anal fistula', 'Recurrent perianal abscess', 'Discharge near the anus'], techniques: ['FiLaC (laser)', 'VAAFT', 'Fistulotomy', 'Seton placement'],
    durationMinutes: [30, 60], stay: 'Day care to 1 day', recovery: '1–2 weeks', anaesthesia: 'Spinal anaesthesia', cost: [40000, 90000], insurance: true,
    steps: ['MRI fistulogram to map the tract', 'Pre-operative tests', 'Tract closed with laser or video-assisted technique', 'Dressing and follow-up until healed'],
    benefits: ['Sphincter-sparing options', 'Less pain than open surgery', 'Lower recurrence with modern techniques'], risks: ['Recurrence', 'Delayed wound healing', 'Rare continence issues'],
    departments: ['General Surgery', 'Proctology'],
  },
  {
    slug: 'hernia-surgery', name: 'Laparoscopic Hernia Surgery', category: 'General & Laparoscopic', specialty: 'general-surgeon', icon: 'surgical', popular: true,
    description: 'Keyhole repair of inguinal, umbilical or incisional hernia with a mesh, for a strong repair and quick recovery.',
    treats: ['Inguinal (groin) hernia', 'Umbilical hernia', 'Incisional hernia'], techniques: ['TEP / TAPP laparoscopic repair', 'Open mesh repair', 'Robotic repair'],
    durationMinutes: [45, 90], stay: '1 day', recovery: '1–2 weeks', anaesthesia: 'General anaesthesia', cost: [55000, 120000], insurance: true,
    steps: ['Examination and ultrasound', 'Fitness tests', 'Mesh placed through small keyhole cuts', 'Discharge next day with activity guidance'],
    benefits: ['Small scars', 'Less pain', 'Low recurrence with mesh'], risks: ['Seroma (fluid collection)', 'Infection (rare)', 'Recurrence (rare)'],
    departments: ['General Surgery'],
  },
  {
    slug: 'gallbladder-removal', name: 'Gallbladder Removal (Lap Cholecystectomy)', category: 'General & Laparoscopic', specialty: 'general-surgeon', icon: 'surgical', popular: true,
    description: 'Keyhole removal of the gallbladder for painful gallstones, the standard cure for recurring gallstone pain.',
    treats: ['Symptomatic gallstones', 'Cholecystitis', 'Gallbladder polyps'], techniques: ['Laparoscopic cholecystectomy', 'Single-incision laparoscopy', 'Open cholecystectomy'],
    durationMinutes: [45, 90], stay: '1 day', recovery: '1–2 weeks', anaesthesia: 'General anaesthesia', cost: [55000, 110000], insurance: true,
    steps: ['Ultrasound and liver tests', 'Fitness check', 'Gallbladder removed through 3–4 keyhole cuts', 'Discharge next day with a low-fat diet plan'],
    benefits: ['Ends recurrent pain', 'Prevents complications like pancreatitis', 'Quick recovery'], risks: ['Bile leak (rare)', 'Loose stools for a few weeks', 'Infection (rare)'],
    departments: ['General Surgery', 'Gastroenterology'],
  },
  {
    slug: 'appendix-surgery', name: 'Appendix Surgery (Appendectomy)', category: 'General & Laparoscopic', specialty: 'general-surgeon', icon: 'surgical',
    description: 'Laparoscopic removal of an inflamed appendix, usually done as an urgent procedure.',
    treats: ['Acute appendicitis', 'Recurrent appendicitis', 'Appendicular mass'], techniques: ['Laparoscopic appendectomy', 'Open appendectomy'],
    durationMinutes: [40, 75], stay: '1–2 days', recovery: '1–2 weeks', anaesthesia: 'General anaesthesia', cost: [50000, 100000], insurance: true,
    steps: ['Clinical exam and ultrasound or CT', 'Blood tests', 'Appendix removed through keyhole cuts', 'Discharge in 1–2 days'],
    benefits: ['Prevents rupture', 'Small scars', 'Quick recovery'], risks: ['Wound infection', 'Abscess (rare)', 'Ileus (rare)'],
    departments: ['General Surgery'],
  },
  {
    slug: 'lipoma-removal', name: 'Lipoma Removal', category: 'General & Laparoscopic', specialty: 'general-surgeon', icon: 'surgical',
    description: 'Minor surgery to remove a fatty lump under the skin, done under local anaesthesia.',
    treats: ['Lipoma', 'Sebaceous cyst', 'Other benign skin lumps'], techniques: ['Excision', 'Minimal-scar excision', 'Liposuction-assisted removal'],
    durationMinutes: [20, 45], stay: 'Day care', recovery: '3–5 days', anaesthesia: 'Local anaesthesia', cost: [15000, 40000], insurance: false,
    steps: ['Examination and ultrasound if needed', 'Local anaesthesia', 'Lump removed and sent for testing', 'Stitch removal in 7–10 days'],
    benefits: ['Quick procedure', 'Same-day discharge', 'Confirms the lump is benign'], risks: ['Small scar', 'Infection (rare)', 'Recurrence (rare)'],
    departments: ['General Surgery'],
  },
  {
    slug: 'varicose-veins-surgery', name: 'Laser Varicose Veins Treatment', category: 'General & Laparoscopic', specialty: 'general-surgeon', icon: 'surgical',
    description: 'Endovenous laser treatment (EVLT) closes faulty leg veins through a needle puncture, without open surgery.',
    treats: ['Varicose veins', 'Leg heaviness and swelling', 'Venous ulcers'], techniques: ['EVLT (laser)', 'Radiofrequency ablation', 'Sclerotherapy', 'Venaseal glue'],
    durationMinutes: [45, 90], stay: 'Day care', recovery: '2–3 days', anaesthesia: 'Local or spinal anaesthesia', cost: [50000, 110000], insurance: true,
    steps: ['Venous Doppler scan', 'Pre-procedure tests', 'Laser fibre placed in the vein to seal it', 'Compression stockings and walking the same day'],
    benefits: ['No cuts', 'Walk the same day', 'Better appearance'], risks: ['Bruising', 'Skin numbness patch', 'Recurrence (rare)'],
    departments: ['General Surgery', 'Vascular Surgery'],
  },
  {
    slug: 'circumcision', name: 'Circumcision (Stapler)', category: 'Urology', specialty: 'urologist', icon: 'urology',
    description: 'Stapler circumcision for phimosis or recurrent infection, with minimal bleeding and quick healing.',
    treats: ['Phimosis', 'Balanitis', 'Paraphimosis'], techniques: ['Stapler circumcision', 'Laser circumcision', 'Conventional circumcision'],
    durationMinutes: [15, 30], stay: 'Day care', recovery: '5–7 days', anaesthesia: 'Local anaesthesia', cost: [25000, 45000], insurance: true,
    steps: ['Consultation and examination', 'Local anaesthesia', 'Stapler device removes the foreskin', 'Same-day discharge'],
    benefits: ['Minimal bleeding', 'Neat result', 'Quick recovery'], risks: ['Swelling', 'Infection (rare)', 'Bleeding (rare)'],
    departments: ['Urology'],
  },
  {
    slug: 'kidney-stone-removal', name: 'Kidney Stone Removal (RIRS / PCNL)', category: 'Urology', specialty: 'urologist', icon: 'nephrology', popular: true,
    description: 'Laser removal of kidney and ureteric stones through natural passages (RIRS/URSL) or a small keyhole (PCNL).',
    treats: ['Kidney stones', 'Ureteric stones', 'Recurrent stone pain'], techniques: ['RIRS (flexible laser)', 'URSL', 'PCNL', 'ESWL (shock wave)'],
    durationMinutes: [45, 120], stay: '1–2 days', recovery: '3–7 days', anaesthesia: 'Spinal or general anaesthesia', cost: [60000, 140000], insurance: true,
    steps: ['CT KUB to locate the stones', 'Urine and blood tests', 'Stones broken with laser and removed', 'Stent removal after 1–3 weeks if placed'],
    benefits: ['No large cuts', 'High stone clearance', 'Quick return to work'], risks: ['Blood in urine for a few days', 'Stent discomfort', 'Infection (rare)'],
    departments: ['Urology'],
  },
  {
    slug: 'prostate-surgery', name: 'Prostate Surgery (TURP / HoLEP)', category: 'Urology', specialty: 'urologist', icon: 'urology',
    description: 'Removal of the enlarged part of the prostate through the urine passage to relieve urinary symptoms.',
    treats: ['Enlarged prostate (BPH)', 'Weak urine stream', 'Urinary retention'], techniques: ['TURP', 'HoLEP (laser)', 'Rezum water vapour therapy'],
    durationMinutes: [60, 120], stay: '2–3 days', recovery: '2–4 weeks', anaesthesia: 'Spinal anaesthesia', cost: [80000, 180000], insurance: true,
    steps: ['Ultrasound, uroflow and PSA test', 'Fitness check', 'Prostate tissue removed through a scope', 'Catheter for 1–3 days'],
    benefits: ['Stronger urine flow', 'Fewer night-time trips', 'Long-lasting relief'], risks: ['Blood in urine', 'Retrograde ejaculation', 'Temporary incontinence'],
    departments: ['Urology'],
  },
  {
    slug: 'cataract-surgery', name: 'Cataract Surgery', category: 'Eye', specialty: 'ophthalmologist', icon: 'visibility', popular: true,
    description: 'Stitch-less phaco surgery replaces the cloudy lens with a clear intraocular lens, usually in under 20 minutes.',
    treats: ['Age-related cataract', 'Blurred or cloudy vision', 'Glare at night'], techniques: ['Phacoemulsification', 'Femto laser-assisted cataract surgery', 'MICS'],
    durationMinutes: [15, 30], stay: 'Day care', recovery: '1–2 weeks', anaesthesia: 'Topical (eye drop) anaesthesia', cost: [25000, 90000], insurance: true,
    steps: ['Eye tests and lens power measurement', 'Choice of monofocal, toric or multifocal lens', 'Cloudy lens removed and new lens placed', 'Eye drops for 4 weeks'],
    benefits: ['Clearer vision within days', 'No stitches', 'Possibility of reduced dependence on glasses'], risks: ['Temporary irritation', 'Posterior capsule opacity (treatable)', 'Infection (very rare)'],
    departments: ['Ophthalmology', 'Cataract'],
  },
  {
    slug: 'lasik-surgery', name: 'LASIK Eye Surgery', category: 'Eye', specialty: 'ophthalmologist', icon: 'eyeglasses', popular: true,
    description: 'Laser vision correction to reduce or remove dependence on glasses and contact lenses.',
    treats: ['Myopia (short sight)', 'Hyperopia', 'Astigmatism'], techniques: ['SMILE', 'Contoura LASIK', 'Femto LASIK', 'PRK'],
    durationMinutes: [15, 30], stay: 'Day care', recovery: '1–3 days', anaesthesia: 'Eye drop anaesthesia', cost: [40000, 120000], insurance: false,
    steps: ['Eligibility tests (corneal thickness and topography)', 'Choice of technique', 'Laser reshapes the cornea in minutes', 'Protective glasses and drops for a week'],
    benefits: ['Freedom from glasses', 'Quick recovery', 'Painless procedure'], risks: ['Dry eyes for some weeks', 'Glare at night', 'Under- or over-correction (rare)'],
    departments: ['Ophthalmology', 'Cornea & LASIK'],
  },
  {
    slug: 'knee-replacement', name: 'Knee Replacement Surgery', category: 'Orthopaedics', specialty: 'orthopedist', icon: 'orthopedics', popular: true,
    description: 'Total or partial knee replacement for advanced arthritis, to relieve pain and restore walking.',
    treats: ['Advanced knee osteoarthritis', 'Rheumatoid arthritis of the knee', 'Knee deformity'], techniques: ['Total knee replacement', 'Partial knee replacement', 'Robotic knee replacement'],
    durationMinutes: [90, 150], stay: '3–5 days', recovery: '6–12 weeks', anaesthesia: 'Spinal anaesthesia with nerve block', cost: [180000, 400000], insurance: true,
    steps: ['X-rays and fitness evaluation', 'Implant selection', 'Damaged joint surfaces replaced with an implant', 'Walking from day one with physiotherapy'],
    benefits: ['Lasting pain relief', 'Better mobility', 'Implants last 15–20 years'], risks: ['Blood clots', 'Infection (rare)', 'Stiffness'],
    departments: ['Orthopaedics'],
  },
  {
    slug: 'hip-replacement', name: 'Hip Replacement Surgery', category: 'Orthopaedics', specialty: 'orthopedist', icon: 'orthopedics',
    description: 'Replacement of a damaged hip joint to relieve pain from arthritis, avascular necrosis or fracture.',
    treats: ['Hip arthritis', 'Avascular necrosis', 'Hip fracture'], techniques: ['Total hip replacement', 'Hemiarthroplasty', 'Minimally invasive hip replacement'],
    durationMinutes: [90, 150], stay: '3–5 days', recovery: '6–12 weeks', anaesthesia: 'Spinal anaesthesia', cost: [200000, 450000], insurance: true,
    steps: ['X-ray or MRI of the hip', 'Fitness evaluation', 'Hip joint replaced with an implant', 'Walking with support from day one'],
    benefits: ['Pain relief', 'Improved walking', 'Long-lasting implants'], risks: ['Dislocation (rare)', 'Blood clots', 'Infection (rare)'],
    departments: ['Orthopaedics'],
  },
  {
    slug: 'acl-reconstruction', name: 'ACL Reconstruction', category: 'Orthopaedics', specialty: 'orthopedist', icon: 'sports_martial_arts',
    description: 'Arthroscopic reconstruction of a torn anterior cruciate ligament using a graft, to restore knee stability.',
    treats: ['ACL tear', 'Knee instability', 'Sports knee injuries'], techniques: ['Arthroscopic ACL reconstruction', 'All-inside technique'],
    durationMinutes: [60, 120], stay: '1–2 days', recovery: '6–9 months to sport', anaesthesia: 'Spinal anaesthesia', cost: [90000, 200000], insurance: true,
    steps: ['MRI to confirm the tear', 'Pre-hab exercises', 'Graft placed through keyhole arthroscopy', 'Structured rehab programme'],
    benefits: ['Stable knee', 'Return to sport', 'Protects cartilage'], risks: ['Stiffness', 'Graft failure (rare)', 'Infection (rare)'],
    departments: ['Orthopaedics', 'Sports Medicine'],
  },
  {
    slug: 'spine-surgery', name: 'Spine Surgery (Microdiscectomy)', category: 'Orthopaedics', specialty: 'orthopedist', icon: 'orthopedics',
    description: 'Minimally invasive removal of a herniated disc pressing on a nerve, for leg pain that doesn’t settle.',
    treats: ['Slip disc with sciatica', 'Spinal canal stenosis', 'Nerve compression'], techniques: ['Microdiscectomy', 'Endoscopic spine surgery', 'Spinal fusion'],
    durationMinutes: [60, 180], stay: '1–4 days', recovery: '2–6 weeks', anaesthesia: 'General anaesthesia', cost: [120000, 350000], insurance: true,
    steps: ['MRI spine', 'Trial of physiotherapy and medicines', 'Disc fragment removed through a small cut', 'Early walking and rehab'],
    benefits: ['Relief from leg pain', 'Small incision', 'Early mobilisation'], risks: ['Recurrence', 'Nerve irritation', 'Infection (rare)'],
    departments: ['Orthopaedics', 'Neurosurgery', 'Spine Care'],
  },
  {
    slug: 'hysterectomy', name: 'Laparoscopic Hysterectomy', category: 'Gynaecology', specialty: 'gynecologist', icon: 'gynecology',
    description: 'Keyhole removal of the uterus for fibroids, heavy bleeding or other conditions when medicines haven’t helped.',
    treats: ['Uterine fibroids', 'Heavy menstrual bleeding', 'Adenomyosis and endometriosis'], techniques: ['Total laparoscopic hysterectomy', 'Vaginal hysterectomy', 'Abdominal hysterectomy'],
    durationMinutes: [90, 150], stay: '2–3 days', recovery: '2–4 weeks', anaesthesia: 'General anaesthesia', cost: [90000, 200000], insurance: true,
    steps: ['Ultrasound and blood tests', 'Counselling on options', 'Uterus removed through keyhole cuts', 'Discharge in 2–3 days'],
    benefits: ['Ends heavy bleeding and pain', 'Small scars', 'Faster recovery than open surgery'], risks: ['Bleeding', 'Infection', 'Injury to nearby organs (rare)'],
    departments: ['Obstetrics & Gynaecology'],
  },
  {
    slug: 'fibroid-removal', name: 'Fibroid Removal (Myomectomy)', category: 'Gynaecology', specialty: 'gynecologist', icon: 'gynecology',
    description: 'Removal of uterine fibroids while preserving the uterus, suitable for women planning a pregnancy.',
    treats: ['Uterine fibroids', 'Heavy periods from fibroids', 'Fibroid-related infertility'], techniques: ['Laparoscopic myomectomy', 'Hysteroscopic myomectomy', 'Open myomectomy'],
    durationMinutes: [60, 150], stay: '1–3 days', recovery: '2–4 weeks', anaesthesia: 'General anaesthesia', cost: [80000, 180000], insurance: true,
    steps: ['Ultrasound or MRI to map fibroids', 'Correction of anaemia if needed', 'Fibroids removed, uterus repaired', 'Follow-up scan'],
    benefits: ['Preserves fertility', 'Relief from heavy bleeding', 'Minimally invasive options'], risks: ['Bleeding', 'Recurrence', 'Adhesions'],
    departments: ['Obstetrics & Gynaecology'],
  },
  {
    slug: 'c-section-delivery', name: 'C-Section Delivery', category: 'Gynaecology', specialty: 'gynecologist', icon: 'pregnant_woman',
    description: 'Planned or emergency caesarean delivery with an experienced obstetric, anaesthesia and neonatal team.',
    treats: ['Breech or complicated pregnancy', 'Previous C-section', 'Foetal distress'], techniques: ['Lower segment caesarean section (LSCS)'],
    durationMinutes: [45, 75], stay: '3–4 days', recovery: '4–6 weeks', anaesthesia: 'Spinal anaesthesia', cost: [60000, 150000], insurance: true,
    steps: ['Antenatal planning and tests', 'Spinal anaesthesia', 'Baby delivered through a lower abdominal cut', 'Mother and baby recovery with feeding support'],
    benefits: ['Safe delivery when normal birth is risky', 'Planned timing', 'Neonatal team on standby'], risks: ['Infection', 'Bleeding', 'Longer recovery than normal delivery'],
    departments: ['Obstetrics & Gynaecology', 'Neonatology'],
  },
  {
    slug: 'tonsillectomy', name: 'Tonsillectomy', category: 'ENT', specialty: 'ent-specialist', icon: 'record_voice_over',
    description: 'Removal of the tonsils for recurrent tonsillitis or sleep-disordered breathing, often using coblation for less pain.',
    treats: ['Recurrent tonsillitis', 'Enlarged tonsils with snoring', 'Peritonsillar abscess'], techniques: ['Coblation tonsillectomy', 'Conventional dissection'],
    durationMinutes: [30, 60], stay: 'Day care to 1 day', recovery: '10–14 days', anaesthesia: 'General anaesthesia', cost: [40000, 90000], insurance: true,
    steps: ['ENT examination', 'Fitness tests', 'Tonsils removed through the mouth', 'Soft diet for 10 days'],
    benefits: ['Fewer throat infections', 'Better sleep in children', 'No external scars'], risks: ['Throat pain', 'Bleeding (rare)', 'Temporary taste change'],
    departments: ['ENT'],
  },
  {
    slug: 'septoplasty', name: 'Septoplasty', category: 'ENT', specialty: 'ent-specialist', icon: 'masks',
    description: 'Straightening of a deviated nasal septum to improve breathing, done entirely inside the nose.',
    treats: ['Deviated nasal septum', 'Blocked nose', 'Snoring and mouth breathing'], techniques: ['Endoscopic septoplasty', 'Septoplasty with turbinate reduction'],
    durationMinutes: [45, 90], stay: 'Day care to 1 day', recovery: '1–2 weeks', anaesthesia: 'General anaesthesia', cost: [45000, 100000], insurance: true,
    steps: ['Nasal endoscopy and CT', 'Fitness check', 'Septum straightened through the nostrils', 'Nasal packs for 24 hours'],
    benefits: ['Easier breathing', 'Less snoring', 'No visible scar'], risks: ['Bleeding', 'Crusting', 'Rare septal perforation'],
    departments: ['ENT'],
  },
  {
    slug: 'sinus-surgery', name: 'Sinus Surgery (FESS)', category: 'ENT', specialty: 'ent-specialist', icon: 'masks',
    description: 'Functional endoscopic sinus surgery opens blocked sinuses and removes polyps for chronic sinusitis.',
    treats: ['Chronic sinusitis', 'Nasal polyps', 'Recurrent sinus infections'], techniques: ['FESS', 'Balloon sinuplasty'],
    durationMinutes: [60, 120], stay: '1 day', recovery: '1–2 weeks', anaesthesia: 'General anaesthesia', cost: [60000, 140000], insurance: true,
    steps: ['CT scan of the sinuses', 'Trial of medical treatment', 'Sinus openings widened with an endoscope', 'Saline washes after surgery'],
    benefits: ['Fewer infections', 'Better sense of smell', 'No external cuts'], risks: ['Bleeding', 'Crusting', 'Recurrence of polyps'],
    departments: ['ENT'],
  },
  {
    slug: 'hair-transplant', name: 'Hair Transplant', category: 'Cosmetic & Plastic', specialty: 'cosmetologist', icon: 'face', popular: true,
    description: 'Permanent restoration of hair using follicles from the back of the scalp (FUE or FUT).',
    treats: ['Male pattern baldness', 'Receding hairline', 'Thin crown'], techniques: ['FUE', 'FUT', 'DHI'],
    durationMinutes: [240, 480], stay: 'Day care', recovery: '7–10 days', anaesthesia: 'Local anaesthesia', cost: [50000, 200000], insurance: false,
    steps: ['Scalp analysis and graft planning', 'Donor follicles extracted', 'Grafts implanted in thinning areas', 'New growth from 3–4 months'],
    benefits: ['Permanent natural-looking hair', 'Minimal scarring with FUE', 'Low maintenance'], risks: ['Temporary swelling', 'Shock loss', 'Patchy growth (rare)'],
    departments: ['Aesthetic Medicine', 'Dermatology', 'Cosmetic Procedures'],
  },
  {
    slug: 'liposuction', name: 'Liposuction', category: 'Cosmetic & Plastic', specialty: 'cosmetologist', icon: 'face',
    description: 'Body contouring that removes stubborn fat from the abdomen, thighs, arms or chin.',
    treats: ['Stubborn fat deposits', 'Body contouring', 'Double chin'], techniques: ['Tumescent liposuction', 'Vaser liposuction', 'Laser lipolysis'],
    durationMinutes: [60, 180], stay: 'Day care to 1 day', recovery: '1–2 weeks', anaesthesia: 'Local or general anaesthesia', cost: [60000, 200000], insurance: false,
    steps: ['Consultation and body assessment', 'Marking of treatment areas', 'Fat removed through small cannulas', 'Compression garment for 4–6 weeks'],
    benefits: ['Improved body shape', 'Permanent fat-cell removal', 'Small scars'], risks: ['Bruising and swelling', 'Uneven contour', 'Infection (rare)'],
    departments: ['Aesthetic Medicine', 'Cosmetic Procedures'],
  },
  {
    slug: 'gynecomastia-surgery', name: 'Gynecomastia Surgery', category: 'Cosmetic & Plastic', specialty: 'cosmetologist', icon: 'male',
    description: 'Removal of excess breast tissue and fat in men for a flatter chest.',
    treats: ['Gynecomastia', 'Male chest fat'], techniques: ['Liposuction with gland excision', 'Vaser-assisted gynecomastia surgery'],
    durationMinutes: [60, 120], stay: 'Day care', recovery: '1–2 weeks', anaesthesia: 'General or local anaesthesia', cost: [50000, 120000], insurance: false,
    steps: ['Examination and hormone tests', 'Planning', 'Fat and gland removed through small cuts', 'Compression vest for 4–6 weeks'],
    benefits: ['Flatter chest', 'Improved confidence', 'Minimal scarring'], risks: ['Swelling', 'Asymmetry', 'Seroma'],
    departments: ['Aesthetic Medicine', 'Cosmetic Procedures'],
  },
  {
    slug: 'rhinoplasty', name: 'Rhinoplasty (Nose Job)', category: 'Cosmetic & Plastic', specialty: 'ent-specialist', icon: 'face',
    description: 'Surgery to reshape the nose for appearance or breathing, often combined with septoplasty.',
    treats: ['Nasal hump or deviation', 'Broad or drooping tip', 'Breathing problems'], techniques: ['Open rhinoplasty', 'Closed rhinoplasty', 'Septorhinoplasty'],
    durationMinutes: [90, 180], stay: 'Day care to 1 day', recovery: '2–3 weeks', anaesthesia: 'General anaesthesia', cost: [80000, 200000], insurance: false,
    steps: ['Consultation and photo analysis', 'Planning the new shape', 'Bone and cartilage reshaped', 'Splint for a week'],
    benefits: ['Improved appearance', 'Better breathing', 'Permanent result'], risks: ['Swelling', 'Asymmetry', 'Revision need (rare)'],
    departments: ['ENT', 'Aesthetic Medicine'],
  },
  {
    slug: 'angioplasty', name: 'Angioplasty & Stenting', category: 'Heart', specialty: 'cardiologist', icon: 'cardiology', popular: true,
    description: 'Opening a blocked heart artery with a balloon and stent through a wrist or groin puncture.',
    treats: ['Coronary artery blockage', 'Angina', 'Heart attack'], techniques: ['PTCA with drug-eluting stent', 'Radial (wrist) angioplasty'],
    durationMinutes: [60, 120], stay: '1–2 days', recovery: '1 week', anaesthesia: 'Local anaesthesia with sedation', cost: [150000, 350000], insurance: true,
    steps: ['Angiography to find the blockage', 'Balloon opens the artery', 'Stent placed to keep it open', 'Blood thinners and cardiac rehab'],
    benefits: ['Restores blood flow', 'Relieves chest pain', 'No open surgery'], risks: ['Bleeding at the puncture site', 'Stent re-narrowing', 'Rare heart complications'],
    departments: ['Cardiology'],
  },
  {
    slug: 'bypass-surgery', name: 'Heart Bypass Surgery (CABG)', category: 'Heart', specialty: 'cardiologist', icon: 'cardiology',
    description: 'Coronary artery bypass grafting routes blood around blocked arteries using grafts from the chest, leg or arm.',
    treats: ['Multiple coronary blockages', 'Left main disease', 'Blockages unsuitable for stenting'], techniques: ['On-pump CABG', 'Off-pump (beating heart) CABG', 'Minimally invasive CABG'],
    durationMinutes: [180, 360], stay: '6–8 days', recovery: '6–12 weeks', anaesthesia: 'General anaesthesia', cost: [250000, 550000], insurance: true,
    steps: ['Angiography and heart assessment', 'Surgical planning', 'Grafts connected beyond the blockages', 'ICU care and cardiac rehab'],
    benefits: ['Long-term relief', 'Improved survival in multi-vessel disease', 'Better quality of life'], risks: ['Bleeding', 'Infection', 'Irregular heartbeat'],
    departments: ['Cardiology', 'Cardiothoracic Surgery'],
  },
  {
    slug: 'bariatric-surgery', name: 'Bariatric (Weight Loss) Surgery', category: 'Weight Loss', specialty: 'general-surgeon', icon: 'monitor_weight',
    description: 'Laparoscopic sleeve gastrectomy or gastric bypass for severe obesity and related diabetes.',
    treats: ['Severe obesity (BMI 35+ with conditions, or 40+)', 'Obesity-related diabetes', 'Sleep apnoea from obesity'], techniques: ['Sleeve gastrectomy', 'Roux-en-Y gastric bypass', 'Mini gastric bypass'],
    durationMinutes: [90, 180], stay: '2–3 days', recovery: '2–4 weeks', anaesthesia: 'General anaesthesia', cost: [250000, 450000], insurance: true,
    steps: ['Evaluation by surgeon, dietitian and endocrinologist', 'Pre-operative diet', 'Stomach reduced laparoscopically', 'Staged diet and lifelong follow-up'],
    benefits: ['Significant lasting weight loss', 'Diabetes remission in many', 'Better joint and heart health'], risks: ['Leak (rare)', 'Nutritional deficiency', 'Reflux'],
    departments: ['General Surgery'],
  },
  {
    slug: 'dental-implants', name: 'Dental Implants', category: 'Dental', specialty: 'implantologist', icon: 'dentistry', popular: true,
    description: 'Titanium implants replace missing teeth permanently, topped with a natural-looking crown.',
    treats: ['Missing teeth', 'Loose dentures', 'Full-mouth rehabilitation'], techniques: ['Single implant', 'All-on-4 / All-on-6', 'Immediate loading implants'],
    durationMinutes: [45, 120], stay: 'Day care', recovery: '3–5 days (3–6 months for full integration)', anaesthesia: 'Local anaesthesia', cost: [25000, 60000], insurance: false,
    steps: ['CBCT scan and planning', 'Implant placed in the jaw', 'Healing and integration', 'Crown fixed on the implant'],
    benefits: ['Permanent solution', 'Looks and feels natural', 'Protects jaw bone'], risks: ['Implant failure (rare)', 'Infection', 'Swelling'],
    departments: ['Implantology', 'General Dentistry'],
  },
];

export const SURGERY_BY_SLUG = new Map(SURGERIES.map((s) => [s.slug, s]));
