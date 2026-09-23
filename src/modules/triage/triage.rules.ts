/**
 * Rule-based symptom triage. Red flags are checked first and always win; otherwise the
 * specialty with the most keyword matches is suggested. This is guidance, not diagnosis.
 */

export const RED_FLAGS: { match: RegExp; reason: string }[] = [
  { match: /chest (pain|tightness|pressure|heaviness)|pain (in|spreading to|radiating to) (the )?(left )?(arm|jaw)/i, reason: 'Chest pain or pressure can be a heart attack' },
  { match: /can'?t breathe|cannot breathe|severe(ly)? breathless|difficulty breathing|gasping|blue lips/i, reason: 'Severe difficulty breathing' },
  { match: /face drooping|slurred speech|sudden (weakness|numbness)|one side of (my|the) body|stroke/i, reason: 'Possible stroke signs (face, arm, speech)' },
  { match: /unconscious|fainted|passed out|seizure|fits|convulsion/i, reason: 'Fainting or a seizure' },
  { match: /vomiting blood|blood in (my )?vomit|black (tarry )?stool|heavy bleeding|bleeding (won'?t|doesn'?t) stop/i, reason: 'Serious bleeding' },
  { match: /suicid|self[- ]harm|kill myself|end my life/i, reason: 'Thoughts of self-harm — call Tele-MANAS 14416 (free, 24×7) or 108 now' },
  { match: /swelling of (the |my )?(face|lips|tongue|throat)|anaphyla|severe allergic/i, reason: 'Severe allergic reaction' },
  { match: /head injury|hit (my|his|her) head|accident/i, reason: 'Head injury or accident' },
];

type Rule = { specialty: string; focus: string; words: RegExp };

export const RULES: Rule[] = [
  { specialty: 'dermatologist', focus: 'acne-scars', words: /\b(acne|pimples?|breakouts?|scars?|blackheads?)\b/i },
  { specialty: 'dermatologist', focus: 'hair-scalp', words: /\b(hair ?fall|hair loss|bald|dandruff|scalp|thinning hair)\b/i },
  { specialty: 'dermatologist', focus: 'skin-allergy', words: /\b(rash|itch(y|ing)?|hives|eczema|skin allergy|redness)\b/i },
  { specialty: 'dermatologist', focus: 'pigmentation', words: /\b(pigmentation|dark spots?|melasma|tan(ning)?|uneven skin)\b/i },
  { specialty: 'dermatologist', focus: 'fungal-infection', words: /\b(ringworm|fungal|tinea|athlete'?s foot|nail infection)\b/i },
  { specialty: 'general-physician', focus: 'fever-infection', words: /\b(fever|temperature|chills|dengue|typhoid|malaria|infection)\b/i },
  { specialty: 'general-physician', focus: 'cough-cold', words: /\b(cough|cold|runny nose|sneez\w*|sore throat|flu)\b/i },
  { specialty: 'general-physician', focus: 'diabetes-bp', words: /\b(diabet\w*|sugar|blood pressure|bp)\b/i },
  { specialty: 'general-physician', focus: 'fatigue-weakness', words: /\b(tired(ness)?|fatigue|weak(ness)?|low energy|anaemi\w*|anemi\w*)\b/i },
  { specialty: 'general-physician', focus: 'general-consult', words: /\b(check ?up|general|second opinion|body ache|fitness certificate)\b/i },
  { specialty: 'cardiologist', focus: 'heart-rhythm', words: /\b(palpitations?|racing heart|irregular heart ?beat|heart ?beat)\b/i },
  { specialty: 'cardiologist', focus: 'cholesterol', words: /\b(cholesterol|lipids?|triglycerides?)\b/i },
  { specialty: 'cardiologist', focus: 'bp-hypertension', words: /\b(hypertension|high bp|high blood pressure)\b/i },
  { specialty: 'pediatrician', focus: 'child-fever', words: /\b(child|kid|baby|infant|toddler|son|daughter|newborn)\b/i },
  { specialty: 'pediatrician', focus: 'vaccination', words: /\b(vaccin\w*|immuni[sz]ation)\b/i },
  { specialty: 'gynecologist', focus: 'period-problems', words: /\b(periods?|menstrua\w*|cramps|irregular cycle|white discharge)\b/i },
  { specialty: 'gynecologist', focus: 'pregnancy-care', words: /\b(pregnan\w*|missed period|prenatal)\b/i },
  { specialty: 'gynecologist', focus: 'pcos', words: /\b(pcos|pcod|polycystic)\b/i },
  { specialty: 'gynecologist', focus: 'menopause', words: /\b(menopause|hot flashes)\b/i },
  { specialty: 'orthopedist', focus: 'knee-joint-pain', words: /\b(knee|joint pain|ankle|hip pain|shoulder pain)\b/i },
  { specialty: 'orthopedist', focus: 'back-neck-pain', words: /\b(back ?pain|neck pain|spine|sciatica|slip disc)\b/i },
  { specialty: 'orthopedist', focus: 'sports-injury', words: /\b(sprain|twisted|ligament|sports injury|muscle pull)\b/i },
  { specialty: 'orthopedist', focus: 'arthritis', words: /\b(arthritis|stiff joints|gout)\b/i },
  { specialty: 'psychiatrist', focus: 'anxiety-stress', words: /\b(anxi\w*|stress(ed)?|panic|nervous|overthink\w*)\b/i },
  { specialty: 'psychiatrist', focus: 'depression', words: /\b(depress\w*|sad|low mood|hopeless|no motivation)\b/i },
  { specialty: 'psychiatrist', focus: 'sleep-problems', words: /\b(insomnia|can'?t sleep|sleepless|poor sleep)\b/i },
  { specialty: 'ent-specialist', focus: 'ear-hearing', words: /\b(ear ?(pain|ache)|hearing|ringing|tinnitus|ear discharge)\b/i },
  { specialty: 'ent-specialist', focus: 'sinus-nasal', words: /\b(sinus\w*|blocked nose|nasal|nose bleed)\b/i },
  { specialty: 'ent-specialist', focus: 'throat-voice', words: /\b(tonsil\w*|hoarse|voice|swallowing)\b/i },
  { specialty: 'ent-specialist', focus: 'vertigo', words: /\b(vertigo|spinning|dizz\w*)\b/i },
  { specialty: 'gastroenterologist', focus: 'acidity-reflux', words: /\b(acidity|heartburn|reflux|gas|bloat\w*|indigestion)\b/i },
  { specialty: 'gastroenterologist', focus: 'ibs-constipation', words: /\b(constipat\w*|diarrh\w*|loose motions?|ibs)\b/i },
  { specialty: 'gastroenterologist', focus: 'abdominal-pain', words: /\b(stomach ?(pain|ache)|abdominal pain|tummy|vomit\w*|nausea)\b/i },
  { specialty: 'gastroenterologist', focus: 'liver-health', words: /\b(liver|jaundice|fatty liver)\b/i },
  { specialty: 'neurologist', focus: 'headache-migraine', words: /\b(headaches?|migraines?)\b/i },
  { specialty: 'neurologist', focus: 'nerve-pain', words: /\b(tingling|numbness|pins and needles|nerve pain)\b/i },
  { specialty: 'ophthalmologist', focus: 'eye-irritation', words: /\b(red eyes?|eye (pain|itch\w*|infection)|conjunctivitis|watery eyes?)\b/i },
  { specialty: 'ophthalmologist', focus: 'vision-problems', words: /\b(blurr?y vision|vision|spectacles|glasses|can'?t see)\b/i },
  { specialty: 'ophthalmologist', focus: 'dry-eyes', words: /\b(dry eyes?|screen strain|eye strain)\b/i },
  { specialty: 'dentist', focus: 'tooth-pain', words: /\b(tooth ?ache|tooth pain|teeth|cavity|dental)\b/i },
  { specialty: 'dentist', focus: 'gum-problems', words: /\b(gums?|bleeding gums|bad breath)\b/i },
];

export const ADVICE: Record<string, string[]> = {
  'general-physician': ['Rest and drink plenty of fluids (ORS, coconut water, soups).', 'Use paracetamol for fever above 100°F; avoid ibuprofen if dengue is possible.', 'Check your temperature every 6 hours and note it down for the doctor.'],
  dermatologist: ['Avoid scrubbing, picking or trying new products until you are seen.', 'Use a gentle, fragrance-free cleanser and moisturiser.', 'Take clear photos in daylight to share during a video consult.'],
  cardiologist: ['Note when symptoms happen and what you were doing.', 'Record a few home BP readings if you have a monitor.', 'Chest pain at rest, with sweating or spreading to the arm is an emergency — call 108.'],
  pediatrician: ['Keep your child well hydrated and note their temperature and feeds.', 'Seek urgent care for a fever above 104°F, drowsiness, or fewer wet nappies.'],
  gynecologist: ['Note the dates of your last few periods and any unusual bleeding.', 'Heavy bleeding soaking a pad every hour needs urgent care.'],
  orthopedist: ['Rest the area and use a cold pack for 15 minutes, 3–4 times a day.', 'Avoid heavy lifting until you are reviewed.'],
  psychiatrist: ['You are not alone — talking to a professional genuinely helps.', 'Keep a simple regular sleep and wake time.', 'If you ever feel unsafe, call Tele-MANAS on 14416 (free, 24×7).'],
  'ent-specialist': ['Avoid putting anything inside your ear.', 'Steam inhalation can ease sinus congestion.'],
  gastroenterologist: ['Eat small, bland meals and avoid spicy, oily food for now.', 'Sip ORS if you have loose motions or vomiting.', 'Blood in vomit or black stools is an emergency — call 108.'],
  neurologist: ['Rest in a dark, quiet room during a headache.', 'A sudden, severe “worst ever” headache needs emergency care.'],
  ophthalmologist: ['Do not rub your eyes; wash hands often.', 'Sudden loss of vision needs same-day care.'],
  dentist: ['Rinse with warm salt water and avoid very hot or cold food.', 'Swelling of the face or jaw needs prompt review.'],
};
